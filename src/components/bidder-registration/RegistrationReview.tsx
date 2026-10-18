import { CheckRow, InfoGrid } from "@/components/buyer-contracts/ui";
import { formatVnd } from "@/lib/advertising/slug";
import type { RegistrationStepIndex } from "@/lib/biddingContracts/registrationSteps";
import type { AuctionSessionItem } from "@/types/auction-session";
import { BUYER_KIND_LABELS, ID_TYPE_LABELS } from "@/types/bidding-contract";
import { StepCard } from "./StepCard";
import type { StepProps } from "./types";

interface Props extends StepProps {
  orgName: string;
  fee: number;
  lots: AuctionSessionItem[];
  /** Danh tính dùng bản VNeID đã lưu (ghi "· VNeID" cạnh số giấy tờ). */
  vneid: boolean;
  onEdit: (step: RegistrationStepIndex) => void;
}

const mask = (n: string) => (n ? `••• ••• ${n.slice(-4)}` : "—");

function Summary({ title, step, onEdit, disabled, rows, first }: {
  title: string;
  step: RegistrationStepIndex;
  onEdit: (s: RegistrationStepIndex) => void;
  disabled: boolean;
  rows: { label: string; value: React.ReactNode; full?: boolean }[];
  first?: boolean;
}) {
  return (
    <div className={first ? "py-3.5" : "border-t border-border py-3.5"}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
        <button type="button" className="text-[13px] font-medium text-primary disabled:opacity-50" onClick={() => onEdit(step)} disabled={disabled}>
          Sửa
        </button>
      </div>
      <InfoGrid rows={rows} />
    </div>
  );
}

/** Bước 4 — xem lại, chọn tài sản đăng ký, đồng ý chia sẻ thông tin ⇒ giữ suất ⇒ thanh toán. */
export function RegistrationReview({ values, patch, errors, busy, orgName, fee, lots, vneid, onEdit }: Props) {
  const org = values.buyer_kind === "organization";
  const o = values.organization;
  const p = values.principal;
  const x = values.proxy;
  const picked = new Set(values.lot_ids);
  const depositTotal = lots.filter((l) => picked.has(l.id)).reduce((a, l) => a + (l.deposit_amount ?? 0), 0);
  const contact = `${values.phone} · ${values.email}`;

  const toggle = (id: string) =>
    patch({ lot_ids: picked.has(id) ? values.lot_ids.filter((v) => v !== id) : [...values.lot_ids, id] });

  return (
    <>
      <StepCard title="Kiểm tra thông tin" className="gap-0">
        <Summary
          first
          title="Người đăng ký"
          step={0}
          onEdit={onEdit}
          disabled={busy}
          rows={
            org
              ? [
                  { label: "Tổ chức", value: o.name || "—" },
                  { label: "Mã số thuế", value: o.tax_code || "—" },
                  { label: "Liên hệ", value: contact },
                ]
              : [
                  { label: "Loại", value: BUYER_KIND_LABELS[values.buyer_kind] },
                  { label: "Liên hệ", value: contact },
                ]
          }
        />
        <Summary
          title={org ? "Người đại diện theo pháp luật" : "Danh tính"}
          step={1}
          onEdit={onEdit}
          disabled={busy}
          rows={[
            { label: "Họ tên", value: p.full_name || "—" },
            {
              label: ID_TYPE_LABELS[p.id_type],
              value: (
                <>
                  <span className="font-mono">{mask(p.id_number)}</span>
                  {vneid ? " · VNeID" : ""}
                </>
              ),
            },
            { label: "Địa chỉ", value: p.address || "—" },
          ]}
        />
        <Summary
          title="Người dự phiên"
          step={2}
          onEdit={onEdit}
          disabled={busy}
          rows={
            values.attendee === "self"
              ? [{ label: "Người dự phiên", value: `Chính ${org ? "người đại diện" : "người đăng ký"}` }]
              : [
                  { label: "Người được uỷ quyền", value: `${x.full_name || "—"} · ${ID_TYPE_LABELS[x.id_type]} ${mask(x.id_number)}` },
                  { label: "Giấy uỷ quyền", value: x.poa_doc_path ? "Đã tải lên" : "Chưa tải lên" },
                ]
          }
        />
      </StepCard>

      {lots.length > 0 && (
        <StepCard
          title="Tài sản đăng ký"
          sub="Chọn tài sản bạn muốn trả giá. Tiền đặt trước tính theo từng tài sản, nộp sau khi mua hồ sơ."
        >
          <div className="flex flex-col gap-2">
            {lots.map((l) => (
              <CheckRow
                key={l.id}
                checked={picked.has(l.id)}
                disabled={busy}
                onToggle={() => toggle(l.id)}
                aside={
                  <>
                    <span className="block text-xs text-muted-foreground">Đặt trước</span>
                    <b className="block text-foreground">{formatVnd(l.deposit_amount ?? 0)}</b>
                  </>
                }
              >
                <b className="block text-sm font-semibold">
                  Tài sản {l.lot_no} · {l.title}
                </b>
                {l.starting_price != null && (
                  <span className="text-xs text-muted-foreground">Khởi điểm {formatVnd(l.starting_price)}</span>
                )}
              </CheckRow>
            ))}
          </div>
          {errors.root.lot_ids && <p className="text-sm font-medium text-destructive">{errors.root.lot_ids}</p>}
          <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">Tổng tiền đặt trước · nộp sau</span>
            <b className="text-[17px] text-foreground">{formatVnd(depositTotal)}</b>
          </div>
        </StepCard>
      )}

      <StepCard>
        <CheckRow checked={values.consent} disabled={busy} onToggle={() => patch({ consent: !values.consent })}>
          Tôi đồng ý chia sẻ thông tin và ảnh giấy tờ trên với <b>{orgName}</b> để duyệt hồ sơ, cam kết thông tin là chính
          xác và đã đọc Quy chế cuộc đấu giá. <span className="text-destructive">*</span>
        </CheckRow>
        {errors.root.consent && <p className="text-sm font-medium text-destructive">{errors.root.consent}</p>}
        <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3">
          <span className="text-foreground">Phí hồ sơ</span>
          <b className="text-[22px] text-primary">{formatVnd(fee)}</b>
        </div>
      </StepCard>
    </>
  );
}
