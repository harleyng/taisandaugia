import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { VIETNAM_PROVINCE_NAMES } from "@/constants/vietnam-provinces";
import { isOnlineFormat, type SessionFormValues } from "@/lib/auctionSessions/sessionForm";
import { FormSection, Req } from "./formParts";

type Form = UseFormReturn<SessionFormValues>;

const NO_PROVINCE = "__none__";

const FORMAT_OPTIONS = [
  { value: "truc_tuyen", label: "Trực tuyến", hint: "Trả giá trên sàn. Có phòng điều hành và quy tắc trả giá." },
  { value: "truc_tiep", label: "Trực tiếp", hint: "Trả giá tại hội trường. Điểm danh tại cửa." },
] as const;

/** 1 · Thông tin chung. */
export function SessionGeneralSection({ form }: { form: Form }) {
  return (
    <FormSection no={1} title="Thông tin chung" description="Người mua thấy tên và mô tả này khi phiên được công bố.">
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Tên phiên
              <Req />
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
    </FormSection>
  );
}

/** 2 · Hình thức & địa điểm — thẻ chọn hình thức + tỉnh / địa điểm. */
export function SessionFormatSection({ form }: { form: Form }) {
  const format = form.watch("auction_format");
  const province = form.watch("province");
  const online = isOnlineFormat(format);
  // Phiên cũ ghi tên tỉnh ngoài danh sách vẫn hiện được giá trị đang lưu.
  const provinces =
    province && !VIETNAM_PROVINCE_NAMES.includes(province) ? [province, ...VIETNAM_PROVINCE_NAMES] : VIETNAM_PROVINCE_NAMES;

  return (
    <FormSection
      no={2}
      title="Hình thức & địa điểm"
      description="Hình thức quyết định cách người tham gia trả giá và có phòng điều hành hay không."
    >
      <FormField
        control={form.control}
        name="auction_format"
        render={({ field }) => (
          <FormItem>
            <div role="radiogroup" aria-label="Hình thức đấu giá" className="grid gap-2.5 md:grid-cols-2">
              {FORMAT_OPTIONS.map((o) => {
                const on = field.value === o.value;
                return (
                  <label
                    key={o.value}
                    className={cn(
                      "flex cursor-pointer items-start gap-[11px] rounded-[10px] px-3.5 py-[13px] shadow-[inset_0_0_0_1px_hsl(var(--border))] hover:bg-muted/40",
                      on && "bg-primary/[0.03] shadow-[inset_0_0_0_1.5px_hsl(var(--primary))] hover:bg-primary/[0.03]",
                    )}
                  >
                    <input
                      type="radio"
                      name={field.name}
                      value={o.value}
                      checked={on}
                      onChange={() => field.onChange(o.value)}
                      className="mt-0.5 accent-[hsl(var(--primary))]"
                    />
                    <div>
                      <b className="block text-[13.5px] font-semibold">{o.label}</b>
                      <small className="mt-0.5 block text-[12.5px] text-muted-foreground [text-wrap:pretty]">
                        {o.hint}
                      </small>
                    </div>
                  </label>
                );
              })}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid gap-3.5 md:grid-cols-2">
        <FormField
          control={form.control}
          name="province"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tỉnh / thành</FormLabel>
              <Select
                value={field.value || NO_PROVINCE}
                onValueChange={(v) => field.onChange(v === NO_PROVINCE ? "" : v)}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NO_PROVINCE}>Chưa chọn</SelectItem>
                  {provinces.map((p) => (
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
          name="venue"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{online ? "Nơi điều hành phiên" : "Địa điểm tổ chức"}</FormLabel>
              <FormControl>
                <Input
                  placeholder={online ? "VD: Phòng đấu giá trực tuyến trên sàn" : "VD: Hội trường tầng 3, trụ sở công ty"}
                  {...field}
                />
              </FormControl>
              {!online && <FormDescription>Địa chỉ người tham gia có mặt để trả giá.</FormDescription>}
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </FormSection>
  );
}
