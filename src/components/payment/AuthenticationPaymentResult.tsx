import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { usePayAuthenticationOrder } from "@/hooks/useAuthenticationOrders";
import { gdErrorMessage } from "@/lib/authentication/errors";
import { ownerPostingPath } from "@/lib/vrTour/paths";

/**
 * /payment-result?gd_order=…&amount=… — ghi nhận thanh toán đơn giám định.
 *
 * Cùng khuôn VrTourPaymentResult. Idempotent ở SERVER (_settle_authentication_order): F5 / back-forward chỉ nhận
 * `already_paid`. `amount` là số tiền người bán đã thấy lúc trả — server từ chối
 * (`quote_changed`) nếu admin báo giá lại giữa chừng. `ranRef` chỉ chặn gọi hai lần
 * trong cùng một lần mount.
 */
export function AuthenticationPaymentResult() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { userId, loading: authLoading } = useAuth();
  const { mutate, data, error, isPending, isIdle } = usePayAuthenticationOrder();
  const ranRef = useRef(false);

  const status = params.get("status");
  const orderId = params.get("gd_order");
  const amount = Number(params.get("amount"));
  const txnRef = params.get("txn");
  const returnPath = params.get("return");

  useEffect(() => {
    // Chờ auth resolve TRƯỚC khi tiêu ranRef — redirect từ VNPay là lần tải mới,
    // lượt render đầu userId còn null.
    if (authLoading || !userId) return;
    if (ranRef.current) return;
    ranRef.current = true;
    if (status !== "success" || !orderId || !txnRef || !Number.isFinite(amount)) return;
    mutate({ orderId, txnRef, expectedAmount: amount });
  }, [authLoading, userId, status, orderId, txnRef, amount, mutate]);

  const postingPath = returnPath || (data?.posting_id ? ownerPostingPath(data.posting_id) : "/chu-tai-san/dang-tai-san");

  const failure = (title: string, message: string) => (
    <>
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <XCircle className="h-9 w-9 text-destructive" />
      </div>
      <h1 className="mb-2 text-2xl font-bold text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button onClick={() => navigate(postingPath)} size="lg" className="mt-6 w-full">
        Quay lại hồ sơ tài sản
      </Button>
    </>
  );

  const content = () => {
    if (status !== "success") {
      return failure(
        "Thanh toán chưa hoàn tất",
        "Giao dịch đã bị huỷ. Báo giá vẫn còn hiệu lực — bạn có thể thanh toán lại từ hồ sơ tài sản.",
      );
    }
    if (error) return failure("Chưa ghi nhận được thanh toán", gdErrorMessage(error));
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
            Đơn giám định <span className="font-mono font-semibold text-foreground">{data.code}</span> · trạng thái{" "}
            <span className="font-semibold text-foreground">Đã thanh toán</span>
          </p>
          <p className="mt-4 rounded-lg bg-primary/10 px-3 py-2 text-sm text-foreground">
            {data.method === "ship_item"
              ? "Bước tiếp theo: đóng gói và gửi hiện vật tới đối tác theo hướng dẫn của sàn, rồi nhập mã vận đơn trong hồ sơ tài sản."
              : data.method === "on_site"
                ? "Bước tiếp theo: sàn sẽ liên hệ để hẹn lịch chuyên gia tới xem hiện vật."
                : "Bước tiếp theo: đối tác giám định dựa trên ảnh & video trong hồ sơ. Chứng thư sẽ hiện trong hồ sơ tài sản."}
          </p>
          <Button onClick={() => navigate(postingPath)} size="lg" className="mt-6 w-full">
            Về hồ sơ tài sản
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
