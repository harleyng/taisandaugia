import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { CheckCircle2, Circle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ContractTermsCard } from "@/components/consignment/ContractTermsCard";
import { ContractFileButton } from "@/components/consignment/ContractFileButton";
import { CONTRACT_STEPS, contractStepIndex, hasConfirmed } from "@/lib/consignment/contractState";
import { cn } from "@/lib/utils";
import {
  CONTRACT_SIDE_LABELS,
  CONTRACT_STATUS_BADGE_CLASS,
  CONTRACT_STATUS_LABELS_OWNER,
  type ConsignmentContract,
  type ContractEvent,
  type ContractEventAction,
  type OrgParty,
  type OwnerParty,
} from "@/types/consignment-contract";

const EVENT_LABELS: Record<ContractEventAction, string> = {
  created: "Tạo hợp đồng (chốt báo giá)",
  draft_shared: "Chia sẻ dự thảo",
  signed_uploaded: "Tải bản đã ký",
  confirmed: "Xác nhận bản đã ký",
  signed: "Hai bên đã ký",
  cancelled: "Huỷ hợp đồng",
};

const dt = (iso: string | null | undefined) => (iso ? format(new Date(iso), "HH:mm dd/MM/yyyy", { locale: vi }) : "—");

function Lines({ rows }: { rows: Array<[string, string | null | undefined]> }) {
  return (
    <dl className="space-y-1.5 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[150px_1fr] gap-3">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-words text-foreground">{v && String(v).trim() ? v : "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function ownerRows(o: OwnerParty | null): Array<[string, string | null | undefined]> {
  if (!o) return [["Thông tin", null]];
  if (o.kind === "organization") {
    return [
      ["Tổ chức", o.org_name],
      ["Mã số thuế", o.tax_code],
      ["Người đại diện", [o.rep_full_name, o.rep_title].filter(Boolean).join(" — ")],
      ["Địa chỉ", [o.address, o.province].filter(Boolean).join(", ")],
      ["Email", o.email],
    ];
  }
  return [
    ["Họ và tên", o.full_name],
    ["Giấy tờ", o.id_number ? `${o.id_type === "passport" ? "Hộ chiếu" : "CCCD"} ${o.id_number}` : null],
    ["Địa chỉ", [o.address, o.ward, o.province].filter(Boolean).join(", ")],
    ["Điện thoại", o.phone],
    ["Email", o.email],
  ];
}

function orgRows(g: OrgParty | null): Array<[string, string | null | undefined]> {
  if (!g) return [["Thông tin", null]];
  return [
    ["Tổ chức", g.name],
    ["Mã số thuế", g.tax_code],
    ["Đại diện pháp luật", [g.legal_rep_name, g.legal_rep_position].filter(Boolean).join(" — ")],
    ["Địa chỉ", [g.address, g.ward, g.district, g.province].filter(Boolean).join(", ")],
    ["Điện thoại", g.phone],
    ["Email", g.email],
  ];
}

/**
 * Hợp đồng ký gửi, CHỈ ĐỌC cho admin — dựng từ dòng hợp đồng (các bên, tài sản,
 * điều khoản đều đã chụp lúc chốt). Không dùng OwnerContractPanel: nó gắn nút thao
 * tác của chủ tài sản.
 */
export function AdminConsignmentContractView({
  contract: c,
  events,
}: {
  contract: ConsignmentContract;
  events: ContractEvent[];
}) {
  const idx = contractStepIndex(c.status);
  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-foreground">Hợp đồng ký gửi {c.code ?? ""}</h1>
          <Badge variant="outline" className={cn("border-transparent font-medium", CONTRACT_STATUS_BADGE_CLASS[c.status])}>
            {CONTRACT_STATUS_LABELS_OWNER[c.status]}
          </Badge>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {[c.asset_snapshot?.title, c.org_party?.name, c.contract_no ? `Số ${c.contract_no}` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      {c.status === "cancelled" ? (
        <div className="space-y-1 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="flex items-center gap-1.5 font-semibold text-destructive">
            <XCircle className="h-4 w-4" aria-hidden /> Đã huỷ
          </p>
          <p>
            {c.cancelled_side ? CONTRACT_SIDE_LABELS[c.cancelled_side] : "Một bên"} huỷ lúc {dt(c.cancelled_at)}
            {c.cancel_reason && <>: “{c.cancel_reason}”</>}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5">
            {CONTRACT_STEPS.map((s, i) => (
              <div key={s.key} className="flex flex-1 flex-col gap-1.5">
                <div className={`h-1 rounded-full ${i <= idx ? "bg-primary" : "bg-border"}`} />
                <span className={`text-[11px] ${i <= idx ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {(["owner", "org"] as const).map((side) => {
              const done = hasConfirmed(c, side);
              return (
                <span key={side} className={`inline-flex items-center gap-1 ${done ? "text-success" : "text-muted-foreground"}`}>
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                  {CONTRACT_SIDE_LABELS[side]}: {done ? "đã xác nhận bản ký" : "chưa xác nhận"}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Bên A — chủ tài sản</h2>
          <Lines rows={ownerRows(c.owner_party)} />
        </section>
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Bên B — tổ chức đấu giá</h2>
          <Lines rows={orgRows(c.org_party)} />
        </section>
      </div>

      <ContractTermsCard terms={c.terms} startingPrice={c.asset_snapshot?.starting_price ?? null} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Tệp hợp đồng</h2>
          <div className="flex flex-wrap gap-2">
            {c.draft_doc_path ? (
              <ContractFileButton
                path={c.draft_doc_path}
                label={c.draft_source === "generated" ? "Dự thảo (tự sinh)" : "Dự thảo (tổ chức tải lên)"}
              />
            ) : (
              <span className="text-sm text-muted-foreground">Chưa có dự thảo.</span>
            )}
            {c.signed_doc_path && <ContractFileButton path={c.signed_doc_path} label="Bản đã ký" />}
          </div>
          <Lines
            rows={[
              ["Ngày ký", c.signed_date ? format(new Date(c.signed_date), "dd/MM/yyyy") : null],
              ["Hiệu lực từ", dt(c.signed_at)],
              ["Bản ký do", c.signed_uploaded_side ? CONTRACT_SIDE_LABELS[c.signed_uploaded_side] : null],
            ]}
          />
        </section>
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Nhật ký</h2>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có sự kiện.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {events.map((e, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3">
                  <span>
                    {EVENT_LABELS[e.action] ?? e.action}
                    {e.side && <span className="text-muted-foreground"> · {CONTRACT_SIDE_LABELS[e.side]}</span>}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{dt(e.created_at)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
