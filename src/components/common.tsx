"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Inbox, LoaderCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
export function useMutation() {
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const router = useRouter();
  async function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    success = "Зміни збережено",
  ) {
    if (lock.current) return false;
    lock.current = true;
    setPending(true);
    try {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error || "Не вдалося виконати дію");
        return false;
      }
      toast.success(success);
      router.refresh();
      return true;
    } catch {
      toast.error("Не вдалося виконати дію. Перевірте з’єднання.");
      return false;
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return { pending, run };
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={"badge badge-" + tone}>{children}</span>;
}
export function statusTone(status: string) {
  return status === "Нова"
    ? "purple"
    : status === "Записаний" || status === "Активний"
      ? "green"
      : status === "Не відповідають" || status === "Думають"
        ? "amber"
        : status === "Відмовились"
          ? "red"
          : "neutral";
}
export function Empty({
  title = "Тут поки порожньо",
  description = "Додайте перший запис, щоб розпочати роботу.",
  children,
}: {
  title?: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Inbox size={34} />
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}
export function Confirm({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  pending = false,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  pending?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Скасувати
          </Button>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending && <LoaderCircle className="spin" size={16} />}Підтвердити
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
