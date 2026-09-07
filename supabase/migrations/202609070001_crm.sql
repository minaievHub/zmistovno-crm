-- All personal data is private. Public access is through two narrow RPCs only.
create type public.staff_role as enum ('admin','manager','teacher','call_center');
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, full_name text not null, role public.staff_role not null default 'manager');
create function public.is_staff() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and role in ('admin','manager')); $$;
create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and role='admin'); $$;
create table public.directions (id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 160), description text not null default '', emoji text not null default '✦', active boolean not null default true);
create table public.courses (id uuid primary key default gen_random_uuid(), direction_id uuid not null references directions on delete restrict, name text not null, description text not null default '', min_age int not null default 6 check(min_age between 1 and 18), max_age int not null default 14 check(max_age between min_age and 18), active boolean not null default true);
create table public.campaigns (id uuid primary key default gen_random_uuid(), course_id uuid not null references courses on delete restrict, name text not null, description text not null default '', min_age int not null default 6 check(min_age between 1 and 18), max_age int not null default 14 check(max_age between min_age and 18), start_date date, end_date date, status text not null default 'Чернетка' check(status in ('Чернетка','Активний','Призупинений','Завершений','Архів')), slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), internal_note text not null default '', created_at timestamptz not null default now(), check(end_date is null or start_date is null or end_date>=start_date));
create table public.registration_form_fields (id uuid primary key default gen_random_uuid(), campaign_id uuid not null references campaigns on delete cascade, key text not null check(key in ('first_name','last_name','age','phone','telegram','parent_name','comment')), label text not null, placeholder text not null default '', required boolean not null default false, enabled boolean not null default true, position int not null default 0, unique(campaign_id,key));
create table public.groups (id uuid primary key default gen_random_uuid(), course_id uuid not null references courses on delete restrict, name text not null, min_age int not null default 6 check(min_age between 1 and 18), max_age int not null default 14 check(max_age between min_age and 18), teacher text not null default '', day text not null default '', time text not null default '18:00', active boolean not null default true);
create table public.leads (id uuid primary key default gen_random_uuid(), campaign_id uuid not null references campaigns on delete restrict, first_name text not null default '', last_name text not null default '', age int check(age between 1 and 18), phone text not null default '', telegram text not null default '', parent_name text not null default '', comment text not null default '', status text not null default 'Нова' check(status in ('Нова','Потрібно зв’язатися','Зв’язались','Зацікавлені','Записаний','Думають','Не відповідають','Відмовились','Неактуально')), manager_id uuid references profiles on delete set null, group_id uuid references groups on delete set null, archived_at timestamptz, is_test boolean not null default false, submission_id uuid unique, created_at timestamptz not null default now());
create table public.lead_status_history (id uuid primary key default gen_random_uuid(), lead_id uuid not null references leads on delete cascade, actor_id uuid references profiles on delete set null, old_status text, new_status text not null, created_at timestamptz not null default now());
create table public.lead_notes (id uuid primary key default gen_random_uuid(), lead_id uuid not null references leads on delete cascade, author_id uuid references profiles on delete set null default auth.uid(), body text not null check(length(trim(body)) between 1 and 2000), created_at timestamptz not null default now());
create table public.students (id uuid primary key default gen_random_uuid(), lead_id uuid unique references leads on delete set null, first_name text not null, last_name text not null, age int, phone text not null, telegram text not null default '', created_at timestamptz not null default now());
create table public.group_students (id uuid primary key default gen_random_uuid(), group_id uuid not null references groups on delete cascade, student_id uuid not null references students on delete cascade, created_at timestamptz not null default now(), unique(group_id,student_id));
create table public.links (id uuid primary key default gen_random_uuid(), label text not null, url text not null check(url ~ '^https?://'), type text not null check(type in ('telegram','zoom','meet','website','custom')), entity_type text not null check(entity_type in ('courses','campaigns','groups')), entity_id uuid not null);
create table public.audit_logs (id uuid primary key default gen_random_uuid(), actor_id uuid references profiles on delete set null, entity_type text not null, entity_id uuid not null, action text not null, created_at timestamptz not null default now());
create index leads_phone_idx on leads(phone);
create index leads_campaign_idx on leads(campaign_id);
create index leads_status_idx on leads(status);
create index leads_created_idx on leads(created_at desc);
create index leads_telegram_idx on leads(lower(telegram));
create index campaigns_course_idx on campaigns(course_id);
create index groups_course_idx on groups(course_id);
create index courses_direction_idx on courses(direction_id);
create index links_entity_idx on links(entity_type,entity_id);
create index notes_lead_idx on lead_notes(lead_id);
create index history_lead_idx on lead_status_history(lead_id);
create index group_students_student_idx on group_students(student_id);

create function public.default_form() returns trigger language plpgsql security definer set search_path=public as $$ begin
 insert into registration_form_fields(campaign_id,key,label,placeholder,required,position) values
 (new.id,'first_name','Ім’я дитини','Наприклад, Софія',true,0),(new.id,'last_name','Прізвище дитини','Наприклад, Коваль',true,1),(new.id,'age','Вік дитини','8',true,2),(new.id,'phone','Номер телефону, до якого прив’язаний Telegram','+380',true,3),(new.id,'telegram','Telegram username','@username',false,4),(new.id,'parent_name','Ім’я одного з батьків','Як до вас звертатися?',false,5),(new.id,'comment','Коментар','Що нам варто знати?',false,6);
 return new; end; $$;
create trigger campaign_form after insert on campaigns for each row execute function default_form();

create function public.record_activity() returns trigger language plpgsql security definer set search_path=public as $$ declare row_id uuid; actor uuid; begin
 select id into actor from profiles where id=auth.uid();
 row_id:=case when TG_OP='DELETE' then old.id else new.id end;
 insert into audit_logs(actor_id,entity_type,entity_id,action) values(actor,TG_TABLE_NAME,row_id,TG_OP);
 if TG_TABLE_NAME='leads' and TG_OP<>'DELETE' then
   if TG_OP='INSERT' then insert into lead_status_history(lead_id,actor_id,new_status) values(new.id,actor,new.status);
   elsif new.status is distinct from old.status then insert into lead_status_history(lead_id,actor_id,old_status,new_status) values(new.id,actor,old.status,new.status); end if;
 end if;
 if TG_OP='DELETE' then return old; end if; return new; end; $$;
do $$ declare t text; begin foreach t in array array['directions','courses','campaigns','leads','groups','students','group_students','links','lead_notes','registration_form_fields'] loop execute format('create trigger audit_%I after insert or update or delete on %I for each row execute function record_activity()',t,t); end loop; end; $$;

-- Polymorphic links use a trigger to enforce references and prevent orphan rows.
create function public.check_link() returns trigger language plpgsql set search_path=public as $$ declare found_id uuid; begin
 if new.entity_type not in ('courses','campaigns','groups') then raise exception 'Невідома сутність'; end if;
 execute format('select id from %I where id=$1 for key share',new.entity_type) into found_id using new.entity_id;
 if found_id is null then raise exception 'Об’єкт посилання не існує'; end if; return new; end; $$;
create trigger link_reference before insert or update on links for each row execute function check_link();
create function public.remove_links() returns trigger language plpgsql security definer set search_path=public as $$ begin delete from links where entity_type=TG_TABLE_NAME and entity_id=old.id; return old; end; $$;
create trigger course_links before delete on courses for each row execute function remove_links();
create trigger campaign_links before delete on campaigns for each row execute function remove_links();
create trigger group_links before delete on groups for each row execute function remove_links();

create function public.check_lead_group() returns trigger language plpgsql set search_path=public as $$ begin
 if new.group_id is not null and not exists(select 1 from groups g join campaigns c on c.course_id=g.course_id where g.id=new.group_id and c.id=new.campaign_id and g.active and (new.age is null or new.age between g.min_age and g.max_age)) then raise exception 'Група не відповідає курсу або віку дитини'; end if;
 return new; end; $$;
create trigger lead_group before insert or update of group_id,campaign_id,age on leads for each row execute function check_lead_group();

-- Closed to anonymous users, including profiles, internal notes and audit trails.
do $$ declare t text; begin foreach t in array array['profiles','directions','courses','campaigns','registration_form_fields','leads','lead_status_history','lead_notes','students','groups','group_students','links','audit_logs'] loop
 execute format('alter table %I enable row level security',t);
 execute format('create policy staff_read on %I for select to authenticated using (public.is_staff())',t);
 if t not in ('profiles','audit_logs','lead_status_history') then
 execute format('create policy staff_insert on %I for insert to authenticated with check (public.is_staff())',t);
 execute format('create policy staff_update on %I for update to authenticated using (public.is_staff()) with check (public.is_staff())',t);
 execute format('create policy staff_delete on %I for delete to authenticated using (public.is_staff())',t);
 end if;
 end loop; end; $$;
create policy profile_self on profiles for select to authenticated using(id=auth.uid());
create policy admin_profiles on profiles for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant usage on schema public to anon,authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;

create function public.public_campaign(p_slug text) returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('id',c.id,'name',c.name,'description',c.description,'min_age',c.min_age,'max_age',c.max_age,'slug',c.slug,'course_name',co.name,'fields',(select coalesce(jsonb_agg(to_jsonb(f) order by f.position),'[]'::jsonb) from registration_form_fields f where f.campaign_id=c.id and f.enabled))
 from campaigns c join courses co on co.id=c.course_id join directions d on d.id=co.direction_id
 where c.slug=p_slug and c.status='Активний' and co.active and d.active and (c.start_date is null or c.start_date<=(now() at time zone 'Europe/Kyiv')::date) and (c.end_date is null or c.end_date>=(now() at time zone 'Europe/Kyiv')::date);
$$;

create function public.submit_registration(p_slug text,p_data jsonb,p_submission_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare c campaigns; f registration_form_fields; v text; clean jsonb:='{}'::jsonb; begin
 if p_submission_id is null then raise exception 'Відсутній ідентифікатор запиту'; end if;
 select * into c from campaigns where slug=p_slug for share;
 if c.id is null or public_campaign(p_slug) is null then raise exception 'Реєстрацію на цей набір закрито'; end if;
 if octet_length(p_data::text)>16000 then raise exception 'Завеликий запит'; end if;
 for f in select * from registration_form_fields where campaign_id=c.id and enabled order by position loop
   v:=trim(coalesce(p_data->>f.key,''));
   if f.required and v='' then raise exception 'Заповніть поле: %',f.label; end if;
   if length(v)>2000 then raise exception 'Завелике значення поля'; end if;
   if v<>'' then
     if f.key='age' then
       if v !~ '^\d{1,2}$' then raise exception 'Перевірте вік'; end if;
       if v::int<c.min_age or v::int>c.max_age then raise exception 'Вік не відповідає набору'; end if;
     elsif f.key='phone' then
       if v !~ '^\+?[0-9 ()-]{9,25}$' then raise exception 'Перевірте телефон'; end if;
       v:=regexp_replace(v,'[^0-9]','','g');
       if length(v)<9 or length(v)>15 then raise exception 'Перевірте телефон'; end if;
     elsif f.key='telegram' then
       if v !~ '^@?[A-Za-z0-9_]{5,32}$' then raise exception 'Перевірте Telegram'; end if;
       v:=lower(ltrim(v,'@'));
     end if;
   end if;
   clean:=clean || jsonb_build_object(f.key,v);
 end loop;
 insert into leads(campaign_id,first_name,last_name,age,phone,telegram,parent_name,comment,submission_id) values(c.id,coalesce(clean->>'first_name',''),coalesce(clean->>'last_name',''),nullif(clean->>'age','')::int,coalesce(clean->>'phone',''),coalesce(clean->>'telegram',''),coalesce(clean->>'parent_name',''),coalesce(clean->>'comment',''),p_submission_id) on conflict(submission_id) do nothing;
 return true; end; $$;

create function public.convert_student(p_lead_id uuid) returns uuid language plpgsql security definer set search_path=public as $$ declare l leads; sid uuid; begin
 if not is_staff() then raise exception 'Доступ заборонено'; end if;
 select * into l from leads where id=p_lead_id for update;
 if l.id is null or l.status<>'Записаний' then raise exception 'Спочатку встановіть статус Записаний'; end if;
 insert into students(lead_id,first_name,last_name,age,phone,telegram) values(l.id,l.first_name,l.last_name,l.age,l.phone,l.telegram) on conflict(lead_id) do update set lead_id=excluded.lead_id returning id into sid;
 if l.group_id is not null then insert into group_students(group_id,student_id) values(l.group_id,sid) on conflict do nothing; end if;
 return sid; end; $$;
create function public.sync_student_group() returns trigger language plpgsql security definer set search_path=public as $$ declare sid uuid; begin
 select id into sid from students where lead_id=new.id;
 if sid is not null and new.group_id is distinct from old.group_id then
 delete from group_students where student_id=sid and group_id=old.group_id;
 if new.group_id is not null then insert into group_students(group_id,student_id) values(new.group_id,sid) on conflict do nothing; end if;
 end if; return new; end; $$;
create trigger sync_group after update of group_id on leads for each row execute function sync_student_group();

revoke execute on all functions in schema public from public;
grant execute on function is_staff(),is_admin() to authenticated;
grant execute on function public_campaign(text),submit_registration(text,jsonb,uuid) to anon,authenticated;
grant execute on function convert_student(uuid) to authenticated;
