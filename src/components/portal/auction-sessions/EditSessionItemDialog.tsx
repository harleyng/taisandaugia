import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { useUpdateSessionItem } from "@/hooks/useAuctionSessions";
import type { AuctionSessionItem } from "@/types/auction-session";

interface Props {
  item: AuctionSessionItem | null;
  onOpenChange: (open: boolean) => void;
}

const digits = (v: number | null) => (v != null ? String(v) : "");
const toNumber = (s: string) => (s ? Number(s) : null);

const MONEY_FIELDS = [
  { key: "starting_price", label: "Giá khởi điểm (₫)" },
  { key: "deposit_amount", label: "Tiền đặt trước (₫)" },
  { key: "bid_step", label: "Bước giá (₫)" },
] as const;

type MoneyKey = (typeof MONEY_FIELDS)[number]["key"];

/** Sửa snapshot của một lô: tên, giá, tiền đặt trước, bước giá, giới hạn người đăng ký. */
export function EditSessionItemDialog({ item, onOpenChange }: Props) {
  const update = useUpdateSessionItem();
  const [title, setTitle] = useState("");
  const [money, setMoney] = useState<Record<MoneyKey, string>>({ starting_price: "", deposit_amount: "", bid_step: "" });
  const [maxRegistrants, setMaxRegistrants] = useState("");

  useEffect(() => {
    if (!item) return;
    setTitle(item.title);
    setMoney({
      starting_price: digits(item.starting_price),
      deposit_amount: digits(item.deposit_amount),
      bid_step: digits(item.bid_step),
    });
    setMaxRegistrants(digits(item.max_registrants));
  }, [item]);

  const submit = () => {
    if (!item) return;
    if (!title.trim()) return toast.error("Tên tài sản không được để trống.");
    if (maxRegistrants && Number(maxRegistrants) <= 0) return toast.error("Số người đăng ký tối đa phải lớn hơn 0.");
    update.mutate(
      {
        id: item.id,
        sessionId: item.session_id,
        patch: {
          title: title.trim(),
          starting_price: toNumber(money.starting_price),
          deposit_amount: toNumber(money.deposit_amount),
          bid_step: toNumber(money.bid_step),
          max_registrants: toNumber(maxRegistrants),
        },
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sửa lô {item?.lot_no}</DialogTitle>
          <DialogDescription>Chỉ đổi thông tin hiển thị trong phiên — tài sản nguồn không bị ảnh hưởng.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label>
              Tên tài sản <span className="text-destructive">*</span>
            </Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {MONEY_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label>{f.label}</Label>
                <NumberInput
                  value={money[f.key]}
                  onChange={(v) => setMoney((m) => ({ ...m, [f.key]: v }))}
                  allowDecimal={false}
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label>Người đăng ký tối đa</Label>
              <NumberInput
                value={maxRegistrants}
                onChange={setMaxRegistrants}
                allowDecimal={false}
                placeholder="Theo giới hạn của phiên"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={update.isPending}>
            Huỷ
          </Button>
          <Button onClick={submit} disabled={update.isPending} className="gap-1.5">
            {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
