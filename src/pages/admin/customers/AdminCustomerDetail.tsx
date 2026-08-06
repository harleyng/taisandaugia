import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Gavel, IdCard, Info, ListTodo, Loader2, MapPin, Megaphone, MoreHorizontal,
  Network, Pencil, Receipt, Target, Ticket as TicketIcon, Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { customerErrorMessage, useCustomer, useDeleteCustomer } from "@/hooks/useCustomers";
import { useCustomerAllOrders } from "@/hooks/useOrders";
import { useCustomerAdvertisements } from "@/hooks/useAdvertisements";
import { useUserCampaignRecipients } from "@/hooks/useCampaigns";
import { useCustomerOpportunities } from "@/hooks/useOpportunities";
import { useRelatedTasks } from "@/hooks/useTasks";
import { useRelatedTickets } from "@/hooks/useTickets";
import { useProspectStatsMap } from "@/hooks/useProspects";
import { useHasAdminPermission } from "@/hooks/useAdminPermissions";
import { CustomerFormDialog } from "@/components/admin/customers/CustomerFormDialog";
import { CustomerStatusBadge } from "@/components/admin/customers/CustomerStatusBadge";
import { CustomerStatusMenu } from "@/components/admin/customers/CustomerStatusMenu";
import { CustomerInfoTab } from "@/components/admin/customers/detail/CustomerInfoTab";
import { CustomerOrdersTab } from "@/components/admin/customers/detail/CustomerOrdersTab";
import { CustomerCampaignsTab } from "@/components/admin/customers/detail/CustomerCampaignsTab";
import { CustomerOpportunitiesTab } from "@/components/admin/customers/detail/CustomerOpportunitiesTab";
import AuctioneersTab from "@/components/admin/crm/AuctioneersTab";
import { ProspectAuctionHistoryTab } from "@/components/admin/crm/prospect/ProspectAuctionHistoryTab";
import { ProspectBranchesTab } from "@/components/admin/crm/prospect/ProspectBranchesTab";
import { RelatedTasksTab } from "@/components/admin/crm/tabs/RelatedTasksTab";
import { RelatedTicketsTab } from "@/components/admin/crm/tabs/RelatedTicketsTab";
import { segmentLabel } from "@/lib/customers/customerSegment";
import { CUSTOMER_TYPE_LABELS } from "@/lib/customers/customerStatus";
import { ENTITY_ROLE_LABELS, entityRole } from "@/lib/prospects/types";

const LIST_URL = "/admin/khach-hang";

// Slug tab hợp lệ trên URL (?tab=…) — deep-link được từ danh sách và từ cổng
// Công việc/Ticket.
const TAB_SLUGS = [
  "don-hang", "chien-dich", "co-hoi", "cong-viec", "tickets", "lich-su", "chi-nhanh",
  "dau-gia-vien",
];

const CountBadge = ({ n }: { n?: number }) =>
  n ? (
    <span className="text-[10px] bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded-full">
      {n}
    </span>
  ) : null;

export default function AdminCustomerDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: customer, isLoading, isError } = useCustomer(id);

  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const tab = TAB_SLUGS.includes(rawTab ?? "") ? (rawTab as string) : "thong-tin";

  const canEdit = useHasAdminPermission("khach-hang", "update");
  const canDelete = useHasAdminPermission("khach-hang", "delete");

  const del = useDeleteCustomer();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Đếm cho nhãn tab. Cùng queryKey với query bên trong tab nên React Query
  // dùng chung một lần fetch, không gọi hai lần.
  const relation = { customer_id: id ?? null };
  const { data: orders } = useCustomerAllOrders(id, customer?.user_id ?? null);
  const { data: ads } = useCustomerAdvertisements(id);
  const { data: emails } = useUserCampaignRecipients(customer?.user_id ?? null);
  const { data: opps } = useCustomerOpportunities(id);
  const { data: relatedTasks } = useRelatedTasks(relation);
  const { data: relatedTickets } = useRelatedTickets(relation);

  // Số liệu tài sản dùng chung cache với danh sách.
  const { data: prospectStats } = useProspectStatsMap();
  const stat = customer?.prospect_id
    ? prospectStats?.[`${customer.prospect_kind}:${customer.prospect_id}`]
    : undefined;

  const handleDelete = async () => {
    if (!customer) return;
    try {
      await del.mutateAsync(customer.id);
      toast.success("Đã xóa khách hàng");
      navigate(LIST_URL);
    } catch (err) {
      toast.error(customerErrorMessage(err) ?? "Xóa thất bại");
    }
    setDeleteOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !customer) {
    return (
      <div className="p-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(LIST_URL)} className="-ml-2 mb-4">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Khách hàng
        </Button>
        <p className="text-sm text-muted-foreground">Không tìm thấy khách hàng này.</p>
      </div>
    );
  }

  const hasHistory = !!customer.prospect_id && !!customer.prospect_kind;
  const role = stat ? entityRole(stat.entity_type, stat.parent_id) : null;
  // Cá nhân không có đơn vị thành viên; chi nhánh thì bản thân đã nằm dưới một
  // công ty mẹ nên cũng không quản lý cấp dưới — ẩn tab thay vì hiện bảng rỗng.
  const hasBranches = hasHistory && role === "main";
  // Chỉ công ty đấu giá mới có đội ngũ đấu giá viên — phân khúc khác ẩn hẳn tab.
  const isAuctionCompany = customer.segment === "auction_company";
  const campaignCount = (ads?.length ?? 0) + (emails?.length ?? 0);

  return (
    <div className="p-6 space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(LIST_URL)} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-1.5" /> Khách hàng
      </Button>

      {/* Header — trạng thái neo GÓC TRÊN-PHẢI và đổi ngay tại chỗ; thao tác
          nặng hơn dồn xuống đáy cột. Cùng khuôn với trang lead. */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-stretch justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="secondary">{segmentLabel(customer.segment)}</Badge>
              <Badge variant="outline">{CUSTOMER_TYPE_LABELS[customer.customer_type]}</Badge>
              {role && (
                <Badge
                  variant={role === "branch" ? "outline" : "secondary"}
                  className={role === "branch" ? "border-warning/40 text-warning" : ""}
                >
                  {ENTITY_ROLE_LABELS[role]}
                  {stat?.subtype === "amc" && " · AMC"}
                </Badge>
              )}
              {/* Mã lead nguồn — bấm để về đúng khách hàng tiềm năng đã sinh ra
                  khách hàng này (customers.source_lead_id). */}
              {customer.source_lead && (
                <button
                  onClick={() =>
                    navigate(`/admin/khach-hang-tiem-nang/${customer.source_lead!.id}`)
                  }
                  className="inline-flex items-center rounded-full border border-green-600/40 px-2.5 py-0.5 font-mono text-xs font-medium text-green-700 transition-colors hover:bg-green-50"
                  title={`Chuyển đổi từ ${customer.source_lead.name}`}
                >
                  ← {customer.source_lead.code ?? "lead"}
                </button>
              )}
            </div>
            <h1 className="text-2xl font-bold text-foreground break-words">{customer.name}</h1>
            <p className="font-mono text-sm text-muted-foreground mt-0.5">{customer.code ?? "—"}</p>
            {stat?.parent_name && (
              <p className="text-sm text-muted-foreground mt-1">
                Trực thuộc <strong className="text-foreground">{stat.parent_name}</strong>
              </p>
            )}
            {customer.address && (
              <p className="text-sm text-muted-foreground mt-2 inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {customer.address}
              </p>
            )}
          </div>

          <div className="flex flex-col justify-between items-end gap-4">
            {canEdit ? (
              <CustomerStatusMenu customerId={customer.id} status={customer.status} />
            ) : (
              <CustomerStatusBadge status={customer.status} />
            )}
            <div className="flex items-center gap-2">
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4 mr-1.5" />
                  Sửa
                </Button>
              )}
              {canDelete && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Xóa
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) =>
          setSearchParams(v === "thong-tin" ? {} : { tab: v }, { replace: true })
        }
      >
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="thong-tin" className="gap-1.5">
            <Info className="h-4 w-4" />
            Thông tin
          </TabsTrigger>
          <TabsTrigger value="don-hang" className="gap-1.5">
            <Receipt className="h-4 w-4" />
            Đơn hàng
            <CountBadge n={orders?.length} />
          </TabsTrigger>
          <TabsTrigger value="chien-dich" className="gap-1.5">
            <Megaphone className="h-4 w-4" />
            Chiến dịch
            <CountBadge n={campaignCount} />
          </TabsTrigger>
          {!!opps?.length && (
            <TabsTrigger value="co-hoi" className="gap-1.5">
              <Target className="h-4 w-4" />
              Cơ hội
              <CountBadge n={opps.length} />
            </TabsTrigger>
          )}
          <TabsTrigger value="cong-viec" className="gap-1.5">
            <ListTodo className="h-4 w-4" />
            Công việc
            <CountBadge n={relatedTasks?.length} />
          </TabsTrigger>
          <TabsTrigger value="tickets" className="gap-1.5">
            <TicketIcon className="h-4 w-4" />
            Tickets
            <CountBadge n={relatedTickets?.length} />
          </TabsTrigger>
          {isAuctionCompany && (
            <TabsTrigger value="dau-gia-vien" className="gap-1.5">
              <IdCard className="h-4 w-4" />
              Đấu giá viên
            </TabsTrigger>
          )}
          {hasHistory && (
            <TabsTrigger value="lich-su" className="gap-1.5">
              <Gavel className="h-4 w-4" />
              Lịch sử đấu giá
              <CountBadge n={stat?.total_listings} />
            </TabsTrigger>
          )}
          {hasBranches && (
            <TabsTrigger value="chi-nhanh" className="gap-1.5">
              <Network className="h-4 w-4" />
              Chi nhánh / AMC
              <CountBadge n={stat?.branch_count} />
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="thong-tin" className="mt-4 space-y-4">
          <CustomerInfoTab
            customer={customer}
            onboardStatus={stat?.onboard_status}
            entityType={stat?.entity_type}
            subtype={stat?.subtype}
            parentName={stat?.parent_name}
            parentId={stat?.parent_id}
            assetSummary={
              stat ? { listings: stat.total_listings, provinces: stat.province_count } : null
            }
          />
        </TabsContent>

        <TabsContent value="don-hang" className="mt-4">
          <CustomerOrdersTab customerId={customer.id} userId={customer.user_id} />
        </TabsContent>

        <TabsContent value="chien-dich" className="mt-4">
          <CustomerCampaignsTab
            customerId={customer.id}
            userId={customer.user_id}
            onLinkAccount={() => setEditOpen(true)}
          />
        </TabsContent>

        {!!opps?.length && (
          <TabsContent value="co-hoi" className="mt-4">
            <CustomerOpportunitiesTab customerId={customer.id} />
          </TabsContent>
        )}

        {isAuctionCompany && (
          <TabsContent value="dau-gia-vien" className="mt-4">
            <AuctioneersTab source={{ kind: "customer", id: customer.id }} />
          </TabsContent>
        )}

        <TabsContent value="cong-viec" className="mt-4">
          <RelatedTasksTab relation={{ customer_id: customer.id }} />
        </TabsContent>

        <TabsContent value="tickets" className="mt-4">
          <RelatedTicketsTab relation={{ customer_id: customer.id }} />
        </TabsContent>

        {hasHistory && (
          <TabsContent value="lich-su" className="mt-4">
            <ProspectAuctionHistoryTab
              kind={customer.prospect_kind!}
              prospectId={customer.prospect_id!}
            />
          </TabsContent>
        )}

        {hasBranches && (
          <TabsContent value="chi-nhanh" className="mt-4">
            <ProspectBranchesTab
              kind={customer.prospect_kind!}
              prospectId={customer.prospect_id!}
            />
          </TabsContent>
        )}
      </Tabs>

      <CustomerFormDialog open={editOpen} onOpenChange={setEditOpen} editing={customer} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa khách hàng?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{customer.name}&quot; sẽ bị xóa. Không xóa được nếu còn cơ hội hoặc đơn hàng
              đang gắn. Chiến dịch quảng cáo đang gắn khách hàng này sẽ được gỡ liên kết.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
