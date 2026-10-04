import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Clock, FileDown, ImageOff, Link2Off, Send } from "lucide-react";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { SharedGallery } from "@/components/asset-posting/shared/SharedGallery";
import { SharedMediaCards } from "@/components/asset-posting/shared/SharedMediaCards";
import { SharedTitle } from "@/components/asset-posting/shared/SharedTitle";
import { SharedFacts } from "@/components/asset-posting/shared/SharedFacts";
import { SharedLegal } from "@/components/asset-posting/shared/SharedLegal";
import { SharedSpecs } from "@/components/asset-posting/shared/SharedSpecs";
import { SharedPriceCard } from "@/components/asset-posting/shared/SharedPriceCard";
import { SharedSenderCard } from "@/components/asset-posting/shared/SharedSenderCard";
import { SharedFooter } from "@/components/asset-posting/shared/SharedFooter";
import { SharedCtaBar } from "@/components/asset-posting/shared/SharedCtaBar";
import type { FollowState } from "@/components/asset-posting/shared/SharedFollowButton";
import { SharedPostingEmpty, SharedPostingLoading } from "@/components/asset-posting/shared/SharedPostingStates";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthDialog } from "@/contexts/AuthDialogContext";
import { trackShareEvent, useFollowSharedPosting, useSharedPosting } from "@/hooks/useSharedPosting";
import { specRows } from "@/lib/asset-posting/postingPrint";
import { BRAND } from "@/lib/brand";
import { writeMktAttribution } from "@/lib/ownerMarketing/links";
import { sharedPostingPrintPath } from "@/lib/postingShare/message";
import { SHARED_POSTING_UNAVAILABLE, formatShareDay } from "@/lib/postingShare/status";
import { sessionCta } from "@/lib/postingShare/view";

/** Không cho máy tìm kiếm lập chỉ mục — link gửi riêng cho khách của ngân hàng. */
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
}

/**
 * Hồ sơ online — /hs/:code (docs/owner-marketing-plan.md Phase M0). Đích là hồ sơ số hoá HOẶC tin
 * trên sàn (từ 20261004210000 mọi link chia sẻ / chiến dịch đều vào đây). CÔNG KHAI, ngoài
 * ProtectedRoute: cán bộ ngân hàng gửi link qua kênh riêng (Zalo, email, RM), người nhận
 * không cần tài khoản. Server chỉ trả payload đã lọc (get_shared_posting); mỗi lần mở có thể
 * là một lượt xem nên hook gọi RPC đúng một lần. Thiết kế cho điện thoại trước — phần lớn
 * link được mở trong trình duyệt của Zalo.
 */
const SharedPostingPage = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { openAuthDialog } = useAuthDialog();
  const { data, isLoading, isFetching, isError, refetch } = useSharedPosting(code);
  const posting = data?.ok === true ? data.posting : null;
  const listing = posting?.kind === "listing";
  const follow = useFollowSharedPosting(code, listing);
  const ref = data?.ok === true ? data.ref : null;
  const unavailable = data?.ok === false ? data : null;
  // openAuthDialog giữ callback tới lúc đăng nhập xong ⇒ đọc mutate mới nhất qua ref.
  const followRef = useRef(follow.mutate);
  followRef.current = follow.mutate;
  useNoIndex();

  // Lượt mở được tính ⇒ ghi nguồn 30 ngày (lần chạm cuối thắng): lưu tin / đăng ký tham gia
  // trong 30 ngày tới được tính cho link này.
  useEffect(() => {
    if (ref) writeMktAttribution(ref);
  }, [ref]);

  useEffect(() => {
    const previous = document.title;
    document.title = posting ? `${posting.title} · ${BRAND.name}` : `Hồ sơ tài sản · ${BRAND.name}`;
    return () => {
      document.title = previous;
    };
  }, [posting]);

  const buyDossier = () => {
    if (!posting?.session) return;
    trackShareEvent(code, "cta_dossier");
    navigate(posting.session.path);
  };
  const followPosting = () => {
    trackShareEvent(code, "cta_follow");
    if (userId) follow.mutate();
    else openAuthDialog(() => followRef.current());
  };
  const call = () => trackShareEvent(code, "cta_call");
  const openPdf = () => {
    if (!code) return;
    trackShareEvent(code, "cta_pdf");
    window.open(`${sharedPostingPrintPath(code)}?auto=1`, "_blank", "noopener");
  };

  const from = posting ? (posting.ownerName ?? posting.sender?.name ?? null) : null;
  const header = (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-[1160px] items-center gap-4 px-3.5 py-2.5 sm:px-5">
        <img src={logo} alt={BRAND.name} className="h-7 w-auto shrink-0" />
        {from && (
          <p className="hidden min-w-0 items-center gap-2 text-[13px] text-muted-foreground lg:flex">
            <Send className="h-[15px] w-[15px] shrink-0" strokeWidth={1.8} aria-hidden="true" />
            Hồ sơ gửi từ <b className="truncate font-semibold text-foreground">{from}</b>
          </p>
        )}
        {posting && (
          <Button
            variant="outline"
            className="ml-auto hidden h-9 gap-2 rounded-[10px] px-3 text-[13px] font-semibold sm:inline-flex"
            onClick={openPdf}
          >
            <FileDown className="h-[15px] w-[15px]" strokeWidth={1.8} />
            Tải PDF
          </Button>
        )}
      </div>
    </header>
  );

  if (isLoading || (isFetching && !posting)) {
    return (
      <div className="min-h-screen bg-muted">
        {header}
        <SharedPostingLoading />
      </div>
    );
  }

  if (!posting) {
    const msg = unavailable ? SHARED_POSTING_UNAVAILABLE[unavailable.reason] : null;
    return (
      <div className="min-h-screen bg-muted">
        {header}
        {msg ? (
          <SharedPostingEmpty
            icon={Link2Off}
            title={msg.title}
            description={
              unavailable?.reason === "expired" && unavailable.expiredAt
                ? `Link đã hết hạn ngày ${formatShareDay(unavailable.expiredAt)}. ${msg.description}`
                : msg.description
            }
            action={
              <Button variant="outline" className="h-[42px] rounded-[10px] font-semibold" onClick={() => navigate("/")}>
                Xem tài sản khác trên {BRAND.name}
              </Button>
            }
          />
        ) : (
          <SharedPostingEmpty
            icon={ImageOff}
            tone="error"
            title="Chưa tải được hồ sơ."
            description={isError ? "Kết nối có thể đang chập chờn. Vui lòng thử lại." : undefined}
            action={
              <Button variant="outline" className="h-[42px] rounded-[10px] font-semibold" onClick={() => void refetch()}>
                Thử lại
              </Button>
            }
          />
        )}
      </div>
    );
  }

  const cta = sessionCta(posting.session);
  const specs = specRows({ child_slug: posting.category.child, delta_fields: posting.specs });
  const followState: FollowState = follow.isPending ? "pending" : follow.isSuccess ? "done" : "idle";

  return (
    <div className="min-h-screen bg-muted">
      {header}
      <main className="mx-auto max-w-[1160px] px-3 pb-[100px] pt-3 sm:p-5">
        <SharedGallery images={posting.imageUrls} videos={posting.videoUrls} title={posting.title} />
        <SharedMediaCards posting={posting} />

        <div className="mt-[22px] grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-4">
            <SharedTitle posting={posting} />
            <SharedFacts specs={specs} />
            {!listing && <SharedLegal legal={posting.legal} />}
            <SharedSpecs description={posting.description} specs={specs} />
          </div>
          <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-[76px]">
            <SharedPriceCard
              posting={posting}
              cta={cta}
              follow={followState}
              onBuyDossier={buyDossier}
              onFollow={followPosting}
              onOpenListing={posting.listingPath ? () => navigate(posting.listingPath!) : undefined}
            />
            <SharedSenderCard posting={posting} onCall={call} />
            {posting.expiresAt && (
              <p className="flex items-center gap-1.5 px-1 text-[12.5px] text-muted-foreground">
                <Clock className="h-[15px] w-[15px]" strokeWidth={1.8} aria-hidden="true" />
                Link có hiệu lực đến {formatShareDay(posting.expiresAt)}
              </p>
            )}
          </aside>
        </div>

        <SharedFooter />
      </main>
      <SharedCtaBar
        cta={cta}
        price={posting.startingPrice}
        phone={posting.sender?.phone ?? null}
        follow={followState}
        onBuyDossier={buyDossier}
        onFollow={followPosting}
        onCall={call}
        onPdf={openPdf}
        save={listing}
      />
    </div>
  );
};

export default SharedPostingPage;
