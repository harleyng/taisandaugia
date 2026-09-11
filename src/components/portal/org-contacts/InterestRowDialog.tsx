import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CategoryMultiSelect, ProvinceMultiSelect } from "./InterestPickers";
import { useSaveContactInterest } from "@/hooks/useOrgContactInterests";
import { groupNumber } from "@/lib/advertising/slug";
import { interestSummary } from "@/lib/orgContacts/interestLabel";
import type { OrgContactInterest } from "@/types/org-contacts";

const toText = (v: number | null | undefined) => (v == null ? "" : groupNumber(v));
const toAmount = (s: string): number | null => {
  const digits = s.replace(/[^\d]/g, "");
  return digits === "" ? null : Number(digits);
};

function MoneyInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Input
        value={value}
        inputMode="numeric"
        placeholder={placeholder}
        className="pr-7"
        onChange={(e) => {
          const amount = toAmount(e.target.value);
          onChange(amount == null ? "" : groupNumber(amount));
        }}
      />
      <span className="pointer-events-none absolute right-2.5 top-2.5 text-sm text-muted-foreground">₫</span>
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  editing: OrgContactInterest | null;
}

export function InterestRowDialog({ open, onOpenChange, contactId, editing }: Props) {
  const save = useSaveContactInterest();
  const [categories, setCategories] = useState<string[]>([]);
  const [provinces, setProvinces] = useState<string[]>([]);
  const [minText, setMinText] = useState("");
  const [maxText, setMaxText] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setCategories(editing?.categories ?? []);
    setProvinces(editing?.provinces ?? []);
    setMinText(toText(editing?.price_min));
    setMaxText(toText(editing?.price_max));
    setNote(editing?.note ?? "");
  }, [open, editing]);

  const draft = { categories, provinces, price_min: toAmount(minText), price_max: toAmount(maxText) };
  const empty = !categories.length && !provinces.length && draft.price_min == null && draft.price_max == null;
  const badOrder = draft.price_min != null && draft.price_max != null && draft.price_min > draft.price_max;

  const submit = () =>
    save.mutate(
      { id: editing?.id, contactId, fields: { ...draft, note: note.trim() || null } },
      { onSuccess: () => onOpenChange(false) },
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Sửa nhu cầu" : "Thêm nhu cầu"}</DialogTitle>
          <DialogDescription>
            Mọi tiêu chí trong một nhu cầu phải cùng khớp. Để trống một tiêu chí nghĩa là không giới hạn.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Loại tài sản</Label>
            <CategoryMultiSelect selected={categories} onChange={setCategories} />
          </div>
          <div className="space-y-1.5">
            <Label>Tỉnh/thành có tài sản</Label>
            <ProvinceMultiSelect selected={provinces} onChange={setProvinces} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Giá khởi điểm từ</Label>
              <MoneyInput value={minText} onChange={setMinText} placeholder="Không giới hạn" />
            </div>
            <div className="space-y-1.5">
              <Label>Đến</Label>
              <MoneyInput value={maxText} onChange={setMaxText} placeholder="Không giới hạn" />
            </div>
          </div>
          {badOrder && <p className="text-xs text-destructive">Giá từ phải nhỏ hơn hoặc bằng giá đến.</p>}
          <div className="space-y-1.5">
            <Label>Ghi chú</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: mua để kinh doanh" />
          </div>
          <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {empty ? "Chọn ít nhất một tiêu chí." : `Sẽ khớp: ${interestSummary(draft)}`}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button onClick={submit} disabled={empty || badOrder || save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lưu nhu cầu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
