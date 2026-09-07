create table telegram_chats (id uuid primary key default gen_random_uuid(), request_id uuid unique, chat_id text unique, title text not null, description text not null default '', kind text not null default 'group' check(kind in ('group','channel')), group_id uuid unique references groups on delete set null, course_id uuid references courses on delete set null, campaign_id uuid references campaigns on delete set null, username text not null default '', invite_link text not null default '', member_count integer not null default 0, bot_status text not null default 'unknown', status text not null default 'active' check(status in ('active','archived','provisioning','failed')), error text not null default '', created_at timestamptz not null default now());
create table telegram_posts (id uuid primary key default gen_random_uuid(), body text not null, status text not null default 'Draft' check(status in ('Draft','Scheduled','Publishing','Published','Failed','Cancelled')), author_id uuid references profiles on delete set null, created_at timestamptz not null default now(), scheduled_at timestamptz, timezone text not null default 'Europe/Kyiv', published_at timestamptz, error text not null default '');
create table telegram_post_media (id uuid primary key default gen_random_uuid(), post_id uuid not null references telegram_posts on delete cascade, url text not null, kind text not null check(kind in ('photo','video','document')), name text not null default '', position integer not null default 0);
create table telegram_post_buttons (id uuid primary key default gen_random_uuid(), post_id uuid not null references telegram_posts on delete cascade, label text not null, url text not null check(url ~ '^https?://'), position integer not null default 0);
create table telegram_deliveries (id uuid primary key default gen_random_uuid(), post_id uuid not null references telegram_posts on delete cascade, chat_id uuid not null references telegram_chats on delete restrict, status text not null default 'pending' check(status in ('pending','sending','sent','failed','cancelled')), error text not null default '', started_at timestamptz, published_at timestamptz, unique(post_id,chat_id));
create table telegram_messages (id uuid primary key default gen_random_uuid(), delivery_id uuid not null references telegram_deliveries on delete cascade, message_id bigint not null, kind text not null check(kind in ('text','photo','video','document')), deleted boolean not null default false, pinned boolean not null default false, unique(delivery_id,message_id));
create table telegram_templates (id uuid primary key default gen_random_uuid(), name text not null, body text not null);
create table telegram_join_requests (id uuid primary key default gen_random_uuid(), chat_id uuid not null references telegram_chats on delete cascade, user_id text not null, name text not null, status text not null default 'pending' check(status in ('pending','approved','declined')), created_at timestamptz not null default now(), unique(chat_id,user_id));
create table telegram_events (id uuid primary key default gen_random_uuid(), actor_id uuid references profiles on delete set null, action text not null, entity_id uuid, detail text not null default '', created_at timestamptz not null default now());
-- No staff or anonymous access to ciphertext, even through direct REST requests.
create table telegram_credentials (id text primary key, ciphertext text not null, updated_at timestamptz not null default now());
alter table telegram_credentials enable row level security;
revoke all on telegram_credentials from anon,authenticated;
create index telegram_due on telegram_posts(status,scheduled_at);
create index telegram_deliveries_pending on telegram_deliveries(status,post_id);
create index telegram_media_post on telegram_post_media(post_id);
create index telegram_buttons_post on telegram_post_buttons(post_id);
do $$ declare t text; begin foreach t in array array['telegram_chats','telegram_posts','telegram_post_media','telegram_post_buttons','telegram_deliveries','telegram_messages','telegram_templates','telegram_join_requests','telegram_events'] loop
 execute format('alter table %I enable row level security',t);
 execute format('create policy telegram_staff_read on %I for select to authenticated using (is_staff())',t);
 execute format('grant select on %I to authenticated',t);
 execute format('revoke all on %I from anon',t);
 -- All Telegram writes use validated server services, preventing direct REST queue injection.
 execute format('revoke insert,update,delete on %I from authenticated',t);
 end loop; end; $$;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then grant all on all tables in schema public to service_role; end if; end; $$;

create function telegram_claim_delivery(p_post uuid default null) returns jsonb language plpgsql security definer set search_path=public as $$ declare d telegram_deliveries; begin
 update telegram_deliveries td set status='failed',error='Отримувача архівовано до публікації' from telegram_chats c where td.chat_id=c.id and td.status='pending' and c.status='archived';
 select td.* into d from telegram_deliveries td join telegram_posts p on p.id=td.post_id join telegram_chats c on c.id=td.chat_id
 where td.status='pending' and (p_post is null or p.id=p_post) and p.status in ('Scheduled','Publishing') and p.scheduled_at<=now() and c.status='active'
 order by p.scheduled_at,td.id for update of td,p skip locked limit 1;
 if d.id is null then return null; end if;
 update telegram_deliveries set status='sending',started_at=now() where id=d.id;
 update telegram_posts set status='Publishing' where id=d.post_id;
 return to_jsonb(d); end; $$;
revoke all on function telegram_claim_delivery(uuid) from public,anon,authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then grant execute on function telegram_claim_delivery(uuid) to service_role; end if; end; $$;

create function telegram_cancel_post(p_id uuid,p_actor uuid) returns boolean language plpgsql security definer set search_path=public as $$ declare changed uuid; begin
 update telegram_posts set status='Cancelled' where id=p_id and status in ('Draft','Scheduled') returning id into changed;
 if changed is null then raise exception 'Публікацію вже розпочато'; end if;
 update telegram_deliveries set status='cancelled' where post_id=p_id and status='pending';
 insert into telegram_events(actor_id,action,entity_id) values(p_actor,'post.cancelled',p_id);return true;end;$$;
revoke all on function telegram_cancel_post(uuid,uuid) from public,anon,authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then grant execute on function telegram_cancel_post(uuid,uuid) to service_role; end if; end; $$;

do $$ begin if to_regclass('storage.buckets') is not null then execute 'insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values (''telegram-media'',''telegram-media'',false,4194304,array[''image/jpeg'',''image/png'',''image/webp'',''video/mp4'',''application/pdf'']) on conflict(id) do nothing';end if;end;$$;

-- Transactions keep the selected audience and content consistent.
create function telegram_save_post(p_id uuid,p_author uuid,p_body text,p_media jsonb,p_buttons jsonb,p_chats uuid[],p_when timestamptz,p_timezone text,p_draft boolean) returns uuid language plpgsql security definer set search_path=public as $$
declare old_status text; sid uuid; item jsonb; i integer:=0; begin
 if p_id is not null then
 select status into old_status from telegram_posts where id=p_id for update;
 if old_status is null or old_status not in ('Draft','Scheduled') then raise exception 'Можна редагувати лише чернетку або заплановану публікацію'; end if;
 if exists(select 1 from telegram_deliveries where post_id=p_id and status in ('sending','sent')) then raise exception 'Публікацію вже розпочато'; end if;
 update telegram_posts set body=p_body,status=case when p_draft then 'Draft' else 'Scheduled' end,scheduled_at=p_when,timezone=p_timezone where id=p_id returning id into sid;
 delete from telegram_deliveries where post_id=sid; delete from telegram_post_media where post_id=sid; delete from telegram_post_buttons where post_id=sid;
 else insert into telegram_posts(body,author_id,status,scheduled_at,timezone) values(p_body,p_author,case when p_draft then 'Draft' else 'Scheduled' end,p_when,p_timezone) returning id into sid; end if;
 if exists(select 1 from unnest(p_chats) x where not exists(select 1 from telegram_chats c where c.id=x and c.status='active' and c.chat_id is not null)) then raise exception 'Один з отримувачів неактивний'; end if;
 insert into telegram_deliveries(post_id,chat_id) select sid,x from (select distinct unnest(p_chats) x) c;
 for item in select * from jsonb_array_elements(p_media) loop insert into telegram_post_media(post_id,url,kind,name,position) values(sid,item->>'url',item->>'kind',item->>'name',i);i:=i+1;end loop;
 i:=0;for item in select * from jsonb_array_elements(p_buttons) loop insert into telegram_post_buttons(post_id,label,url,position) values(sid,item->>'label',item->>'url',i);i:=i+1;end loop;
 insert into telegram_events(actor_id,action,entity_id,detail) values(p_author,'post.saved',sid,case when p_draft then 'Чернетка' else 'У черзі на публікацію' end);
 return sid; end; $$;
revoke all on function telegram_save_post(uuid,uuid,text,jsonb,jsonb,uuid[],timestamptz,text,boolean) from public,anon,authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then grant execute on function telegram_save_post(uuid,uuid,text,jsonb,jsonb,uuid[],timestamptz,text,boolean) to service_role; end if; end; $$;

insert into telegram_templates(name,body) values
('Запрошення на курс','<b>{{course_name}}</b> 💛\nЗапрошуємо на навчання! {{registration_url}}'),
('Нагадування про заняття','Нагадуємо: {{group_name}}, заняття {{lesson_time}} 💛\nПосилання: {{zoom_url}}'),
('Зміна розкладу','<b>Оновлення розкладу</b>\n{{group_name}}: новий час — {{lesson_time}}.'),
('Заняття скасовано','Сьогодні заняття {{group_name}} скасовано. Повідомимо нову дату. Дякуємо за розуміння 💛'),
('Новий набір','<b>Відкрито набір: {{course_name}}</b> ✨\nРеєстрація: {{registration_url}}'),
('Посилання на Zoom','{{child_name}}, до зустрічі на занятті!\n{{zoom_url}}\nНаша група: {{telegram_url}}');
