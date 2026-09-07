"use client";
import { useState } from "react";
import { GripVertical, ChevronDown, ChevronUp } from "lucide-react";
import { saveEntity } from "@/app/actions";
import { useMutation } from "@/components/common";
import { Button } from "@/components/ui/button";
import type { FormField } from "@/types/crm";
export function FormBuilder({ fields }: { fields: FormField[] }) {
  return (
    <section className="card">
      <div className="card-heading">
        <div>
          <h2>Форма реєстрації</h2>
          <p className="muted">Налаштуйте поля, які побачать батьки.</p>
        </div>
      </div>
      <div className="builder-list">
        {[...fields]
          .sort((a, b) => a.position - b.position)
          .map((f) => (
            <FieldEditor key={f.id + JSON.stringify(f)} field={f} />
          ))}
      </div>
    </section>
  );
}
function FieldEditor({ field }: { field: FormField }) {
  const [f, setF] = useState(field);
  const { pending, run } = useMutation();
  const [open, setOpen] = useState(false);
  return (
    <div className="builder-field">
      <div className="builder-row">
        <GripVertical size={18} className="muted" />
        <strong>{field.label}</strong>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={f.enabled}
            onChange={(e) => setF({ ...f, enabled: e.target.checked })}
          />
          Показувати
        </label>
        <button
          className="icon-button"
          aria-label="Налаштувати поле"
          onClick={() => setOpen(!open)}
        >
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>
      {open && (
        <div className="form-grid">
          <label>
            Назва
            <input
              value={f.label}
              onChange={(e) => setF({ ...f, label: e.target.value })}
            />
          </label>
          <label>
            Підказка
            <input
              value={f.placeholder}
              onChange={(e) => setF({ ...f, placeholder: e.target.value })}
            />
          </label>
          <label>
            Порядок
            <input
              type="number"
              min={0}
              max={100}
              value={f.position}
              onChange={(e) => setF({ ...f, position: Number(e.target.value) })}
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={f.required}
              onChange={(e) => setF({ ...f, required: e.target.checked })}
            />
            Обов’язкове поле
          </label>
        </div>
      )}
      {JSON.stringify(f) !== JSON.stringify(field) && (
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            run(() =>
              saveEntity("registration_form_fields", f.id, {
                label: f.label,
                placeholder: f.placeholder,
                required: f.required,
                enabled: f.enabled,
                position: f.position,
              }),
            )
          }
        >
          Зберегти поле
        </Button>
      )}
    </div>
  );
}
