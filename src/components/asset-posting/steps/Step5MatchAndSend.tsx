import { useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Loader2, Send, SearchX, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useMatchedOrgs, useSubmitPostingWithOrg } from "@/hooks/useAssetPosting";
import { OrgComparisonTable } from "../OrgComparisonTable";
import { buildMatchCriteria, buildPostingPayload, type WizardValues } from "../wizardSchema";

interface StepProps {
  form: UseFormReturn<WizardValues>;
  onSubmitted: (orgName: string) => void;
}

/** Bước 5: gợi ý tổ chức đấu giá → so sánh → chọn → tạo hồ sơ + gửi yêu cầu dịch vụ. */
export function Step5MatchAndSend({ form, onSubmitted }: StepProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const values = form.watch();
  const criteria = useMemo(
    () => buildMatchCriteria(values),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [values.parentSlug, values.province, values.auctionFormat, values.pricingMode, values.startingPrice, values.commissionPct],
  );

  const { results, isLoading } = useMatchedOrgs(criteria);
  const submit = useSubmitPostingWithOrg();

  const selected = results.find((r) => r.org.id === selectedId) ?? null;

  const handleSubmit = () => {
    if (!selected) return;
    submit.mutate(
      {
        posting: buildPostingPayload(form.getValues()),
        orgId: selected.org.id,
        matchScore: selected.score,
        message: message.trim() || undefined,
      },
      { onSuccess: () => onSubmitted(selected.org.name) },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <SearchX className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground max-w-xs">
          Chưa tìm thấy tổ chức đấu giá nào trong hệ thống. Vui lòng thử lại sau.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2.5 rounded-xl bg-primary/5 border border-primary/20 p-3">
        <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-foreground">
          {results.length} tổ chức đấu giá phù hợp được xếp hạng theo chuyên môn, địa bàn, hình thức, kinh nghiệm và thù lao.
          Chọn một tổ chức để gửi yêu cầu dịch vụ.
        </p>
      </div>

      <OrgComparisonTable results={results} selectedId={selectedId} onSelect={setSelectedId} />

      {selectedId && (
        <div className="space-y-2">
          <Label htmlFor="request-message" className="text-sm">
            Lời nhắn gửi tổ chức (tùy chọn)
          </Label>
          <Textarea
            id="request-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Mong muốn cụ thể của bạn về phiên đấu giá..."
            className="min-h-[72px]"
          />
        </div>
      )}

      <Button onClick={handleSubmit} disabled={!selectedId || submit.isPending} className="w-full gap-2" size="lg">
        {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {submit.isPending ? "Đang gửi yêu cầu..." : "Tạo hồ sơ & gửi yêu cầu dịch vụ"}
      </Button>
    </div>
  );
}
