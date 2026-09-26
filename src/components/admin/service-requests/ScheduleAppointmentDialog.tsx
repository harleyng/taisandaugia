import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const toLocalInput = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Hẹn / dời lịch đối tác tới hiện trường (VR chụp tour, giám định tại chỗ). Người bán thấy lịch trong hồ sơ. */
export function ScheduleAppointmentDialog({
  title,
  noteLabel,
  notePlaceholder,
  noteMinLength = 0,
  initialAt,
  initialNote,
  open,
  onOpenChange,
  isPending,
  onSubmit,
}: {
  title: string;
  noteLabel: string;
  notePlaceholder: string;
  /** VR bắt buộc ghi địa điểm (≥ 5 ký tự); giám định tại chỗ thì không. */
  noteMinLength?: number;
  initialAt: string | null;
  initialNote: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isPending: boolean;
  onSubmit: (v: { appointmentAt: string; note: string }) => Promise<unknown>;
}) {
  const [at, setAt] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setAt(toLocalInput(initialAt));
    setNote(initialNote);
  }, [open, initialAt, initialNote]);

  const submit = () =>
    onSubmit({ appointmentAt: new Date(at).toISOString(), note: note.trim() }).then(
      () => onOpenChange(false),
      // Lỗi đã được toast ở hook; giữ dialog mở để sửa lại.
      (): void => undefined,
    );

  return (
    <Dialog open={open} onOpenChange={(v) => !isPending && onOpenChange(v)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Người bán thấy lịch này trong hồ sơ tài sản.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="appt-at">Thời điểm hẹn</Label>
            <Input id="appt-at" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="appt-note">{noteLabel}</Label>
            <Textarea
              id="appt-note"
              rows={3}
              maxLength={1000}
              value={note}
              placeholder={notePlaceholder}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Huỷ
          </Button>
          <Button disabled={!at || note.trim().length < noteMinLength || isPending} onClick={submit}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lưu lịch hẹn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
