import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NumberInput } from "@/components/ui/number-input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { vietnamProvinces } from "@/constants/vietnam-locations";
import { AUCTION_FORMAT_LABELS } from "@/types/asset-posting";
import { useSaveAuctionSession } from "@/hooks/useAuctionSessions";
import { useDossierSaleReady } from "@/hooks/useOrgBiddingContracts";
import {
  defaultSessionForm,
  formToSessionInput,
  LEGACY_FORMAT_MESSAGE,
  SESSION_FORMATS,
  sessionFormSchema,
  sessionToForm,
  type SessionFormValues,
} from "@/lib/auctionSessions/sessionForm";
import type { AuctionSession } from "@/types/auction-session";
import { SessionScheduleFields } from "./SessionScheduleFields";

const PROVINCES = vietnamProvinces.map((p) => p.name);
const NO_PROVINCE = "__none__";
interface Props {
  session: AuctionSession | null;
  readOnly: boolean;
  /** Chỉ dùng khi tạo mới: điều hướng sang phiên vừa tạo. */
  onCreated?: (id: string) => void;
  /** Lưu xong một phiên đã có ⇒ tab Thông tin thoát chế độ sửa. */
  onSaved?: () => void;
  /** Có truyền thì hiện nút "Huỷ" cạnh nút Lưu. */
  onCancel?: () => void;
}

/**
 * Thông tin chung + lịch phiên. Parent gắn `key` theo id + updated_at nên form
 * dựng lại khi server trả bản mới — không cần effect reset.
 */
export function SessionFormCard({ session, readOnly, onCreated, onSaved, onCancel }: Props) {
  const save = useSaveAuctionSession();
  const { data: saleReady } = useDossierSaleReady();
  const form = useForm<SessionFormValues>({
    resolver: zodResolver(sessionFormSchema),
    defaultValues: session ? sessionToForm(session) : defaultSessionForm(),
  });
  const busy = save.isPending;
  const province = form.watch("province");
  const provinceOptions = province && !PROVINCES.includes(province) ? [province, ...PROVINCES] : PROVINCES;

  const onSubmit = (values: SessionFormValues) => {
    save.mutate(
      { id: session?.id, input: formToSessionInput(values) },
      { onSuccess: ({ id, created }) => (created ? onCreated?.(id) : onSaved?.()) },
    );
  };

  return (
    <Card className="rounded-2xl p-5">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <fieldset disabled={readOnly || busy} className="space-y-5">
            <div>
              <h2 className="font-semibold text-foreground">Thông tin phiên</h2>
              <p className="text-xs text-muted-foreground">Người mua thấy toàn bộ thông tin này khi phiên được công bố.</p>
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Tên phiên <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="VD: Phiên đấu giá bất động sản tháng 10/2026" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mô tả</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Điều kiện tham gia, lưu ý cho người đăng ký…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="auction_format"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hình thức</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={readOnly || busy}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SESSION_FORMATS.map((value) => (
                          <SelectItem key={value} value={value}>
                            {AUCTION_FORMAT_LABELS[value]}
                          </SelectItem>
                        ))}
                        {/* Phiên cũ: vẫn hiện nhãn, không chọn lại được. */}
                        {field.value === "ca_hai" && (
                          <SelectItem value="ca_hai" disabled>
                            {AUCTION_FORMAT_LABELS.ca_hai}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {field.value === "ca_hai" && !readOnly && !form.formState.errors.auction_format && (
                      <FormDescription>{LEGACY_FORMAT_MESSAGE}.</FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="province"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tỉnh / thành</FormLabel>
                    <Select
                      value={field.value || NO_PROVINCE}
                      onValueChange={(v) => field.onChange(v === NO_PROVINCE ? "" : v)}
                      disabled={readOnly || busy}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_PROVINCE}>Chưa chọn</SelectItem>
                        {provinceOptions.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="max_registrants"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Số người đăng ký tối đa</FormLabel>
                    <FormControl>
                      <NumberInput
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        allowDecimal={false}
                        placeholder="Để trống nếu không giới hạn"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="venue"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Địa điểm tổ chức</FormLabel>
                    <FormControl>
                      <Input placeholder="VD: Hội trường tầng 3, trụ sở công ty" {...field} />
                    </FormControl>
                    <FormDescription>Phiên trực tuyến có thể ghi nền tảng đấu giá sử dụng.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dossier_fee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Giá bán hồ sơ (₫)</FormLabel>
                    <FormControl>
                      <NumberInput
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        allowDecimal={false}
                        placeholder="Để trống nếu không bán qua sàn"
                      />
                    </FormControl>
                    {saleReady === false ? (
                      <p className="text-xs text-warning">
                        Tổ chức chưa có hợp đồng hợp tác bán hồ sơ với sàn — người mua chưa mua trực tuyến được.
                      </p>
                    ) : (
                      <FormDescription>Người mua trả qua sàn; sàn thu hộ theo hợp đồng hợp tác.</FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <SessionScheduleFields form={form} checkinLocked={!!session?.roster_closed_at} />
          </fieldset>

          {!readOnly && (
            <div className="flex justify-end gap-2">
              {onCancel && (
                <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
                  Huỷ
                </Button>
              )}
              <Button type="submit" disabled={busy} className="gap-1.5">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {session ? "Lưu thay đổi" : "Lưu nháp"}
              </Button>
            </div>
          )}
        </form>
      </Form>
    </Card>
  );
}
