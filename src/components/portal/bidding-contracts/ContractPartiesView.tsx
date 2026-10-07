import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { KycImageThumb } from "@/components/ekyc/KycImageThumb";
import { VneidVerifiedBadge } from "@/components/vneid/VneidButton";
import { cn } from "@/lib/utils";
import {
  BUYER_KIND_LABELS,
  GENDER_LABELS,
  ID_TYPE_LABELS,
  KYC_FIELD_LABELS,
  READ_METHOD_LABELS,
  type ContractWithSession,
  type Gender,
  type IdType,
  type KycField,
  type ReadMethod,
} from "@/types/bidding-contract";

interface IdentityView {
  full_name: string;
  id_type: IdType;
  id_number: string;
  date_of_birth: string | null;
  gender: Gender | null;
  address: string;
  phone?: string | null;
  front: string | null;
  back: string | null;
  edited: KycField[];
}

const formatDob = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Một dòng thông tin; trường người mua đã sửa so với máy đọc thì tô vàng để soi kỹ. */
function Field({ label, value, edited }: { label: string; value: ReactNode; edited?: boolean }) {
  return (
    <div className={cn("rounded-md px-2 py-1", edited && "bg-warning/10 ring-1 ring-warning/40")}>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {edited && (
          <span className="inline-flex items-center gap-0.5 font-medium text-warning">
            <AlertTriangle className="h-3 w-3" />
            Đã sửa
          </span>
        )}
      </p>
      <p className="break-words text-sm text-foreground">{value || "—"}</p>
    </div>
  );
}

function DocThumb({ path, label, showImages }: { path: string | null; label: string; showImages: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      {path && showImages ? (
        <KycImageThumb path={path} alt={label} className="aspect-[1.586] w-full" />
      ) : (
        <div className="flex aspect-[1.586] w-full items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
          {path ? "Đã ẩn" : "Không có"}
        </div>
      )}
    </div>
  );
}

function IdentityBlock({ v, showImages }: { v: IdentityView; showImages: boolean }) {
  const ed = new Set(v.edited);
  const f = (field: KycField) => ed.has(field);
  return (
    <>
      <div className="grid gap-1 sm:grid-cols-2">
        <Field label={KYC_FIELD_LABELS.full_name} value={v.full_name} edited={f("full_name")} />
        <Field label={`Số ${ID_TYPE_LABELS[v.id_type]}`} value={<span className="font-mono">{v.id_number}</span>} edited={f("id_number")} />
        <Field label={KYC_FIELD_LABELS.date_of_birth} value={formatDob(v.date_of_birth)} edited={f("date_of_birth")} />
        <Field label={KYC_FIELD_LABELS.gender} value={v.gender ? GENDER_LABELS[v.gender] : "—"} edited={f("gender")} />
        {v.phone !== undefined && <Field label="Số điện thoại" value={v.phone} />}
        <Field label={KYC_FIELD_LABELS.address} value={v.address} edited={f("address")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <DocThumb path={v.front} label={v.id_type === "passport" ? "Trang thông tin" : "Mặt trước"} showImages={showImages} />
        {v.id_type === "cccd" && <DocThumb path={v.back} label="Mặt sau" showImages={showImages} />}
      </div>
    </>
  );
}

function ReadMethodBadge({ method }: { method: ReadMethod | null }) {
  if (!method) return null;
  return <Badge variant="outline" className="text-[11px]">{READ_METHOD_LABELS[method]}</Badge>;
}

interface Props {
  contract: ContractWithSession;
  /** Ảnh chỉ đọc được khi hồ sơ còn 'paid' (can_read_buyer_kyc_object). */
  showImages: boolean;
}

/** Bản chụp người đăng ký trên hồ sơ: người mua / tổ chức / người ĐDPL / người được uỷ quyền + ảnh. */
export function ContractPartiesView({ contract: c, showImages }: Props) {
  const org = c.buyer_kind === "organization";

  return (
    <div className="space-y-4">
      <Section title="Người đăng ký" aside={<Badge variant="secondary">{BUYER_KIND_LABELS[c.buyer_kind]}</Badge>}>
        <div className="grid gap-1 sm:grid-cols-2">
          <Field label="Số điện thoại liên hệ" value={c.phone} />
          <Field label="Email" value={c.email} />
        </div>
      </Section>

      {org && (
        <Section title="Tổ chức">
          <div className="grid gap-1 sm:grid-cols-2">
            <Field label="Tên tổ chức" value={c.org_name} />
            <Field label="Mã số thuế" value={<span className="font-mono">{c.org_tax_code}</span>} />
            <div className="sm:col-span-2">
              <Field label="Địa chỉ trụ sở" value={c.org_address} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DocThumb path={c.org_reg_doc_path} label="Giấy chứng nhận ĐKDN" showImages={showImages} />
          </div>
        </Section>
      )}

      <Section
        title={org ? "Người đại diện theo pháp luật" : "Danh tính người đăng ký"}
        aside={
          <div className="flex items-center gap-1.5">
            {c.identity_source === "vneid" && <VneidVerifiedBadge />}
            <ReadMethodBadge method={c.id_read_method} />
          </div>
        }
      >
        <IdentityBlock
          showImages={showImages}
          v={{
            full_name: c.full_name,
            id_type: c.id_type,
            id_number: c.id_number,
            date_of_birth: c.date_of_birth,
            gender: c.gender,
            address: c.address,
            front: c.id_front_path,
            back: c.id_back_path,
            edited: c.id_edited_fields ?? [],
          }}
        />
      </Section>

      {c.has_proxy && c.proxy_full_name && c.proxy_id_type && c.proxy_id_number && (
        <Section title="Người được uỷ quyền" aside={<ReadMethodBadge method={c.proxy_id_read_method} />}>
          <IdentityBlock
            showImages={showImages}
            v={{
              full_name: c.proxy_full_name,
              id_type: c.proxy_id_type,
              id_number: c.proxy_id_number,
              date_of_birth: c.proxy_date_of_birth,
              gender: c.proxy_gender,
              address: c.proxy_address ?? "",
              phone: c.proxy_phone,
              front: c.proxy_id_front_path,
              back: c.proxy_id_back_path,
              edited: c.proxy_id_edited_fields ?? [],
            }}
          />
          <div className="grid grid-cols-2 gap-3">
            <DocThumb path={c.poa_doc_path} label="Giấy uỷ quyền" showImages={showImages} />
          </div>
        </Section>
      )}
    </div>
  );
}
