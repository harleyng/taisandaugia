import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, FileSignature, Loader2, Package, Pencil, Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSupplier } from "@/hooks/useSuppliers";
import { useSupplierContracts } from "@/hooks/useSupplierContracts";
import { useSupplierOrders } from "@/hooks/useOrders";
import { useServices } from "@/hooks/useServices";
import { useHasAdminPermission } from "@/hooks/useAdminPermissions";
import { CrmDetailHero } from "@/components/admin/crm/CrmDetailHero";
import { SupplierFormDialog } from "@/components/admin/suppliers/SupplierFormDialog";
import { SupplierStatusBadge } from "@/components/admin/suppliers/SupplierStatusBadge";
import { SupplierInfoTab } from "@/components/admin/suppliers/detail/SupplierInfoTab";
import { SupplierContractsTab } from "@/components/admin/suppliers/detail/SupplierContractsTab";
import { SupplierServicesTab } from "@/components/admin/suppliers/detail/SupplierServicesTab";
import { SupplierOrdersTab } from "@/components/admin/suppliers/detail/SupplierOrdersTab";
import { isInForce } from "@/lib/supplierContracts";
import { formatVnd } from "@/lib/advertising/slug";

const LIST_URL = "/admin/doi-tac";

// Slug tab hợp lệ trên URL (?tab=…) — deep-link được từ danh sách.
const TAB_SLUGS = ["hop-dong", "dich-vu", "don-hang"];

const CountBadge = ({ n }: { n?: number }) =>
  n ? (
    <span className="text-[10px] bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded-full">
      {n}
    </span>
  ) : null;

export default function AdminSupplierDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: supplier, isLoading, isError } = useSupplier(id);

  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const tab = TAB_SLUGS.includes(rawTab ?? "") ? (rawTab as string) : "thong-tin";

  const canEdit = useHasAdminPermission("nha-cung-cap", "update");
  const canDelete = useHasAdminPermission("nha-cung-cap", "delete");

  const [editOpen, setEditOpen] = useState(false);

  // Cùng queryKey với query bên trong tab ⇒ React Query dùng chung một lần fetch.
  const { data: contracts } = useSupplierContracts(id);
  const { data: orders } = useSupplierOrders(id);
  const { data: services } = useServices();

  const activeContracts = useMemo(
    () => (contracts ?? []).filter((c) => isInForce(c)).length,
    [contracts],
  );
  const serviceCount = useMemo(
    () => (services ?? []).filter((s) => s.supplier_id === id).length,
    [services, id],
  );
  // Hoa hồng ĐÃ GHI NHẬN = tổng `amount` (tiền thực về sàn) của đơn chưa hủy.
  // KHÔNG cộng `gross_amount` — đó là GMV, không phải doanh thu.
  const earned = useMemo(
    () =>
      (orders ?? [])
        .filter((o) => o.fulfillment_status !== "cancelled")
        .reduce((sum, o) => sum + Number(o.amount ?? 0), 0),
    [orders],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !supplier) {
    return (
      <div className="p-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(LIST_URL)} className="-ml-2 mb-4">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Đối tác
        </Button>
        <p className="text-sm text-muted-foreground">Không tìm thấy đối tác này.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(LIST_URL)} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-1.5" /> Đối tác
      </Button>

      <CrmDetailHero
        status={<SupplierStatusBadge status={supplier.status} />}
        code={supplier.code}
        badges={
          <>
            <Badge variant="outline">
              {supplier.supplier_type === "company" ? "Công ty" : "Cá nhân"}
            </Badge>
            {supplier.auction_org_id && <Badge variant="secondary">Tổ chức đấu giá</Badge>}
          </>
        }
        name={supplier.name}
        subtitle={
          supplier.tax_code ? (
            <span className="inline-flex items-center gap-1.5">MST {supplier.tax_code}</span>
          ) : null
        }
        stats={[
          { icon: FileSignature, label: "HĐ hiệu lực", value: activeContracts },
          { icon: Package, label: "Dịch vụ", value: serviceCount },
          { icon: Wallet, label: "Hoa hồng", value: formatVnd(earned) },
        ]}
        actions={
          canEdit ? (
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4 mr-1.5" />
              Sửa
            </Button>
          ) : null
        }
      />

      <Tabs
        value={tab}
        onValueChange={(v) =>
          setSearchParams(v === "thong-tin" ? {} : { tab: v }, { replace: true })
        }
      >
        <TabsList>
          <TabsTrigger value="thong-tin">Thông tin</TabsTrigger>
          <TabsTrigger value="hop-dong" className="gap-1.5">
            Hợp đồng <CountBadge n={contracts?.length} />
          </TabsTrigger>
          <TabsTrigger value="dich-vu" className="gap-1.5">
            Dịch vụ <CountBadge n={serviceCount} />
          </TabsTrigger>
          <TabsTrigger value="don-hang" className="gap-1.5">
            Đơn hàng <CountBadge n={orders?.length} />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="thong-tin" className="mt-4">
          <SupplierInfoTab supplier={supplier} />
        </TabsContent>
        <TabsContent value="hop-dong" className="mt-4">
          <SupplierContractsTab
            supplierId={supplier.id}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </TabsContent>
        <TabsContent value="dich-vu" className="mt-4">
          <SupplierServicesTab supplierId={supplier.id} />
        </TabsContent>
        <TabsContent value="don-hang" className="mt-4">
          <SupplierOrdersTab supplierId={supplier.id} />
        </TabsContent>
      </Tabs>

      <SupplierFormDialog open={editOpen} onOpenChange={setEditOpen} editing={supplier} />
    </div>
  );
}
