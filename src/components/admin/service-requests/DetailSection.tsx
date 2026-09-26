import { SERVICE_STATUS_TONE } from "@/lib/serviceRequests/groups";

/**
 * Thẻ của trang chi tiết yêu cầu dịch vụ — cùng kiểu thẻ "Thông tin cơ bản" ở chi tiết khách hàng:
 * các trường là ô nền nhạt xếp lưới. Thứ không phải trường (ghi chú, tệp, nút, trình soạn) phải
 * chiếm cả hàng — bọc bằng <Wide> hoặc dùng NoteBox (tự chiếm cả hàng).
 * `layout="stack"` cho thẻ chỉ chứa một khối lớn (checklist, trình soạn phương án).
 */
export function SectionCard({
  title,
  children,
  layout = "grid",
}: {
  title: string;
  children: React.ReactNode;
  layout?: "grid" | "stack";
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {layout === "grid" ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div> : children}
    </div>
  );
}

export function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/40 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 break-words text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

/** Khối chiếm cả hàng trong lưới của SectionCard. */
export function Wide({ children }: { children: React.ReactNode }) {
  return <div className="col-span-full">{children}</div>;
}

export function NoteBox({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "destructive" }) {
  const bg = tone === "destructive" ? "bg-destructive/5" : "bg-muted/40";
  return <p className={`col-span-full rounded-lg ${bg} px-4 py-3 text-sm text-foreground`}>{children}</p>;
}

/** Badge trạng thái gốc; nhãn do từng loại cung cấp, màu dùng chung theo mã trạng thái. */
export function ServiceStatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${SERVICE_STATUS_TONE[status] ?? "bg-muted"}`}
    >
      {label}
    </span>
  );
}
