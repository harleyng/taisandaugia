import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ContractClausesView } from "@/components/contracts/ContractClausesView";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveContractTemplate } from "@/hooks/useContractTemplates";
import {
  currentServiceContract,
  useAcceptServiceContract,
  useOrderServiceContracts,
  useServiceOrder,
} from "@/hooks/useServiceContracts";
import { serviceTemplateType } from "@/lib/contracts/templates/schema";
import { slotText } from "@/lib/contracts/templates/resolve";
import {
  SERVICE_CONTRACT_LABELS,
  previewTermsOf,
  providerPartyFromClauses,
  serviceCheckoutPath,
  serviceContractPreviewFileName,
} from "@/lib/serviceContracts";
import { saveBlob } from "@/lib/pdf/saveBlob";
import { formatMoneyFull } from "@/utils/money";
import type { ServiceKindKey } from "@/lib/serviceRequests/kinds";

interface ServiceContractAcceptDialogProps {
  kind: ServiceKindKey;
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

/**
 * Hợp đồng cung ứng dịch vụ — đọc và ĐỒNG Ý trước khi thanh toán. Đồng ý ghi một
 * dòng bất biến (bản chụp + phiên bản mẫu) rồi mới chuyển sang cổng thanh toán.
 * Đã đồng ý báo giá hiện hành ⇒ chỉ còn nút "Tiếp tục thanh toán".
 */
export function ServiceContractAcceptDialog({ kind, orderId, open, onOpenChange }: ServiceContractAcceptDialogProps) {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { order, isLoading: orderLoading } = useServiceOrder(kind, open ? orderId : null);
  const templateType = serviceTemplateType(kind);
  const template = useActiveContractTemplate(open ? templateType : null);
  const contracts = useOrderServiceContracts(open ? kind : null, orderId);
  const accept = useAcceptServiceContract();
  const [agreed, setAgreed] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const current = currentServiceContract(contracts.data, order);
  const tpl = template.data;
  const loading = orderLoading || template.isLoading || contracts.isLoading;
  const expired = !!order?.quote_expires_at && new Date(order.quote_expires_at) < new Date();
  const payable = !!order && order.status === "quoted" && order.quoted_price != null && !expired;
  const isRequester = !!order && order.user_id === userId;

  const goCheckout = () => {
    if (!order) return;
    onOpenChange(false);
    navigate(serviceCheckoutPath(kind, order.id, order.asset_posting_id));
  };

  const onAccept = () => {
    if (!order || !tpl || order.quoted_price == null) return;
    accept.mutate(
      { kind, orderId: order.id, templateId: tpl.id, expectedPrice: order.quoted_price },
      { onSuccess: (r) => {
          toast.success(`Đã giao kết hợp đồng ${r.code}`);
          goCheckout();
        } },
    );
  };

  const onPreview = async () => {
    if (!order || !tpl) return;
    setPreviewing(true);
    try {
      const { serviceContractPdfBlob } = await import("@/lib/serviceContracts/contract-pdf");
      const blob = await serviceContractPdfBlob({
        kind,
        code: null,
        templateVersion: tpl.version,
        clauses: tpl.clauses,
        terms: previewTermsOf(order),
        owner: null,
        provider: providerPartyFromClauses(tpl.clauses, order.partner_name, order.expert_name ?? null),
        acceptedAt: null,
        acceptedByName: null,
        contentHash: null,
        generatedAt: new Date(),
      });
      saveBlob(blob, serviceContractPreviewFileName(order.code));
    } catch {
      toast.error("Không tạo được bản xem trước. Vui lòng thử lại.");
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setAgreed(false);
        onOpenChange(v);
      }}
    >
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col rounded-2xl">
        <DialogHeader>
          <DialogTitle>Hợp đồng dịch vụ {SERVICE_CONTRACT_LABELS[kind]}</DialogTitle>
          <DialogDescription>
            Đọc và đồng ý hợp đồng trước khi thanh toán{tpl ? ` · mẫu ${tpl.version}` : ""}.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          </div>
        ) : !order ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Không tìm thấy đơn dịch vụ.</p>
        ) : !tpl ? (
          <p className="py-8 text-center text-sm text-destructive">
            Sàn chưa có mẫu hợp đồng cho dịch vụ này. Vui lòng liên hệ sàn.
          </p>
        ) : (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-xl bg-muted/40 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Gói dịch vụ</dt>
                <dd className="font-medium">{order.package_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Đơn vị thực hiện</dt>
                <dd className="font-medium">{order.partner_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Phí dịch vụ</dt>
                <dd className="font-semibold tabular-nums">{formatMoneyFull(order.quoted_price)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Báo giá hiệu lực đến</dt>
                <dd className="font-medium">{fmtDateTime(order.quote_expires_at)}</dd>
              </div>
              {order.quote_note && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">Ghi chú báo giá</dt>
                  <dd className="whitespace-pre-line">{order.quote_note}</dd>
                </div>
              )}
            </dl>

            <ContractClausesView
              templateType={templateType}
              clauses={tpl.clauses}
              hideKeys={["electronic_acceptance"]}
              className="rounded-xl border border-border p-4"
            />

            {current ? (
              <p className="flex items-start gap-2 rounded-xl bg-success/10 p-3 text-sm text-success">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
                Bạn đã đồng ý hợp đồng {current.code} lúc {fmtDateTime(current.accepted_at)} cho báo giá này.
              </p>
            ) : payable && isRequester ? (
              <div className="flex items-start gap-3 rounded-xl bg-muted/40 p-3">
                <Checkbox
                  id="sc-agree"
                  checked={agreed}
                  onCheckedChange={(v) => setAgreed(v === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="sc-agree" className="text-sm font-normal leading-relaxed">
                  Tôi đã đọc và đồng ý toàn bộ điều khoản hợp đồng.{" "}
                  <span className="text-muted-foreground">{slotText(tpl.clauses, "electronic_acceptance")}</span>
                </Label>
              </div>
            ) : (
              <p className="rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">
                {!payable
                  ? "Báo giá không còn hiệu lực để thanh toán."
                  : "Chỉ người đã gửi yêu cầu mới đồng ý hợp đồng và thanh toán được đơn này."}
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {order && tpl && (
            <Button type="button" variant="outline" onClick={onPreview} disabled={previewing}>
              {previewing ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Download className="mr-1.5 h-4 w-4" strokeWidth={1.5} aria-hidden />
              )}
              Tải bản xem trước
            </Button>
          )}
          {current && payable && isRequester ? (
            <Button type="button" onClick={goCheckout}>
              Tiếp tục thanh toán
            </Button>
          ) : (
            payable &&
            isRequester &&
            tpl && (
              <Button type="button" onClick={onAccept} disabled={!agreed || accept.isPending}>
                {accept.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
                Đồng ý & thanh toán {formatMoneyFull(order.quoted_price)}
              </Button>
            )
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
