import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { usePayOwnerSubscription } from "@/hooks/useOwnerSubscription";
import { subErrorMessage } from "@/lib/ownerSubscription/errors";
import { OWNER_SUBSCRIPTION_PATH } from "@/lib/ownerSubscription/paths";
import { formatSubDate } from "@/lib/ownerSubscription/status";

/**
 * /payment-result?sub=…&amount=… — ghi nhận thanh toán gói thuê bao tổ chức.
 *
 * Idempotent ở SERVER (_settle_owner_subscription): F5 / back-forward chỉ nhận
 * `already_paid`. `amount` là giá Trưởng đơn vị đã thấy — server từ chối
 * (`quote_changed`) nếu admin đổi giá giữa chừng. `ranRef` chỉ chặn gọi hai lần
 * trong cùng một lần mount.
 */
export function OwnerSubscriptionPaymentResult() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { userId, loading: authLoading } = useAuth();
  const { mutate, data, error, isPending, isIdle } = usePayOwnerSubscription();
  const ranRef = useRef(false);

  const status = params.get("status");
  const subId = params.get("sub");
  const amount = Number(params.get("amount"));
  const txnRef = params.get("txn");
  const backPath = params.get("return") || OWNER_SUBSCRIPTION_PATH;

  useEffect(() => {
    // Chờ auth resolve TRƯỚC khi tiêu ranRef — redirect từ VNPay là lần tải mới,
    // lượt render đầu userId còn null.
    if (authLoading || !userId) return;
    if (ranRef.current) return;
    ranRef.current = true;
    if (status !== "success" || !subId || !txnRef || !Number.isFinite(amount)) return;
    mutate({ subId, txnRef, expectedAmount: amount });
  }, [authLoading, userId, status, subId, txnRef, amount, mutate]);

  const failure = (title: string, message: string) => (
    <>
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <XCircle className="h-9 w-9 text-destructive" />
      </div>
      <h1 className="mb-2 text-2xl font-bold text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button onClick={() => navigate(backPath)} size="lg" className="mt-6 w-full">
        Về trang gói thuê bao
      </Button>
    </>
  );

  const content = () => {
    if (status !== "success") {
      return failure("Thanh toán chưa hoàn tất", "Giao dịch đã bị huỷ. Bạn có thể thanh toán lại từ trang gói thuê bao.");
    }
    if (error) return failure("Chưa ghi nhận được thanh toán", subErrorMessage(error));
    if (data) {
      return (
        <>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-9 w-9 text-primary" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">
            {data.status === "already_paid" ? "Gói đã được thanh toán" : "Thanh toán thành công"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Gói <span className="font-mono font-semibold text-foreground">{data.code}</span> của{" "}
            <span className="font-semibold text-foreground">{data.workspace_name}</span> có hiệu lực{" "}
            {formatSubDate(data.starts_on)} – {formatSubDate(data.ends_on)}.
          </p>
          <p className="mt-4 rounded-lg bg-primary/10 px-3 py-2 text-sm text-foreground">
            Mọi thành viên của Trạm dùng các tính năng trong gói mà không trừ credit, trong hạn mức mỗi tháng.
          </p>
          <Button onClick={() => navigate(backPath)} size="lg" className="mt-6 w-full">
            Xem gói thuê bao
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
