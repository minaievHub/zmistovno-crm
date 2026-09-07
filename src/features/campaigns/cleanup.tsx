"use client";
import { useState } from "react";
import { BrushCleaning } from "lucide-react";
import { changeLeads, removeEntities } from "@/app/actions";
import { useMutation } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Lead } from "@/types/crm";
export function Cleanup({ leads }: { leads: Lead[] }) {
  const [open, setOpen] = useState(false),
    [mode, setMode] = useState("test");
  const { pending, run } = useMutation();
  const targets = leads.filter((l) =>
    mode === "test"
      ? l.is_test
      : mode === "keep"
        ? l.status !== "Записаний"
        : !l.archived_at,
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <BrushCleaning size={16} />
        Очистити заявки набору
      </Button>
      <DialogContent>
        <DialogTitle>Очистити заявки набору</DialogTitle>
        <DialogDescription>
          Перевірте кількість записів перед підтвердженням. Вибрані заявки можна
          обробити окремо в таблиці.
        </DialogDescription>
        <label>
          Дія
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="test">Видалити тестові назавжди</option>
            <option value="archive">Архівувати всі</option>
            <option value="keep">
              Залишити тільки записаних (решту архівувати)
            </option>
          </select>
        </label>
        <p className="notice">
          Буде оброблено <strong>{targets.length}</strong> заявок.
          {mode === "test"
            ? " Видалені заявки та примітки неможливо відновити."
            : " Записи можна буде відновити з архіву."}
        </p>
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Скасувати
          </Button>
          <Button
            variant={mode === "test" ? "destructive" : "default"}
            disabled={pending || targets.length === 0}
            onClick={async () => {
              if (
                await run(() =>
                  mode === "test"
                    ? removeEntities(
                        "leads",
                        targets.map((l) => l.id),
                      )
                    : changeLeads(
                        targets.map((l) => l.id),
                        { archived_at: new Date().toISOString() },
                      ),
                )
              )
                setOpen(false);
            }}
          >
            Підтвердити обробку
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
