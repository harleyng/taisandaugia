import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Coins } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useCredits, CompanyTierKey, OwnerTierKey } from "@/hooks/useCredits";
import { useAuth } from "@/contexts/AuthContext";
import { getVariantPackage } from "@/lib/serviceCatalog";
import { claimPaymentTxn } from "@/lib/credits";

const PaymentResult = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { userId, loading: authLoading } = useAuth();
  const { balance, addCredits, unlockAsset, unlockCompany, unlockOwner, unlockDeepReportPeriod } = useCredits();
  const status = params.get("status");
  const packageKey = params.get("package");
  const returnPath = params.get("return");
  const unlockParam = params.get("unlock");
  const txnRef = params.get("txn");
  const ranRef = useRef(false);
  const [autoUnlocked, setAutoUnlocked] = useState<string | null>(null);
  const [pkg, setPkg] = useState<{ name: string; credits: number } | null>(null);
  const [alreadyProcessed, setAlreadyProcessed] = useState(false);

  useEffect(() => {
    // Phải chờ auth resolve xong TRƯỚC khi tiêu `ranRef`.
    //
    // VNPay redirect trình duyệt sang đây bằng một lần load mới, nên ở lần
    // render đầu AuthContext vẫn đang `loading` và `userId` còn null (xem
    // AuthContext.tsx:30-39 — getSession() là bất đồng bộ). Mọi hàm của
    // useCredits đều `if (!userId) return` (useCredits.tsx:46,63,73,83,93).
    // Nếu chạy thân effect lúc này thì: guard bị tiêu, addCredits/unlock*
    // no-op câm lặng, và effect KHÔNG BAO GIỜ chạy lại → user đã trả tiền
    // nhưng không được cộng credit.
    if (authLoading || !userId) return;
    if (ranRef.current) return;
    ranRef.current = true;
    if (status !== "success") return;

    (async () => {
      // ─── Khoá idempotent PHÍA SERVER ───────────────────────────────────────
      // `ranRef` chỉ chặn double-invoke trong CÙNG một lần mount. F5 hoặc
      // back/forward là mount mới ⇒ ref reset ⇒ trước đây chạy lại toàn bộ:
      // cộng credit lần nữa, và unlockCompany/unlockOwner trừ tiền lần nữa
      // (chúng stack thời hạn theo thiết kế nên không tự chặn trùng).
      //
      // claim_payment_txn chỉ trả true cho lượt gọi ĐẦU TIÊN của mỗi mã giao
      // dịch. Không claim được ⇒ đã xử lý rồi ⇒ bỏ qua HẾT, chỉ hiển thị.
      if (txnRef) {
        const claimed = await claimPaymentTxn(txnRef, packageKey, unlockParam);
        if (!claimed) {
          setAlreadyProcessed(true);
          // Vẫn hiện tên gói để trang không trống trơn khi user F5.
          if (packageKey) {
            const v = await getVariantPackage(packageKey);
            if (v) setPkg({ name: v.name, credits: v.credits });
          }
          return;
        }
      }
      // txnRef thiếu (link cũ trước bản này) thì giữ hành vi trước đó — vẫn tốt
      // hơn là chặn giao dịch thật.

      // Cộng credit nếu có mua gói — giá/credits lấy từ catalog DB theo variant_key.
      if (packageKey) {
        const variant = await getVariantPackage(packageKey);
        if (variant) {
          setPkg({ name: variant.name, credits: variant.credits });
          await addCredits(variant.credits, packageKey);
        }
      }

      if (!unlockParam) return;
      // Format `deep:{slug}:{periodId}` — periodId chứa dấu `-` nên cần parse riêng
      if (unlockParam.startsWith("deep:")) {
        const rest = unlockParam.slice("deep:".length);
        const sepIdx = rest.indexOf(":");
        if (sepIdx > 0) {
          const slug = rest.slice(0, sepIdx);
          const periodId = rest.slice(sepIdx + 1);
          const r = await unlockDeepReportPeriod(slug, periodId);
          if (r.ok) setAutoUnlocked("deep_report");
        }
      } else {
        const [type, id, tier] = unlockParam.split(":");
        if (type === "asset" && id) {
          const r = await unlockAsset(id);
          if (r.ok) setAutoUnlocked("asset");
        } else if (type === "company" && id && tier) {
          const r = await unlockCompany(id, tier as CompanyTierKey);
          if (r.ok) setAutoUnlocked("company");
        } else if (type === "owner" && id && tier) {
          const r = await unlockOwner(id, tier as OwnerTierKey);
          if (r.ok) setAutoUnlocked("owner");
        }
      }
    })();
    // `ranRef` được set ngay dòng đầu, trước mọi `await`, nên dù effect có bị
    // kích hoạt lại do các hàm unlock đổi tham chiếu thì thân effect vẫn chỉ
    // chạy đúng một lần cho mỗi lần mount.
  }, [
    authLoading,
    userId,
    status,
    unlockParam,
    packageKey,
    addCredits,
    unlockAsset,
    unlockCompany,
    unlockOwner,
    unlockDeepReportPeriod,
    txnRef,
  ]);

  const handleContinue = () => {
    if (returnPath) navigate(returnPath);
    else navigate("/");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="container px-4 py-10 flex-1">
        <div className="max-w-md mx-auto">
          <Card className="p-6 md:p-8 text-center">
            {status === "success" ? (
              <>
                <div className="mx-auto h-16 w-16 rounded-full bg-[hsl(142,60%,40%)]/10 flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-9 w-9 text-[hsl(142,60%,40%)]" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Thanh toán thành công</h1>
                {pkg && !alreadyProcessed && (
                  <p className="text-sm text-muted-foreground inline-flex items-center gap-1 justify-center">
                    <Coins className="h-4 w-4 text-primary" />
                    +{pkg.credits} credit đã được cộng vào tài khoản
                  </p>
                )}
                {/* F5 hay back/forward vào lại đúng link này: nói rõ giao dịch đã
                    xử lý xong, thay vì để user tưởng vừa được cộng thêm lần nữa. */}
                {alreadyProcessed && (
                  <p className="text-sm text-muted-foreground">
                    Giao dịch này đã được xử lý trước đó. Số dư bên dưới là số hiện tại.
                  </p>
                )}
                <div className="mt-4 inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm">
                  Số dư: <span className="font-semibold text-foreground">{balance} credit</span>
                </div>
                {autoUnlocked === "asset" && (
                  <p className="mt-4 text-sm text-foreground bg-primary/10 rounded-lg px-3 py-2">
                    ✅ Đã tự động mở khóa tài sản
                  </p>
                )}
                {autoUnlocked === "company" && (
                  <p className="mt-4 text-sm text-foreground bg-primary/10 rounded-lg px-3 py-2">
                    ✅ Đã tự động mở khóa hồ sơ đơn vị
                  </p>
                )}
                {autoUnlocked === "owner" && (
                  <p className="mt-4 text-sm text-foreground bg-primary/10 rounded-lg px-3 py-2">
                    ✅ Đã tự động mở khóa hồ sơ chủ tài sản
                  </p>
                )}
                {autoUnlocked === "deep_report" && (
                  <p className="mt-4 text-sm text-foreground bg-primary/10 rounded-lg px-3 py-2">
                    ✅ Đã tự động mở khóa kỳ báo cáo chuyên sâu
                  </p>
                )}
                <Button onClick={handleContinue} size="lg" className="w-full mt-6">
                  {returnPath ? "Tiếp tục" : "Quay về trang chủ"}
                </Button>
                {returnPath && (
                  <Button onClick={() => navigate("/")} size="lg" variant="outline" className="w-full mt-2">
                    Quay về trang chủ
                  </Button>
                )}
              </>
            ) : (
              <>
                <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                  <XCircle className="h-9 w-9 text-destructive" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Thanh toán thất bại</h1>
                <p className="text-sm text-muted-foreground">Giao dịch không thành công. Vui lòng thử lại.</p>
                <Button onClick={() => navigate(-1)} size="lg" className="w-full mt-6">
                  Thử lại
                </Button>
              </>
            )}
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PaymentResult;
