import { useState, type ReactNode } from "react";
import { AlertTriangle, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContractClausesView } from "@/components/contracts/ContractClausesView";
import { downloadServiceContractPdf } from "@/hooks/useServiceContracts";
import { serviceTemplateType } from "@/lib/contracts/templates/schema";
import {
  SERVICE_CONTRACT_STAGE_LABELS,
  serviceContractStageOf,
  type ServiceContractStage,
} from "@/lib/serviceContracts";
import { formatMoneyFull } from "@/utils/money";
import { cn } from "@/lib/utils";
import type { ServiceContractDetail, ServiceOwnerParty } from "@/types/service-contract";
import { CONTRACT_TONE_CLASS, type ContractTone } from "@/lib/contracts/rows";

const STAGE_TONE: Record<ServiceContractStage, ContractTone> = {
  awaiting_acceptance: "warning",
  awaiting_payment: "info",
  in_progress: "info",
  completed: "success",
  cancelled: "muted",
  requoted: "muted",
};

const fmtDateTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })
    : "—";

function ownerLines(o: ServiceOwnerParty): Array<[string, string]> {
  const signer: Array<[string, string]> = o.signatory
    ? [["Người đồng ý", [o.signatory.name, o.signatory.email].filter(Boolean).join(" · ") || "—"]]
    : [];
  if (o.kind === "organization") {
    return [
      ["Tên tổ chức", o.org_name ?? "—"],
      ["Mã số thuế", o.tax_code ?? "—"],
      ["Người đại diện", [o.rep_full_name, o.rep_title].filter(Boolean).join(" — ") || "—"],
      ["Địa chỉ", [o.address, o.province].filter(Boolean).join(", ") || "—"],
      ...signer,
    ];
  }
  return [
    ["Họ và tên", o.full_name ?? o.signatory?.name ?? "—"],
    ["Địa chỉ", [o.address, o.ward, o.province].filter(Boolean).join(", ") || "—"],
    ...signer,
  ];
}

function Lines({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="space-y-1.5 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[140px_1fr] gap-3">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-words text-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Thân trang hợp đồng cung ứng dịch vụ — dùng chung cổng chủ tài sản và admin
 * (chỉ đọc: hợp đồng đã giao kết là bất biến). `actions` cho mỗi cổng gắn nút riêng.
 */
export function ServiceContractDetailBody({ detail, actions }: { detail: ServiceContractDetail; actions?: ReactNode }) {
  const c = detail.contract;
  const [downloading, setDownloading] = useState(false);
  const stage = serviceContractStageOf(detail.order?.status, true, detail.is_current);
  const provider = c.provider_party;

  const onDownload = async () => {
    setDownloading(true);
    try {
      await downloadServiceContractPdf(detail);
    } catch {
      toast.error("Không tạo được tệp PDF. Vui lòng thử lại.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Hợp đồng dịch vụ {c.code}</h1>
            <Badge variant="outline" className={cn("border-transparent font-medium", CONTRACT_TONE_CLASS[STAGE_TONE[stage]])}>
              {SERVICE_CONTRACT_STAGE_LABELS[stage]}
            </Badge>
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {[c.terms.service_label, c.terms.posting_title, `Đơn ${c.order_code}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
          <Button type="button" onClick={onDownload} disabled={downloading}>
            {downloading ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Download className="mr-1.5 h-4 w-4" strokeWidth={1.5} aria-hidden />
            )}
            Tải PDF
          </Button>
        </div>
      </div>

      {!detail.is_current && (
        <p className="flex items-start gap-2 rounded-xl bg-warning/10 p-3 text-sm text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
          Sàn đã báo giá lại sau lần đồng ý này — hợp đồng này không còn áp dụng; báo giá mới cần được đồng ý lại.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-12">
        <section className="space-y-4 rounded-2xl bg-card p-5 shadow-card lg:col-span-8">
          <h2 className="text-base font-semibold">Điều khoản</h2>
          <ContractClausesView templateType={serviceTemplateType(c.service_kind)} clauses={detail.template.clauses} />
        </section>

        <div className="space-y-4 lg:col-span-4">
          <section className="space-y-3 rounded-2xl bg-card p-5 shadow-card">
            <h2 className="text-base font-semibold">Dịch vụ</h2>
            <Lines
              rows={[
                ["Gói", c.terms.package_name ?? "—"],
                ["Phí dịch vụ", formatMoneyFull(c.price)],
                ["Báo giá lúc", fmtDateTime(c.quoted_at)],
                ["Đã thanh toán", fmtDateTime(detail.order?.paid_at)],
                ["Hoàn tất", fmtDateTime(detail.order?.done_at)],
              ]}
            />
          </section>
          <section className="space-y-3 rounded-2xl bg-card p-5 shadow-card">
            <h2 className="text-base font-semibold">Bên A — sử dụng dịch vụ</h2>
            <Lines rows={ownerLines(c.owner_party)} />
          </section>
          <section className="space-y-3 rounded-2xl bg-card p-5 shadow-card">
            <h2 className="text-base font-semibold">Bên B — cung ứng dịch vụ</h2>
            <Lines
              rows={[
                ["Pháp nhân", provider.name ?? "—"],
                ["Mã số thuế", provider.tax_code ?? "—"],
                ["Đơn vị thực hiện", provider.partner_name ?? "—"],
                ...(provider.expert_name ? ([["Chuyên gia", provider.expert_name]] as Array<[string, string]>) : []),
              ]}
            />
          </section>
          <section className="space-y-3 rounded-2xl bg-card p-5 shadow-card">
            <h2 className="text-base font-semibold">Giao kết điện tử</h2>
            <Lines
              rows={[
                ["Đồng ý lúc", fmtDateTime(c.accepted_at)],
                ["Người đồng ý", detail.accepted_by_name ?? "—"],
                ["Mẫu", c.template_version],
              ]}
            />
            <p className="break-all rounded-lg bg-muted/40 p-2 font-mono text-[11px] text-muted-foreground">
              SHA-256 {c.content_hash}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
