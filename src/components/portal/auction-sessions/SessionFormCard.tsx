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
import { toLocalInput } from "@/lib/auctionSessions/datetime";
import {
  defaultSessionForm,
  formToSessionInput,
  sessionFormSchema,
  sessionToForm,
  type SessionFormValues,
} from "@/lib/auctionSessions/sessionForm";
import type { AuctionSession } from "@/types/auction-session";

const PROVINCES = vietnamProvinces.map((p) => p.name);
const NO_PROVINCE = "__none__";
const TWO_HOURS = 2 * 60 * 60 * 1000;

type DateField =
  | "registration_start_at"
  | "registration_end_at"
  | "viewing_start_at"
  | "viewing_end_at"
  | "starts_at"
  | "ends_at";

const DATE_GROUPS: { label: string; from: DateField; to: DateField; required?: boolean }[] = [
  { label: "Bán & nhận hồ sơ", from: "registration_start_at", to: "registration_end_at" },
  { label: "Xem tài sản", from: "viewing_start_at", to: "viewing_end_at" },
  { label: "Thời gian đấu giá", from: "starts_at", to: "ends_at", required: true },
];

interface Props {
  session: AuctionSession | null;
  readOnly: boolean;
  onCreated: (id: string) => void;
}

/**
 * Thông tin chung + lịch phiên. Parent gắn `key` theo id + updated_at nên form
 * dựng lại khi server trả bản mới — không cần effect reset.
 */
export function SessionFormCard({ session, readOnly, onCreated }: Props) {
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
      { onSuccess: ({ id, created }) => created && onCreated(id) },
    );
  };

  // Dời giờ bắt đầu qua giờ kết thúc thì tự đẩy giờ kết thúc theo (+2 giờ).
  const onStartsChange = (value: string) => {
    form.setValue("starts_at", value, { shouldDirty: true, shouldValidate: true });
    const starts = Date.parse(value);
    const ends = Date.parse(form.getValues("ends_at"));
    if (!Number.isNaN(starts) && (Number.isNaN(ends) || ends <= starts)) {
      form.setValue("ends_at", toLocalInput(new Date(starts + TWO_HOURS).toISOString()), {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
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
                        {Object.entries(AUCTION_FORMAT_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
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

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Lịch phiên</h3>
              {DATE_GROUPS.map((group) => (
                <div key={group.label} className="grid gap-3 md:grid-cols-[10rem_1fr_1fr] md:items-start">
                  <p className="text-sm font-medium text-foreground md:pt-8">
                    {group.label}
                    {group.required && <span className="text-destructive"> *</span>}
                  </p>
                  {([group.from, group.to] as const).map((name, i) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={name}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">{i === 0 ? "Bắt đầu" : "Kết thúc"}</FormLabel>
                          <FormControl>
                            <Input
                              type="datetime-local"
                              {...field}
                              value={field.value ?? ""}
                              onChange={name === "starts_at" ? (e) => onStartsChange(e.target.value) : field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              ))}
            </div>
          </fieldset>

          {!readOnly && (
            <div className="flex justify-end">
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
