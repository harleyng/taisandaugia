import { Card } from "@/components/ui/card";
import type { OrgContactListRow } from "@/types/org-contacts";

const fmtDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : null;

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{value || "—"}</dd>
    </div>
  );
}

export function ContactInfoCard({ contact }: { contact: OrgContactListRow }) {
  const consentAt = fmtDateTime(contact.consent_changed_at);
  const consent = contact.notifications_enabled
    ? `Đồng ý${consentAt ? ` — ghi nhận lúc ${consentAt}` : ""}`
    : `Chưa đồng ý${consentAt ? ` — thay đổi lúc ${consentAt}` : ""}`;

  return (
    <Card className="rounded-2xl p-5">
      <dl className="divide-y">
        <Row label="Mã khách" value={contact.code} />
        <Row label="Loại" value={contact.contact_type === "company" ? "Tổ chức" : "Cá nhân"} />
        {contact.contact_type === "company" && <Row label="Tên công ty" value={contact.company_name} />}
        <Row label="Điện thoại" value={contact.phone} />
        <Row label="Zalo" value={contact.zalo} />
        <Row label="Email" value={contact.email} />
        <Row label="Tỉnh/thành" value={contact.province} />
        <Row label="Nhận tin tiếp thị" value={consent} />
        <Row label="Nguồn" value={contact.source === "import" ? "Import từ file" : "Nhập tay"} />
        <Row label="Ngày thêm" value={fmtDateTime(contact.created_at)} />
        <Row label="Ghi chú" value={contact.note} />
      </dl>
    </Card>
  );
}
