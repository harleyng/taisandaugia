import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCustomer } from "@/hooks/useCustomers";
import { useCustomerAdvertisements } from "@/hooks/useAdvertisements";
import { CustomerStatusBadge } from "@/components/admin/customers/CustomerStatusBadge";
import { CustomerFormDialog } from "@/components/admin/customers/CustomerFormDialog";
import { AdStatusBadge } from "@/components/admin/advertising/AdStatusBadge";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-32 shrink-0 text-sm text-muted-foreground">{label}:</span>
      <span className="text-sm text-foreground min-w-0 break-words">{children}</span>
    </div>
  );
}

export default function AdminCustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: customer, isLoading } = useCustomer(id);
  const { data: ads } = useCustomerAdvertisements(id);
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Không tìm thấy khách hàng.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/admin/khach-hang")}>
          Về danh sách
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/khach-hang")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-foreground truncate">{customer.name}</h1>
          <p className="text-xs text-muted-foreground font-mono">{customer.code ?? "—"}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4 mr-1.5" />
          Chỉnh sửa
        </Button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <h2 className="text-base font-semibold text-foreground mb-4">Thông tin khách hàng</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2.5 gap-x-8">
          <Row label="Tên">{customer.name}</Row>
          <Row label="Trạng thái"><CustomerStatusBadge status={customer.status} /></Row>
          <Row label="Loại">{customer.customer_type === "company" ? "Công ty" : "Cá nhân"}</Row>
          <Row label="Người liên hệ">{customer.contact_name || "—"}</Row>
          <Row label="Điện thoại">{customer.phone || "—"}</Row>
          <Row label="Email">{customer.email || "—"}</Row>
          <Row label="Mã số thuế">{customer.tax_code || "—"}</Row>
          <Row label="Địa chỉ">{customer.address || "—"}</Row>
          <Row label="Ghi chú">{customer.note || "—"}</Row>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 mt-5">
        <h2 className="text-base font-semibold text-foreground mb-3">
          Chiến dịch liên kết ({ads?.length ?? 0})
        </h2>
        {!ads || ads.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có chiến dịch nào gắn với khách hàng này.</p>
        ) : (
          <div className="divide-y divide-border">
            {ads.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate(`/admin/marketing/quang-cao/${a.id}`)}
                className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-muted/30 rounded-lg px-2 -mx-2 transition-colors"
              >
                <span className="font-mono text-xs text-primary w-24 shrink-0">{a.code ?? "—"}</span>
                <span className="flex-1 text-sm text-foreground truncate">{a.name}</span>
                <span className="text-xs text-muted-foreground hidden sm:block">{a.position?.name ?? ""}</span>
                <AdStatusBadge status={a.status} />
              </button>
            ))}
          </div>
        )}
      </div>

      <CustomerFormDialog open={editOpen} onOpenChange={setEditOpen} editing={customer} />
    </div>
  );
}
