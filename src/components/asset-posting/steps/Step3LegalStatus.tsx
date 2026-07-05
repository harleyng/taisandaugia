import type { UseFormReturn } from "react-hook-form";
import { ShieldCheck } from "lucide-react";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AssetDocUpload } from "../AssetDocUpload";
import type { WizardValues } from "../wizardSchema";

interface StepProps {
  form: UseFormReturn<WizardValues>;
}

const LEGAL_QUESTIONS: { name: "hasDispute" | "hasMortgage" | "isSeized"; label: string }[] = [
  { name: "hasDispute", label: "Tài sản có đang tranh chấp không?" },
  { name: "hasMortgage", label: "Tài sản có đang thế chấp không?" },
  { name: "isSeized", label: "Tài sản có đang bị kê biên không?" },
];

/** Bước 3: pháp lý & hiện trạng — giấy tờ sở hữu (bắt buộc) + tình trạng pháp lý (bắt buộc). */
export function Step3LegalStatus({ form }: StepProps) {
  return (
    <Form {...form}>
      <div className="space-y-6">
        {/* Giấy tờ chứng minh quyền sở hữu */}
        <FormField
          control={form.control}
          name="ownershipProofUrls"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Giấy tờ chứng minh quyền sở hữu *</FormLabel>
              <p className="text-xs text-muted-foreground">
                Sổ đỏ/sổ hồng, đăng ký xe, hóa đơn, hợp đồng mua bán… (PDF/JPG/PNG).
              </p>
              <FormControl>
                <AssetDocUpload value={field.value} onChange={field.onChange} prefix="ownership" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Quyền được bán */}
        <FormField
          control={form.control}
          name="rightToSell"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-3">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <Label htmlFor="rightToSell" className="text-sm">
                      Tôi có toàn quyền định đoạt / được ủy quyền bán tài sản này
                    </Label>
                  </div>
                </div>
                <FormControl>
                  <Switch id="rightToSell" checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </div>
            </FormItem>
          )}
        />

        {/* Tình trạng pháp lý */}
        <div className="space-y-4">
          <p className="text-sm font-medium text-foreground">Tình trạng pháp lý *</p>
          {LEGAL_QUESTIONS.map((q) => (
            <FormField
              key={q.name}
              control={form.control}
              name={q.name}
              render={({ field }) => (
                <FormItem>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <FormLabel className="font-normal">{q.label}</FormLabel>
                    <FormControl>
                      <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-4">
                        <div className="flex items-center gap-1.5">
                          <RadioGroupItem value="no" id={`${q.name}-no`} />
                          <Label htmlFor={`${q.name}-no`} className="font-normal text-sm">
                            Không
                          </Label>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <RadioGroupItem value="yes" id={`${q.name}-yes`} />
                          <Label htmlFor={`${q.name}-yes`} className="font-normal text-sm">
                            Có
                          </Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>

        <FormField
          control={form.control}
          name="legalNotes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ghi chú pháp lý (nếu có)</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder="VD: đang trong quá trình giải chấp..." className="min-h-[72px]" />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
    </Form>
  );
}
