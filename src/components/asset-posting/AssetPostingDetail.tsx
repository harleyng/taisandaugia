import { useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Clock, FileSignature, Info, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssetPostingHero } from "./AssetPostingHero";
import { PostingInfoTab } from "./tabs/PostingInfoTab";
import { PostingQuotesTab } from "./tabs/PostingQuotesTab";
import { useCancelBrokerRequest, usePostingDetail } from "@/hooks/useAssetPosting";
import { usePostingContracts } from "@/hooks/useConsignmentContract";

type PostingTab = "thong-tin" | "bao-gia";

const TABS: PostingTab[] = ["thong-tin", "bao-gia"];

interface AssetPostingDetailProps {
  postingId: string;
  onBack: () => void;
}

/**
 * Màn chi tiết một hồ sơ tài sản đấu giá: hero tóm tắt + hai tab.
 *
 * Tab nằm trên `?tab=` chứ không phải state: chủ tài sản gửi link tab báo giá
 * cho người khác (hoặc tự bookmark khi đang chờ tổ chức phản hồi) và tải lại
 * trang phải về đúng chỗ đang xem.
 */
export function AssetPostingDetail({ postingId, onBack }: AssetPostingDetailProps) {
  const { data, isLoading } = usePostingDetail(postingId);
  const cancelBroker = useCancelBrokerRequest();
  const { data: contracts } = usePostingContracts(postingId);
  const [searchParams, setSearchParams] = useSearchParams();

  const param = searchParams.get("tab") as PostingTab | null;
  const tab: PostingTab = param && TABS.includes(param) ? param : "thong-tin";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const backLink = (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft className="h-4 w-4" /> Danh sách tài sản
    </button>
  );

  if (!data) {
    return (
      <div className="space-y-5 px-6 py-6">
        {backLink}
        <p className="text-sm text-muted-foreground">Không tìm thấy hồ sơ tài sản.</p>
      </div>
    );
  }

  const { posting: p, org, requests, brokerRequest } = data;
  const quoteCount = requests.filter((r) => r.status === "quoted" || r.status === "selected").length;

  return (
    <div className="space-y-5 px-6 py-6">
      {backLink}

      <AssetPostingHero
        posting={p}
        sentCount={requests.length}
        quoteCount={quoteCount}
        hasSignedContract={!!contracts?.some((c) => c.status === "signed")}
      />

      {/* Hai cảnh báo dưới đây đứng NGOÀI tab: chúng nói về cả hồ sơ (một cái
          chặn luồng báo giá, một cái đòi sửa lại phần thông tin) nên giấu vào
          một tab là chắc chắn có người không thấy. */}
      {p.status === "active" && requests.length === 0 && p.review_status === "pending" && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex items-start gap-3 pt-5">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Hồ sơ đang chờ duyệt</p>
              <p className="text-sm text-muted-foreground">
                Quản trị viên đang xem xét hồ sơ tài sản của bạn. Sau khi được duyệt, bạn có thể gửi
                hồ sơ cho tổ chức đấu giá.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bị từ chối: hiện lý do để chủ tài sản sửa rồi lưu lại (lưu lại sẽ được duyệt lại). */}
      {p.review_status === "rejected" && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-start gap-3 pt-5">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Hồ sơ chưa được duyệt</p>
              {p.rejection_reason && <p className="text-sm text-foreground">{p.rejection_reason}</p>}
              <p className="text-sm text-muted-foreground">
                Vui lòng cập nhật hồ sơ theo góp ý trên. Hồ sơ sẽ được xem xét lại sau khi bạn lưu.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs
        value={tab}
        onValueChange={(v) =>
          // replace: đổi tab không nên đẻ thêm một bước back cho mỗi lần bấm.
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              if (v === "thong-tin") next.delete("tab");
              else next.set("tab", v);
              return next;
            },
            { replace: true },
          )
        }
      >
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="thong-tin" className="gap-1.5">
            <Info className="h-4 w-4" />
            Thông tin
          </TabsTrigger>
          <TabsTrigger value="bao-gia" className="gap-1.5">
            <FileSignature className="h-4 w-4" />
            Báo giá
            {quoteCount > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                {quoteCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="thong-tin" className="mt-4">
          <PostingInfoTab posting={p} />
        </TabsContent>

        <TabsContent value="bao-gia" className="mt-4">
          <PostingQuotesTab
            posting={p}
            requests={requests}
            brokerRequest={brokerRequest}
            org={org}
            onCancelBroker={() =>
              brokerRequest && cancelBroker.mutate({ brokerRequestId: brokerRequest.id, postingId: p.id })
            }
            isCancelling={cancelBroker.isPending}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
