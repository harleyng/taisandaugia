import type { UseFormReturn } from "react-hook-form";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  AUCTION_FORMAT_LABELS,
  EXPECTED_TIMELINE_LABELS,
  PRICING_MODE_LABELS,
  type AuctionFormat,
  type ExpectedTimeline,
  type PricingMode,
} from "@/types/asset-posting";
import { AssetMediaUpload } from "../AssetMediaUpload";
import { AssetDocUpload } from "../AssetDocUpload";
import type { WizardValues } from "../wizardSchema";

interface StepProps {
  form: UseFormReturn<WizardValues>;
}

const PRICING_MODES = Object.keys(PRICING_MODE_LABELS) as PricingMode[];
const AUCTION_FORMATS = Object.keys(AUCTION_FORMAT_LABELS) as AuctionFormat[];
const TIMELINES = Object.keys(EXPECTED_TIMELINE_LABELS) as ExpectedTimeline[];

/** Bước 4: nhu cầu đấu giá — định giá, hình thức, thù lao, thời gian, media (tùy chọn). */
export function Step4AuctionNeeds({ form }: StepProps) {
  const pricingMode = form.watch("pricingMode");

  return (
    <Form {...form}>
      <div className="space-y-6">
        {/* Định giá */}
        <FormField
          control={form.control}
          name="pricingMode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Giá khởi điểm</FormLabel>
              <FormControl>
                <RadioGroup value={field.value} onValueChange={field.onChange} className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PRICING_MODES.map((m) => (
                    <Label
                      key={m}
                      htmlFor={`pricing-${m}`}
                      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 cursor-pointer ${
                        field.value === m ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <RadioGroupItem value={m} id={`pricing-${m}`} />
                      <span className="text-sm font-normal">{PRICING_MODE_LABELS[m]}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </FormControl>
            </FormItem>
          )}
        />

        {pricingMode === "self" && (
          <FormField
            control={form.control}
            name="startingPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mức giá khởi điểm mong muốn *</FormLabel>
                <div className="relative">
                  <FormControl>
                    <Input {...field} type="number" inputMode="numeric" placeholder="0" className="pr-12" />
                  </FormControl>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    VNĐ
                  </span>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <Separator />

        {/* Hình thức */}
        <FormField
          control={form.control}
          name="auctionFormat"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hình thức đấu giá *</FormLabel>
              <FormControl>
                <RadioGroup value={field.value} onValueChange={field.onChange} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {AUCTION_FORMATS.map((f) => (
                    <Label
                      key={f}
                      htmlFor={`format-${f}`}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 cursor-pointer ${
                        field.value === f ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <RadioGroupItem value={f} id={`format-${f}`} />
                      <span className="text-sm font-normal">{AUCTION_FORMAT_LABELS[f]}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="commissionPct"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mức thù lao chấp nhận</FormLabel>
                <div className="relative">
                  <FormControl>
                    <Input {...field} type="number" inputMode="decimal" placeholder="VD: 2" className="pr-8" />
                  </FormControl>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    %
                  </span>
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="expectedTimeline"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Thời gian kỳ vọng</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn mốc thời gian" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {TIMELINES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {EXPECTED_TIMELINE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </div>

        <Separator />

        {/* Media tùy chọn */}
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground">Ảnh tài sản (tùy chọn)</p>
            <p className="text-xs text-muted-foreground">Ảnh thực tế giúp tổ chức đánh giá nhanh hơn.</p>
          </div>
          <FormField
            control={form.control}
            name="imageUrls"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <AssetMediaUpload value={field.value} onChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground">Hồ sơ số bổ sung (tùy chọn)</p>
            <p className="text-xs text-muted-foreground">Bản vẽ, định giá, biên bản hiện trạng…</p>
          </div>
          <FormField
            control={form.control}
            name="docUrls"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <AssetDocUpload value={field.value} onChange={field.onChange} prefix="extra" />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      </div>
    </Form>
  );
}
