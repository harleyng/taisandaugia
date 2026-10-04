import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { usePayMarketingOrder } from "@/hooks/useOwnerMarketingOrders";
import { mktOrderErrorMessage, ownerOrdersHref } from "@/lib/ownerMarketing/orders";
import { ownerMarketingOrderHref } from "@/lib/ownerMarketing/routes";

/**
 * /payment-result?mkt_order=…&amount=… — ghi nhận thanh toán đơn "Giao việc cho sàn".
 *
 * Cùng khuôn AuthenticationPaymentResult. Idempotent ở SERVER (pay_owner_mkt_order): F5 /
 * back-forward chỉ nhận `already_paid`. `amount` là số tiền người trả đã thấy — server từ chối
 * (`quote_changed`) nếu sàn vừa báo giá lại. `ranRef` chặn gọi hai lần trong một lần mount.
 */
export function MarketingOrderPaymentResult() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { userId, loading: authLoading } = useAuth();
  const { mutate, data, error, isPending, isIdle } = usePayMarketingOrder();
  const ranRef = useRef(false);

  const status = params.get("status");
  const orderId = params.get("mkt_order");
  const amount = Number(params.get("amount"));
  const txnRef = params.get("txn");
  const backPath = params.get("return") || (orderId ? ownerMarketingOrderHref(orderId) : ownerOrdersHref());

  useEffect(() => {
    if (authLoading || !userId) return;
    if (ranRef.current) return;
    ranRef.current = true;
    if (status !== "success" || !orderId || !txnRef || !Number.isFinite(amount)) return;
    mutate({ orderId, txnRef, expectedAmount: amount });
  }, [authLoading, userId, status, orderId, txnRef, amount, mutate]);

  const failure = (title: string, message: string) => (
    <>
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <XCircle className="h-9 w-9 text-destructive" />
      </div>
      <h1 className="mb-2 text-2xl font-bold text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button onClick={() => navigate(backPath)} size="lg" className="mt-6 w-full">
        Quay lại đơn
      </Button>
    </>
  );

  const content = () => {
    if (status !== "success") {
      return failure(
        "Thanh toán chưa hoàn tất",
        "Giao dịch đã bị huỷ. Báo giá vẫn còn hiệu lực — bạn có thể thanh toán lại từ đơn.",
      );
    }
    if (error) return failure("Chưa ghi nhận được thanh toán", mktOrderErrorMessage(error));
    if (data) {
      return (
        <>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-9 w-9 text-primary" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">
            {data.status === "already_paid" ? "Đơn đã được thanh toán" : "Thanh toán thành công"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Đơn truyền thông <span className="font-mono font-semibold text-foreground">{data.code}</span> · trạng thái{" "}
            <span className="font-semibold text-foreground">Chờ sàn nhận việc</span>
          </p>
          <p className="mt-4 rounded-lg bg-primary/10 px-3 py-2 text-sm text-foreground">
            Bước tiếp theo: sàn nhận việc và bắt đầu thực hiện. Tiến độ và kết quả hiện trên trang chi tiết đơn.
          </p>
          <Button onClick={() => navigate(backPath)} size="lg" className="mt-6 w-full">
            Xem đơn
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
