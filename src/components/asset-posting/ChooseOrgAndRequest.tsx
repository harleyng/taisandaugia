import { useState } from "react";
import { Loader2, SearchX, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useCreateBrokerRequest, useMatchedOrgs, useSendServiceRequest } from "@/hooks/useAssetPosting";
import type { MatchCriteria } from "@/lib/orgMatching";
import { OrgComparisonTable } from "./OrgComparisonTable";

type Lane = "self" | "platform";

interface ChooseOrgAndRequestProps {
  /** Hồ sơ tài sản ĐÃ số hoá cần gửi yêu cầu. */
  postingId: string;
  /** Tiêu chí gợi ý tổ chức. */
  criteria: MatchCriteria;
  /** Đã gửi xong — orgName null nghĩa là nhờ sàn chọn giúp. */
  onSent: (orgName: string | null) => void;
  /** Bỏ qua gửi yêu cầu (để sau). */
  onSkip: () => void;
  /** Nhãn nút bỏ qua (mặc định "Để sau"). */
  skipLabel?: string;
}

/**
 * Luồng RIÊNG sau khi số hoá: chọn nơi ký gửi.
 *
 * Hai lối — tự chọn một tổ chức, hoặc nhờ sàn gửi tới nhiều tổ chức rồi so sánh
 * báo giá. Dùng lại trong wizard và ở trang chi tiết hồ sơ.
 */
export function ChooseOrgAndRequest({
  postingId,
  criteria,
  onSent,
  onSkip,
  skipLabel = "Để sau",
}: ChooseOrgAndRequestProps) {
  const [lane, setLane] = useState<Lane>("self");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const { results, isLoading } = useMatchedOrgs(criteria);
  const send = useSendServiceRequest();
  const broker = useCreateBrokerRequest();

  const selected = results.find((r) => r.org.id === selectedId) ?? null;
  const busy = send.isPending || broker.isPending;

  const handleSend = () => {
    if (lane === "platform") {
      broker.mutate(
        { postingId, note: message.trim() || undefined },
        { onSuccess: () => onSent(null) },
      );
      return;
    }
    if (!selected) return;
    send.mutate(
      {
        postingId,
        orgId: selected.org.id,
        matchScore: selected.score,
        message: message.trim() || undefined,
      },
      { onSuccess: () => onSent(selected.org.name) },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const LaneButton = ({ value, title, desc }: { value: Lane; title: string; desc: string }) => (
    <button
      type="button"
      onClick={() => setLane(value)}
      className={`flex-1 rounded-xl border-[1.5px] p-3 text-left transition ${
        lane === value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
      }`}
    >
      <span className="block text-sm font-semibold text-foreground">{title}</span>
      <span className="mt-0.5 block text-xs text-muted-foreground">{desc}</span>
    </button>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <LaneButton value="self" title="Tôi tự chọn tổ chức" desc="Chọn một tổ chức trong danh sách gợi ý." />
        <LaneButton
          value="platform"
          title="Nhờ sàn chọn giúp"
          desc="Sàn gửi nhiều tổ chức, bạn so sánh báo giá. Miễn phí."
        />
      </div>

      {lane === "self" ? (
        results.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <SearchX className="h-8 w-8 text-muted-foreground" />
            <p className="max-w-xs text-sm text-muted-foreground">
              Chưa có tổ chức nào trên sàn khớp tiêu chí này. Hãy chọn “Nhờ sàn chọn giúp” — sàn sẽ tìm hộ bạn.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <p className="text-sm text-foreground">
                {results.length} tổ chức đấu giá phù hợp được xếp hạng theo chuyên môn, địa bàn, hình thức, kinh nghiệm
                và thù lao. Chọn một tổ chức để gửi yêu cầu dịch vụ.
              </p>
            </div>
            <OrgComparisonTable results={results} selectedId={selectedId} onSelect={setSelectedId} />
          </>
        )
      ) : (
        <ol className="flex flex-col gap-1.5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-[13px] text-foreground">
          <li>1. Sàn thẩm định hồ sơ rồi gửi tới các tổ chức đấu giá phù hợp.</li>
          <li>2. Tổ chức quan tâm sẽ gửi báo giá (thù lao, phí, thời gian).</li>
          <li>3. Bạn so sánh và chọn tổ chức mình muốn ký gửi.</li>
        </ol>
      )}

      {(lane === "platform" || selectedId) && (
        <div className="space-y-2">
          <Label htmlFor="request-message" className="text-sm">
            {lane === "platform" ? "Lời nhắn cho sàn (tùy chọn)" : "Lời nhắn gửi tổ chức (tùy chọn)"}
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

      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        <Button
          onClick={handleSend}
          disabled={busy || (lane === "self" && !selectedId)}
          className="flex-1 gap-2"
          size="lg"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {busy ? "Đang gửi..." : lane === "platform" ? "Nhờ sàn chọn giúp" : "Gửi yêu cầu dịch vụ"}
        </Button>
        <Button variant="ghost" onClick={onSkip} disabled={busy} className="sm:flex-none" size="lg">
          {skipLabel}
        </Button>
      </div>
    </div>
  );
}
