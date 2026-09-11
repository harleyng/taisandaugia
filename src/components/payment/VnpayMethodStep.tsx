import { ChevronRight, CreditCard, Landmark, QrCode, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type VnpayMethod = "qr" | "atm" | "intl" | "app";

const METHODS: { key: VnpayMethod; title: string; icon: typeof QrCode; sub?: string }[] = [
  { key: "qr", title: "App Ngân hàng và Ví điện tử (VNPAYQR)", icon: QrCode },
  { key: "atm", title: "Thẻ nội địa và tài khoản ngân hàng", icon: Landmark },
  { key: "intl", title: "Thẻ thanh toán quốc tế", icon: CreditCard, sub: "VISA · Mastercard · JCB · UnionPay · AMEX" },
  { key: "app", title: "App VNPAY", icon: Smartphone },
];

interface Props {
  method: VnpayMethod;
  onMethodChange: (m: VnpayMethod) => void;
  onContinue: () => void;
}

/** Bước 1 trang VNPay mô phỏng — chọn phương thức. */
export function VnpayMethodStep({ method, onMethodChange, onContinue }: Props) {
  return (
    <div className="p-5 sm:p-8 bg-[#f9fafb]">
      <h1 className="text-xl sm:text-2xl font-bold text-center text-foreground mb-6">
        Chọn phương thức thanh toán <span className="text-muted-foreground font-normal">(Test)</span>
      </h1>

      <div className="space-y-3 max-w-2xl mx-auto">
        {METHODS.map((m) => {
          const Icon = m.icon;
          const active = method === m.key;
          return (
            <button
              key={m.key}
              onClick={() => onMethodChange(m.key)}
              className={cn(
                "w-full flex items-center justify-between gap-4 rounded-lg border bg-white px-4 py-4 text-left transition-all hover:shadow-sm",
                active ? "border-[#005baa] ring-2 ring-[#005baa]/20" : "border-border",
              )}
            >
              <div className="min-w-0">
                <p className="font-semibold text-foreground text-sm sm:text-base">{m.title}</p>
                {m.sub && <p className="text-xs text-muted-foreground mt-0.5">{m.sub}</p>}
              </div>
              <div className="shrink-0 h-12 w-12 rounded-md bg-muted/50 flex items-center justify-center">
                <Icon className="h-6 w-6 text-[#005baa]" />
              </div>
            </button>
          );
        })}
      </div>

      <div className="max-w-2xl mx-auto mt-6">
        <Button size="lg" className="w-full bg-[#005baa] hover:bg-[#004a8c] text-white" onClick={onContinue}>
          Tiếp tục
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
