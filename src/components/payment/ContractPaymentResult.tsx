import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { usePayBiddingContract } from "@/hooks/useBiddingContracts";
import { contractErrorMessage } from "@/lib/biddingContracts/errors";
import { MY_CONTRACTS_PATH } from "@/lib/biddingContracts/paths";

/**
 * /payment-result?contract=… — ghi nhận thanh toán hồ sơ tham gia.
 *
 * Idempotent ở SERVER (_settle_bidding_contract): F5 / back-forward gọi lại chỉ
 * nhận `already_paid`. `ranRef` chỉ chặn gọi hai lần trong cùng một lần mount.
 */
export function ContractPaymentResult() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { userId, loading: authLoading } = useAuth();
  const { mutate, data, error, isPending, isIdle } = usePayBiddingContract();
  const ranRef = useRef(false);

  const status = params.get("status");
  const contractId = params.get("contract");
  const txnRef = params.get("txn");
  const returnPath = params.get("return");

  useEffect(() => {
    // Chờ auth resolve TRƯỚC khi tiêu ranRef — VNPay redirect là một lần tải mới,
    // lượt render đầu userId còn null (cùng bẫy đã ghi ở PaymentResult).
    if (authLoading || !userId) return;
    if (ranRef.current) return;
    ranRef.current = true;
    if (status !== "success" || !contractId || !txnRef) return;
    mutate({ contractId, txnRef });
  }, [authLoading, userId, status, contractId, txnRef, mutate]);

  const sessionPath = returnPath || (data?.session_id ? `/sessions/${data.session_id}` : "/sessions");

  const content = () => {
    if (status !== "success") {
      return (
        <>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <XCircle className="h-9 w-9 text-destructive" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">Thanh toán chưa hoàn tất</h1>
          <p className="text-sm text-muted-foreground">
            Giao dịch đã bị huỷ. Suất đăng ký vẫn được giữ trong thời gian còn lại — bạn có thể thanh toán lại từ trang phiên.
          </p>
          <Button onClick={() => navigate(sessionPath)} size="lg" className="mt-6 w-full">
            Quay lại phiên
          </Button>
        </>
      );
    }
    if (error) {
      return (
        <>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <XCircle className="h-9 w-9 text-destructive" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">Chưa ghi nhận được thanh toán</h1>
          <p className="text-sm text-muted-foreground">{contractErrorMessage(error)}</p>
          <Button onClick={() => navigate(sessionPath)} size="lg" className="mt-6 w-full">
            Quay lại phiên
          </Button>
        </>
      );
    }
    if (data) {
      return (
        <>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-9 w-9 text-primary" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">
            {data.status === "already_paid" ? "Hồ sơ đã được thanh toán" : "Thanh toán thành công"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Mã hồ sơ <span className="font-mono font-semibold text-foreground">{data.code}</span>
          </p>
          <p className="mt-4 rounded-lg bg-primary/10 px-3 py-2 text-sm text-foreground">
            Bước tiếp theo: nộp tiền đặt trước theo hướng dẫn của tổ chức đấu giá. Sau khi tổ chức xác nhận, bạn sẽ được cấp
            số báo danh.
          </p>
          <Button onClick={() => navigate(sessionPath)} size="lg" className="mt-6 w-full">
            Về trang phiên
          </Button>
          <Button onClick={() => navigate(MY_CONTRACTS_PATH)} size="lg" variant="outline" className="mt-2 w-full">
            Xem hồ sơ của tôi
          </Button>
        </>
      );
    }
    if (!authLoading && !userId) {
      return <p className="text-sm text-muted-foreground">Vui lòng đăng nhập lại để hoàn tất ghi nhận thanh toán.</p>;
    }
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{isPending || isIdle ? "Đang ghi nhận thanh toán…" : ""}</p>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="container flex-1 px-4 py-10">
        <div className="mx-auto max-w-md">
          <Card className="p-6 text-center md:p-8">{content()}</Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
