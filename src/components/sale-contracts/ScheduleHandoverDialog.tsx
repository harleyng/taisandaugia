import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const toLocalInput = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function ScheduleHandoverDialog({
  open, onOpenChange, defaultAt, defaultLocation, isPending, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultAt: string | null;
  defaultLocation: string | null;
  isPending: boolean;
  onSubmit: (v: { handoverAt: string; location: string }) => void;
}) {
  const [at, setAt] = useState("");
  const [location, setLocation] = useState("");

  useEffect(() => {
    if (!open) return;
    setAt(toLocalInput(defaultAt));
    setLocation(defaultLocation ?? "");
  }, [open, defaultAt, defaultLocation]);

  return (
    <Dialog open={open} onOpenChange={(v) => !isPending && onOpenChange(v)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hẹn lịch bàn giao tài sản</DialogTitle>
          <DialogDescription>
            Bên mua và bên bán sẽ thấy lịch này và xác nhận sau khi bàn giao xong.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sale-handover-at">Thời điểm bàn giao</Label>
            <Input
              id="sale-handover-at"
              type="datetime-local"
              value={at}
              disabled={isPending}
              onChange={(e) => setAt(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sale-handover-place">Địa điểm</Label>
            <Input
              id="sale-handover-place"
              value={location}
              disabled={isPending}
              placeholder="Tại vị trí tài sản / trụ sở tổ chức đấu giá…"
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Huỷ
          </Button>
          <Button
            type="button"
            disabled={!at || isPending}
            onClick={() => onSubmit({ handoverAt: new Date(at).toISOString(), location: location.trim() })}
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            Lưu lịch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
