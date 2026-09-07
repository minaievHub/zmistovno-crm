"use client";
import { useState } from "react";
import { ExternalLink, Link2, Plus, Trash2 } from "lucide-react";
import { saveEntity, removeEntities } from "@/app/actions";
import { useMutation, Confirm } from "@/components/common";
import { Button } from "@/components/ui/button";
import type { EntityLink } from "@/types/crm";
export function LinksPanel({
  links,
  entityType,
  entityId,
}: {
  links: EntityLink[];
  entityType: EntityLink["entity_type"];
  entityId: string;
}) {
  const [adding, setAdding] = useState(false);
  const [edit, setEdit] = useState<EntityLink | null>(null);
  const [remove, setRemove] = useState<string | null>(null);
  const { pending, run } = useMutation();
  return (
    <section className="card links-panel">
      <div className="card-heading">
        <h2>
          <Link2 size={19} />
          Корисні посилання
        </h2>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setEdit(null);
            setAdding(!adding);
          }}
        >
          <Plus size={16} />
          Додати
        </Button>
      </div>
      {links.length === 0 && !adding && (
        <p className="muted">
          Додайте Telegram, Zoom, Google Meet або інше посилання.
        </p>
      )}
      {links.map((l) => (
        <div className="link-row" key={l.id}>
          <a href={l.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={15} />
            {l.label}
          </a>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEdit(l);
              setAdding(true);
            }}
          >
            Змінити
          </Button>
          <button
            className="icon-button"
            aria-label={"Видалити " + l.label}
            onClick={() => setRemove(l.id)}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      {adding && (
        <form
          className="entity-form"
          key={edit?.id || "new"}
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            if (
              await run(() =>
                saveEntity("links", edit?.id || null, {
                  label: f.get("label"),
                  url: f.get("url"),
                  type: f.get("type"),
                  entity_type: entityType,
                  entity_id: entityId,
                }),
              )
            )
              setAdding(false);
          }}
        >
          <label>
            Назва
            <input
              name="label"
              defaultValue={edit?.label}
              required
              placeholder="Telegram групи"
            />
          </label>
          <label>
            Посилання
            <input
              name="url"
              type="url"
              defaultValue={edit?.url}
              required
              placeholder="https://…"
            />
          </label>
          <label>
            Тип
            <select name="type" defaultValue={edit?.type || "telegram"}>
              {["telegram", "zoom", "meet", "website", "custom"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <Button disabled={pending}>Зберегти посилання</Button>
        </form>
      )}
      <Confirm
        open={!!remove}
        onOpenChange={() => setRemove(null)}
        title="Видалити посилання?"
        description="Посилання буде видалено з цього запису."
        pending={pending}
        onConfirm={async () => {
          if (remove && (await run(() => removeEntities("links", [remove]))))
            setRemove(null);
        }}
      />
    </section>
  );
}
