import { useQuery } from "@tanstack/react-query";
import { Gavel, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { groupNumber } from "@/lib/advertising/slug";
import { commissionLabel } from "@/lib/supplierContracts";
import type { Supplier } from "@/types/supplier";

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
    <p className="text-sm text-foreground break-words">{value || "—"}</p>
  </div>
);

function useAuctionOrgName(id: string | null) {
  return useQuery<string | null>({
    queryKey: ["auction-org-name", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auction_organizations")
        .select("name")
        .eq("id", id as string)
        .single();
      if (error) throw error;
      return data?.name ?? null;
    },
    enabled: !!id,
  });
}

export function SupplierInfoTab({ supplier }: { supplier: Supplier }) {
  const { data: orgName } = useAuctionOrgName(supplier.auction_org_id);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-medium text-foreground mb-4">Thông tin pháp nhân</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Mã đối tác" value={supplier.code} />
          <Field
            label="Loại"
            value={supplier.supplier_type === "company" ? "Công ty" : "Cá nhân"}
          />
          <Field label="Mã số thuế" value={supplier.tax_code} />
          <Field label="Người liên hệ" value={supplier.contact_name} />
          <Field label="Số điện thoại" value={supplier.phone} />
          <Field label="Email" value={supplier.email} />
          <div className="col-span-2 md:col-span-3">
            <Field label="Địa chỉ" value={supplier.address} />
          </div>
          <Field label="Ngân hàng" value={supplier.bank_name} />
          <Field label="Số tài khoản" value={supplier.bank_account} />
          <Field
            label="Hoa hồng mặc định"
            value={commissionLabel(
              supplier.default_commission_type,
              supplier.default_commission_rate,
              groupNumber,
            )}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-medium text-foreground mb-1">Tổ chức đấu giá trên sàn</p>
        <p className="text-xs text-muted-foreground mb-4">
          Liên kết này là cây cầu để hệ thống tự tra hợp đồng khi tổ chức thắng một yêu cầu
          ký gửi. Chưa gắn thì hoa hồng phải nhập tay ở từng đơn.
        </p>
        {supplier.auction_org_id ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
              <Gavel className="h-4 w-4 text-primary" />
              {orgName ?? "Đang tải…"}
            </span>
            <Button
              variant="ghost" size="sm" className="h-7 text-xs"
              onClick={() =>
                window.open(`/auction-org/${supplier.auction_org_id}`, "_blank", "noopener")
              }
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Xem hồ sơ
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Chưa gắn tổ chức đấu giá — bấm &quot;Sửa&quot; để chọn.
          </p>
        )}
      </div>

      {supplier.note && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-medium text-foreground mb-2">Ghi chú</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{supplier.note}</p>
        </div>
      )}
    </div>
  );
}
