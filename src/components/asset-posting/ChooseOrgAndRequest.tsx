import { useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MAX_RFQ_ORGS } from "@/constants/asset-posting-rules";
import { useCreateBrokerRequest, useMatchedOrgs, useSendServiceRequests } from "@/hooks/useAssetPosting";
import type { AssetBriefInput } from "@/lib/assetBrief";
import type { MatchCriteria } from "@/lib/orgMatching";
import { AssetBriefEditor } from "./AssetBriefEditor";
import { OrgPicker } from "./OrgPicker";
import { toggleOrg } from "./wizardSchema";

type Lane = "self" | "platform";

interface ChooseOrgAndRequestProps {
  /** Hồ sơ tài sản ĐÃ số hoá cần gửi yêu cầu. */
  postingId: string;
  /** Tiêu chí gợi ý tổ chức. */
  criteria: MatchCriteria;
  /** Hồ sơ tài sản để soạn sẵn bản mô tả gửi tổ chức. */
  briefInput: AssetBriefInput;
  /**
   * Tổ chức đã nhận yêu cầu cho hồ sơ này — KHÔNG gửi lại được (UNIQUE ở DB),
   * kể cả khi đã từ chối. Có phần tử = đang GỬI THÊM, không phải gửi lần đầu:
   * hai tình huống nói khác nhau và chỉ lần đầu mới được chọn lối "nhờ sàn".
   */
  alreadySentIds?: Set<string>;
  /**
   * Số tổ chức đang thực sự giữ hồ sơ (isLiveServiceRequest) — đây là con số áp
   * trần MAX_RFQ_ORGS, chứ không phải alreadySentIds.size: tổ chức đã từ chối
   * không còn chiếm chỗ nào.
   */
  activeCount?: number;
  /** Đã gửi xong — orgNames rỗng nghĩa là nhờ sàn chọn giúp. */
  onSent: (orgNames: string[]) => void;
  /** Bỏ qua gửi yêu cầu (để sau). */
  onSkip: () => void;
  /** Nhãn nút bỏ qua (mặc định "Để sau"). */
  skipLabel?: string;
}

/**
 * Luồng RIÊNG sau khi số hoá: chọn nơi ký gửi.
 *
 * Hai lối — tự chọn (tới MAX_RFQ_ORGS tổ chức cùng lúc rồi so sánh báo giá),
 * hoặc nhờ sàn gửi hộ. Dùng lại trong wizard và ở trang chi tiết hồ sơ.
 */
export function ChooseOrgAndRequest({
  postingId,
  criteria,
  briefInput,
  alreadySentIds,
  activeCount = 0,
  onSent,
  onSkip,
  skipLabel = "Để sau",
}: ChooseOrgAndRequestProps) {
  // Gửi thêm cho một hồ sơ đã có yêu cầu thì chỉ còn một lối: chọn thêm tổ chức.
  // Nhờ sàn lúc này sẽ đẻ ra hai luồng song song trên cùng hồ sơ, và thanh tiến
  // trình "sàn đã gửi N tổ chức" sẽ đếm cả những tổ chức do chủ tài sản tự gửi.
  const topUp = !!alreadySentIds?.size;
  const [lane, setLane] = useState<Lane>("self");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Hai ô tách riêng: lời nhắn cho sàn là một câu mong muốn, còn nội dung gửi
  // tổ chức là cả bản mô tả tài sản. Dùng chung một state thì đổi lối là mang
  // nguyên bản brief sang ô "lời nhắn cho sàn".
  const [brokerNote, setBrokerNote] = useState("");
  const [orgMessage, setOrgMessage] = useState("");

  const { results, isLoading } = useMatchedOrgs(criteria);
  const send = useSendServiceRequests();
  const broker = useCreateBrokerRequest();

  const selectedResults = results.filter((r) => selectedIds.includes(r.org.id));
  const busy = send.isPending || broker.isPending;

  const handleSend = () => {
    if (!topUp && lane === "platform") {
      broker.mutate(
        { postingId, note: brokerNote.trim() || undefined },
        { onSuccess: () => onSent([]) },
      );
      return;
    }
    if (selectedResults.length === 0) return;
    send.mutate(
      {
        postingId,
        orgs: selectedResults.map((r) => ({ orgId: r.org.id, matchScore: r.score })),
        message: orgMessage.trim() || undefined,
      },
      { onSuccess: () => onSent(selectedResults.map((r) => r.org.name)) },
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

  // Trần áp cho TỔNG số tổ chức đang giữ hồ sơ, không phải cho mỗi lần bấm gửi:
  // gửi 5 lần × 1 tổ chức vẫn là 5 tổ chức đang xem cùng một tài sản.
  const remaining = Math.max(0, MAX_RFQ_ORGS - activeCount);

  return (
    <div className="space-y-5">
      {!topUp && (
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <LaneButton
            value="self"
            title="Tôi tự chọn tổ chức"
            desc={`Chọn tới ${MAX_RFQ_ORGS} tổ chức trong danh sách gợi ý.`}
          />
          <LaneButton
            value="platform"
            title="Nhờ sàn chọn giúp"
            desc="Sàn gửi nhiều tổ chức, bạn so sánh báo giá."
          />
        </div>
      )}

      {topUp || lane === "self" ? (
        <>
          {results.length > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <p className="text-sm text-foreground">
                {topUp ? (
                  <>
                    Hồ sơ đang ở {activeCount} tổ chức. Chọn thêm tối đa {remaining} tổ chức nữa để có thêm báo giá so
                    sánh — tổ chức đã nhận hồ sơ hiện mờ trong danh sách, không gửi lại được.
                  </>
                ) : (
                  <>
                    {results.length} tổ chức đấu giá phù hợp được xếp hạng theo chuyên môn, địa bàn, hình thức, kinh
                    nghiệm và thù lao. Chọn tới {MAX_RFQ_ORGS} tổ chức để gửi yêu cầu báo giá — miễn phí, chưa phải
                    hợp đồng ký gửi.
                  </>
                )}
              </p>
            </div>
          )}
          <OrgPicker
            results={results}
            criteria={criteria}
            isLoading={false}
            selectedIds={selectedIds}
            onToggle={(id) => setSelectedIds((prev) => toggleOrg(prev, id, remaining))}
            max={remaining}
            sentIds={alreadySentIds}
            onSwitchToPlatform={
              topUp
                ? undefined
                : () => {
                    setLane("platform");
                    setSelectedIds([]);
                  }
            }
          />
        </>
      ) : (
        <ol className="flex flex-col gap-1.5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-[13px] text-foreground">
          <li>1. Sàn thẩm định hồ sơ rồi gửi tới các tổ chức đấu giá phù hợp.</li>
          <li>2. Tổ chức quan tâm sẽ gửi báo giá (thù lao, phí, thời gian).</li>
          <li>3. Bạn so sánh và chọn tổ chức mình muốn ký gửi.</li>
        </ol>
      )}

      {!topUp && lane === "platform" ? (
        <div className="space-y-2">
          <Label htmlFor="request-message" className="text-sm">
            Lời nhắn cho sàn (tùy chọn)
          </Label>
          <Textarea
            id="request-message"
            value={brokerNote}
            onChange={(e) => setBrokerNote(e.target.value)}
            placeholder="Mong muốn cụ thể của bạn về phiên đấu giá..."
            className="min-h-[72px]"
          />
        </div>
      ) : (
        selectedResults.length > 0 && (
          <AssetBriefEditor
            input={briefInput}
            recipientLabel={
              selectedResults.length === 1 ? selectedResults[0].org.name : `${selectedResults.length} tổ chức`
            }
            value={orgMessage}
            onChange={setOrgMessage}
          />
        )
      )}

      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        <Button
          onClick={handleSend}
          disabled={busy || ((topUp || lane === "self") && selectedIds.length === 0)}
          className="flex-1 gap-2"
          size="lg"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {busy
            ? "Đang gửi..."
            : !topUp && lane === "platform"
              ? "Nhờ sàn chọn giúp"
              : `Gửi yêu cầu báo giá${selectedIds.length > 0 ? ` · ${selectedIds.length} tổ chức` : ""}`}
        </Button>
        <Button variant="ghost" onClick={onSkip} disabled={busy} className="sm:flex-none" size="lg">
          {skipLabel}
        </Button>
      </div>
    </div>
  );
}
