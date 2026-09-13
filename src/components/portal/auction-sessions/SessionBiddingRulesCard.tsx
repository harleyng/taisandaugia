import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Lock, Save } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { NumberInput } from "@/components/ui/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InfoBox } from "@/components/shared/InfoBox";
import { useSaveSessionBiddingRules, useSessionBiddingStarted } from "@/hooks/useAuctionSessions";
import type { AuctionSession } from "@/types/auction-session";

/**
 * Quy tắc trả giá trực tuyến của phiên.
 *
 * Thẻ RIÊNG chứ không nhét vào SessionFormCard: ba cột này bị
 * auction_sessions_bidding_guard khoá ngay khi lô đầu tiên rời trạng thái chờ,
 * trong khi tên phiên / địa điểm thì vẫn sửa được. Gộp chung một nút Lưu là
 * biến cả form thành bất khả dụng giữa phiên.
 *
 * Khoá form TRƯỚC khi người dùng gõ (auction_session_bidding_started) thay vì
 * để họ điền xong rồi nhận lỗi từ trigger — server vẫn là cổng thật, đây chỉ là
 * đúng thứ tự lịch sự.
 */

// Khớp CHECK trên auction_sessions (20260913000001).
const schema = z.object({
  bidding_method: z.literal("ascending"),
  extension_seconds: z
    .string()
    .refine((v) => /^\d+$/.test(v) && Number(v) >= 0 && Number(v) <= 3600, "Nhập số giây từ 0 đến 3600"),
  max_bid_steps: z
    .string()
    .refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 100, "Nhập số bước từ 1 đến 100"),
});

type Values = z.infer<typeof schema>;

const METHODS = [
  { value: "ascending", label: "Trả giá lên", available: true },
  { value: "descending", label: "Đặt giá xuống — sắp ra mắt", available: false },
  { value: "sealed", label: "Bỏ phiếu kín — sắp ra mắt", available: false },
];

interface Props {
  session: AuctionSession;
  readOnly: boolean;
  /** Lưu xong ⇒ tab Thông tin thoát chế độ sửa. */
  onSaved?: () => void;
  /** Có truyền thì hiện nút "Huỷ" cạnh nút Lưu. */
  onCancel?: () => void;
}

export function SessionBiddingRulesCard({ session, readOnly, onSaved, onCancel }: Props) {
  const save = useSaveSessionBiddingRules();
  const { data: biddingStarted } = useSessionBiddingStarted(session.id);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      bidding_method: "ascending",
      extension_seconds: String(session.extension_seconds),
      max_bid_steps: String(session.max_bid_steps),
    },
  });

  const locked = readOnly || biddingStarted === true;
  const busy = save.isPending;

  const onSubmit = (values: Values) =>
    save.mutate(
      {
        id: session.id,
        rules: {
          bidding_method: values.bidding_method,
          extension_seconds: Number(values.extension_seconds),
          max_bid_steps: Number(values.max_bid_steps),
        },
      },
      { onSuccess: () => onSaved?.() },
    );

  return (
    <Card className="rounded-2xl p-5">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <h2 className="font-semibold text-foreground">Quy tắc trả giá trực tuyến</h2>
            <p className="text-xs text-muted-foreground">
              Áp dụng cho phiên trực tuyến và phiên kết hợp. Người tham gia thấy các quy tắc này trong phòng đấu giá.
            </p>
          </div>

          {biddingStarted === true && (
            <InfoBox variant="amber" className="flex items-start gap-2 text-sm">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Phiên đã bắt đầu trả giá — không đổi được quy tắc nữa. Đổi luật giữa chừng là làm sai lệch kết quả của
                những lượt đã trả.
              </span>
            </InfoBox>
          )}

          <fieldset disabled={locked || busy} className="grid gap-4 md:grid-cols-3">
            <FormField
              control={form.control}
              name="bidding_method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hình thức trả giá</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={locked || busy}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value} disabled={!m.available}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Mỗi lượt cao hơn giá hiện tại ít nhất một bước giá.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="extension_seconds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Thời gian gia hạn (giây)</FormLabel>
                  <FormControl>
                    <NumberInput value={field.value} onChange={field.onChange} allowDecimal={false} />
                  </FormControl>
                  <FormDescription>
                    Có lượt trả giá trong khoảng này trước giờ đóng thì lô tự gia hạn thêm bấy nhiêu. 0 = không gia hạn.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="max_bid_steps"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Số bước giá tối đa mỗi lượt</FormLabel>
                  <FormControl>
                    <NumberInput value={field.value} onChange={field.onChange} allowDecimal={false} />
                  </FormControl>
                  <FormDescription>
                    Chặn trần một lượt trả giá, tránh gõ nhầm số 0. Tính cả bước đầu tiên.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </fieldset>

          {!locked && (
            <div className="flex justify-end gap-2">
              {onCancel && (
                <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
                  Huỷ
                </Button>
              )}
              <Button type="submit" disabled={busy} className="gap-1.5">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Lưu quy tắc
              </Button>
            </div>
          )}
        </form>
      </Form>
    </Card>
  );
}
