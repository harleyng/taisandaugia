import type { UseFormReturn } from "react-hook-form";
import { Lock } from "lucide-react";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SessionFormValues } from "@/lib/auctionSessions/sessionForm";
import {
  BIDDING_METHOD_DESCRIPTIONS,
  BIDDING_METHOD_LABELS,
  BIDDING_METHODS,
  type BiddingMethod,
} from "@/lib/bidding/methods";
import { FormSection, SuffixNumberInput } from "./formParts";

type Form = UseFormReturn<SessionFormValues>;

/** 4 · Hồ sơ tham gia — giá bán hồ sơ + số người tối đa. */
export function SessionDossierSection({ form, no, saleReady }: { form: Form; no: number; saleReady: boolean | undefined }) {
  return (
    <FormSection no={no} title="Hồ sơ tham gia" description="Giới hạn số người và phí hồ sơ người mua trả qua sàn.">
      <div className="grid gap-3.5 md:grid-cols-2">
        <FormField
          control={form.control}
          name="dossier_fee"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Giá bán hồ sơ</FormLabel>
              <FormControl>
                <SuffixNumberInput
                  unit="đ"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Để trống nếu không bán qua sàn"
                  invalid={!!fieldState.error}
                />
              </FormControl>
              {saleReady === false && (
                <p className="text-xs font-medium text-[hsl(var(--tier-warn-strong))]">
                  Tổ chức chưa có hợp đồng hợp tác bán hồ sơ — người mua chưa mua trực tuyến được.
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="max_registrants"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Số người đăng ký tối đa</FormLabel>
              <FormControl>
                <SuffixNumberInput
                  unit="người"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Để trống nếu không giới hạn"
                  invalid={!!fieldState.error}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </FormSection>
  );
}

/**
 * 5 · Quy tắc trả giá trực tuyến. `locked` khi lô đầu tiên đã mở —
 * auction_sessions_bidding_guard từ chối đổi các cột này từ lúc đó.
 * Mỗi phương thức chỉ hiện (và chỉ kiểm) trường của nó.
 */
export function SessionRulesSection({ form, no, locked }: { form: Form; no: number; locked: boolean }) {
  const method = form.watch("bidding_method");
  return (
    <FormSection
      no={no}
      title="Quy tắc trả giá trực tuyến"
      description="Bị khoá khi tài sản đầu tiên được mở — kiểm tra kỹ trước ngày đấu."
    >
      {locked && (
        <div className="flex items-start gap-2.5 rounded-[10px] bg-muted px-3.5 py-3 text-[13px] font-medium text-muted-foreground">
          <Lock className="mt-px h-4 w-4 shrink-0" />
          <span>Phiên đã bắt đầu trả giá — không đổi được quy tắc nữa.</span>
        </div>
      )}
      <div className="grid gap-3.5 md:grid-cols-3">
        <FormField
          control={form.control}
          name="bidding_method"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phương thức trả giá</FormLabel>
              <Select value={field.value} onValueChange={field.onChange} disabled={locked}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {BIDDING_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {BIDDING_METHOD_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        {method === "ascending" && (
          <>
            <FormField
              control={form.control}
              name="extension_seconds"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>Gia hạn khi có giá cuối</FormLabel>
                  <FormControl>
                    <SuffixNumberInput
                      unit="giây"
                      value={field.value}
                      onChange={field.onChange}
                      disabled={locked}
                      invalid={!!fieldState.error}
                    />
                  </FormControl>
                  <FormDescription>0 = không gia hạn.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="max_bid_steps"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>Số bước giá tối đa mỗi lượt</FormLabel>
                  <FormControl>
                    <SuffixNumberInput
                      unit="bước"
                      value={field.value}
                      onChange={field.onChange}
                      disabled={locked}
                      invalid={!!fieldState.error}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}
        {method === "descending" && (
          <FormField
            control={form.control}
            name="price_drop_seconds"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>Giảm một bước giá sau mỗi</FormLabel>
                <FormControl>
                  <SuffixNumberInput
                    unit="giây"
                    value={field.value}
                    onChange={field.onChange}
                    disabled={locked}
                    invalid={!!fieldState.error}
                  />
                </FormControl>
                <FormDescription>Từ 10 đến 3600 giây.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        {BIDDING_METHOD_DESCRIPTIONS[method as BiddingMethod] ?? ""}
        {method === "descending" && " Đặt giá sàn cho từng tài sản ở tab Tài sản."}
        {method === "sealed" && " Đấu giá viên đặt thời gian nhận phiếu khi mở từng tài sản."}
      </p>
    </FormSection>
  );
}
