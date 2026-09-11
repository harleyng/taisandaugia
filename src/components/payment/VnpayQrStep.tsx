import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CheckoutItem } from "@/hooks/useCheckoutItem";
import type { VnpayMethod } from "./VnpayMethodStep";

const formatVnd = (n: number) => `${n.toLocaleString("vi-VN")}`;

const buildQrDataUrl = (text: string) => {
  // Use external QR generator (no extra dep). Renders a fake-looking QR.
  const encoded = encodeURIComponent(text);
  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=0&data=${encoded}`;
};

interface Props {
  item: CheckoutItem;
  orderId: string;
  method: VnpayMethod;
  mm: string;
  ss: string;
  onResult: (status: "success" | "failed") => void;
}

/** Bước 2 trang VNPay mô phỏng — thông tin đơn + QR + nút mô phỏng kết quả. */
export function VnpayQrStep({ item, orderId, method, mm, ss, onResult }: Props) {
  const qrPayload = `vnpay://pay?order=${orderId}&amount=${item.priceVnd}&ref=${item.ref}`;

  return (
    <div className="p-5 sm:p-8 bg-white">
      {/* Mobile expiry */}
      <div className="md:hidden flex items-center justify-end gap-2 text-sm mb-3">
        <span className="text-muted-foreground">Hết hạn sau</span>
        <span className="inline-flex items-center gap-1 font-mono">
          <span className="bg-foreground text-background px-2 py-0.5 rounded">{mm}</span>
          <span>:</span>
          <span className="bg-foreground text-background px-2 py-0.5 rounded">{ss}</span>
        </span>
      </div>

      <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex gap-2 text-sm text-amber-900 mb-6">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          Quý khách vui lòng không tắt trình duyệt cho đến khi nhận được kết quả giao dịch trên website.
          Đây là môi trường <strong>mô phỏng</strong> — không có giao dịch thật.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Order info */}
        <div className="bg-[#f9fafb] rounded-lg p-5">
          <h2 className="text-lg font-bold text-foreground mb-4">
            Thông tin đơn hàng <span className="text-muted-foreground font-normal text-sm">(Test)</span>
          </h2>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-muted-foreground">Số tiền thanh toán</p>
              <p className="text-2xl font-bold text-[#005baa]">
                {formatVnd(item.priceVnd)}
                <sup className="text-xs ml-0.5">VND</sup>
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Sản phẩm</p>
              <p className="font-semibold text-foreground">{item.label}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Phí giao dịch</p>
              <p className="font-semibold text-foreground">0<sup className="text-xs ml-0.5">VND</sup></p>
            </div>
            <div>
              <p className="text-muted-foreground">Mã đơn hàng</p>
              <p className="font-semibold text-foreground">{orderId}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Nhà cung cấp</p>
              <p className="font-semibold text-foreground">MC CTT VNPAY</p>
            </div>
          </div>
        </div>

        {/* QR */}
        <div className="flex flex-col items-center text-center">
          <h2 className="text-lg font-bold text-foreground">
            {method === "qr" || method === "app" ? "Quét mã qua App Ngân hàng/Ví điện tử" : "Hoàn tất thanh toán"}
          </h2>
          <button className="mt-2 inline-flex items-center gap-1 text-sm text-[#005baa] hover:underline">
            <Info className="h-4 w-4" />
            Hướng dẫn thanh toán
          </button>
          <div className="mt-4 p-3 border-2 border-[#005baa] rounded-lg bg-white">
            <img
              src={buildQrDataUrl(qrPayload)}
              alt="QR thanh toán VNPay (mô phỏng)"
              width={240}
              height={240}
              className="block"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Scan to Pay</p>

          <div className="w-full max-w-xs space-y-2 mt-4">
            <Button
              size="lg"
              className="w-full bg-[#005baa] hover:bg-[#004a8c] text-white"
              onClick={() => onResult("success")}
            >
              Mô phỏng thanh toán thành công
            </Button>
            <Button size="lg" variant="outline" className="w-full" onClick={() => onResult("failed")}>
              Hủy thanh toán
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
