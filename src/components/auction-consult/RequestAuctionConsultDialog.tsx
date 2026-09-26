import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { WideRadio } from "@/components/asset-posting/fields";
import { useAuctionConsultPackage, useRequestAuctionConsult } from "@/hooks/useAuctionConsultations";
import { formatVnd } from "@/lib/advertising/slug";
import { SALE_GOAL_OPTIONS } from "@/lib/auctionConsult/labels";
import {
  requestConsultSchema,
  requestDefaults,
  type RequestConsultPrefill,
  type RequestConsultValues,
} from "@/lib/auctionConsult/requestForm";
import { AUCTION_FORMAT_LABELS, EXPECTED_TIMELINE_LABELS, type AuctionFormat, type ExpectedTimeline } from "@/types/asset-posting";

export interface AuctionConsultPrefill extends RequestConsultPrefill {
  auctionFormat?: string | null;
}

interface RequestAuctionConsultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Trả id hồ sơ — trong wizard tự lưu nháp nếu chưa có. null = chưa lưu được (hàm tự báo lỗi). */
  resolvePostingId: () => Promise<string | null>;
  prefill?: AuctionConsultPrefill;
  /** Đã có đề xuất ⇒ yêu cầu phiên bản mới. */
  isFollowUp: boolean;
}

const Err = ({ msg }: { msg?: string }) => (msg ? <p className="text-xs text-destructive">{msg}</p> : null);
const NONE = "__none__";

/** "Tư vấn đấu giá": mục tiêu bán + kỳ vọng ⇒ gửi cho sàn phân công chuyên gia & báo giá. */
export function RequestAuctionConsultDialog({
  open,
  onOpenChange,
  resolvePostingId,
  prefill,
  isFollowUp,
}: RequestAuctionConsultDialogProps) {
  const { data: pkg, isLoading, error } = useAuctionConsultPackage(open);
  const request = useRequestAuctionConsult();
  const [preparing, setPreparing] = useState(false);
  const form = useForm<RequestConsultValues>({
    resolver: zodResolver(requestConsultSchema),
    defaultValues: requestDefaults(prefill),
  });
  const { control, register, handleSubmit, reset, formState } = form;
  const errors = formState.errors;

  // Mở lại dialog: nạp giá / tiến độ mới nhất người bán vừa nhập ở wizard.
  useEffect(() => {
    if (open) reset(requestDefaults(prefill));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const busy = preparing || request.isPending;
  const format = prefill?.auctionFormat as AuctionFormat | undefined;

  const submit = handleSubmit(async (v) => {
    setPreparing(true);
    const postingId = await resolvePostingId();
    setPreparing(false);
    if (!postingId) return;
    request.mutate(
      {
        postingId,
        saleGoal: v.saleGoal,
        expectedPrice: v.expectedPrice ? Number(v.expectedPrice) : null,
        minPrice: v.minPrice ? Number(v.minPrice) : null,
        timeline: v.timeline || null,
        deadline: v.deadline || null,
        note: v.note,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isFollowUp ? "Yêu cầu phương án mới" : "Tư vấn đấu giá"}</DialogTitle>
          <DialogDescription>
            Chuyên gia đề xuất hình thức, giá khởi điểm / giá bảo lưu, bước giá, thời lượng và tiền đặt trước phù hợp mục
            tiêu của bạn. Sàn gửi báo giá chính thức trước khi bạn thanh toán.
            {isFollowUp && " Đề xuất hiện tại vẫn được lưu và xem lại được."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải dịch vụ…
          </div>
        ) : error || !pkg ? (
          <p className="flex items-start gap-2 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            Dịch vụ tư vấn đấu giá đang tạm ngưng nhận yêu cầu. Vui lòng thử lại sau.
          </p>
        ) : (
          <form id="tvdg-request" className="space-y-4" onSubmit={submit}>
            <p className="text-xs text-muted-foreground">
              {pkg.name} · tham khảo từ <span className="font-semibold text-foreground">{formatVnd(pkg.from_price)}</span>
            </p>

            <div className="space-y-2">
              <Label>Mục tiêu bán</Label>
              <Controller
                control={control}
                name="saleGoal"
                render={({ field }) => (
                  <div className="grid gap-2 sm:grid-cols-3">
                    {SALE_GOAL_OPTIONS.map((o) => (
                      <WideRadio key={o.value} className="h-full" on={field.value === o.value} onClick={() => field.onChange(o.value)}>
                        <span className="block text-sm font-semibold text-foreground">{o.label}</span>
                        <span className="block text-xs text-muted-foreground">{o.desc}</span>
                      </WideRadio>
                    ))}
                  </div>
                )}
              />
              <Err msg={errors.saleGoal?.message} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tvdg-expected">
                  Giá mong muốn (₫) <span className="font-normal text-muted-foreground">(tuỳ chọn)</span>
                </Label>
                <Controller
                  control={control}
                  name="expectedPrice"
                  render={({ field }) => (
                    <NumberInput id="tvdg-expected" allowDecimal={false} value={field.value} onChange={field.onChange} />
                  )}
                />
                <Err msg={errors.expectedPrice?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tvdg-min">
                  Giá thấp nhất chấp nhận (₫) <span className="font-normal text-muted-foreground">(tuỳ chọn)</span>
                </Label>
                <Controller
                  control={control}
                  name="minPrice"
                  render={({ field }) => (
                    <NumberInput id="tvdg-min" allowDecimal={false} value={field.value} onChange={field.onChange} />
                  )}
                />
                <Err msg={errors.minPrice?.message} />
              </div>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              Giá thấp nhất chỉ bạn, chuyên gia được phân công và quản trị sàn xem được — không gửi cho tổ chức đấu giá.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tiến độ mong muốn</Label>
                <Controller
                  control={control}
                  name="timeline"
                  render={({ field }) => (
                    <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Chưa xác định</SelectItem>
                        {(Object.keys(EXPECTED_TIMELINE_LABELS) as ExpectedTimeline[]).map((k) => (
                          <SelectItem key={k} value={k}>
                            {EXPECTED_TIMELINE_LABELS[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tvdg-deadline">
                  Hạn chót bán <span className="font-normal text-muted-foreground">(tuỳ chọn)</span>
                </Label>
                <Input id="tvdg-deadline" type="date" {...register("deadline")} />
                <Err msg={errors.deadline?.message} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tvdg-note">
                Thông tin thêm cho chuyên gia <span className="font-normal text-muted-foreground">(tuỳ chọn)</span>
              </Label>
              <Textarea
                id="tvdg-note"
                rows={3}
                maxLength={2000}
                placeholder="VD: cần tiền trước Tết, đã có 2 người hỏi mua giá 12 tỷ…"
                {...register("note")}
              />
              <Err msg={errors.note?.message} />
            </div>

            <p className="rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
              Chuyên gia cũng xem thông tin tài sản hiện tại:{" "}
              {[
                format && AUCTION_FORMAT_LABELS[format] ? `hình thức ${AUCTION_FORMAT_LABELS[format]}` : null,
                prefill?.startingPrice ? `giá khởi điểm ${formatVnd(prefill.startingPrice)}` : "chưa có giá khởi điểm",
              ]
                .filter(Boolean)
                .join(" · ")}
              .
            </p>
          </form>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Đóng
          </Button>
          <Button type="submit" form="tvdg-request" disabled={!pkg || busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Gửi yêu cầu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
