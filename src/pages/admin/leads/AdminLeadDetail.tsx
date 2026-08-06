import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Gavel, IdCard, Info, ListTodo, Loader2, MapPin, MoreHorizontal, Network,
  Pencil, Ticket as TicketIcon, Trash2, UserCheck,
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
import { useLead, useDeleteLead, useConvertLead, leadErrorMessage } from "@/hooks/useLeads";
import { useRelatedTasks } from "@/hooks/useTasks";
import { useRelatedTickets } from "@/hooks/useTickets";
import { useProspectStatsMap } from "@/hooks/useProspects";
import { LeadFormDialog } from "@/components/admin/leads/LeadFormDialog";
import { LeadStatusMenu } from "@/components/admin/leads/LeadStatusMenu";
import { LeadInfoTab } from "@/components/admin/leads/detail/LeadInfoTab";
import { ProspectAuctionHistoryTab } from "@/components/admin/crm/prospect/ProspectAuctionHistoryTab";
import { ProspectBranchesTab } from "@/components/admin/crm/prospect/ProspectBranchesTab";
import AuctioneersTab from "@/components/admin/crm/AuctioneersTab";
import { RelatedTasksTab } from "@/components/admin/crm/tabs/RelatedTasksTab";
import { RelatedTicketsTab } from "@/components/admin/crm/tabs/RelatedTicketsTab";
import { SOURCE_LABELS, LEAD_TYPE_LABELS, MARKET_DATA_SOURCE } from "@/lib/leads/leadStatus";
import { ENTITY_ROLE_LABELS, entityRole } from "@/lib/prospects/types";
import type { CustomerSegment } from "@/lib/customers/customerSegment";

const LIST_URL = "/admin/khach-hang-tiem-nang";

// Slug tab hợp lệ trên URL (?tab=…) — deep-link được từ cổng Công việc/Ticket.
const TAB_SLUGS = ["lich-su", "chi-nhanh", "cong-viec", "tickets", "dau-gia-vien"];

export default function AdminLeadDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: lead, isLoading, isError } = useLead(id);

  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const tab = TAB_SLUGS.includes(rawTab ?? "") ? (rawTab as string) : "thong-tin";

  const del = useDeleteLead();
  const convert = useConvertLead();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);

  // Đếm cho nhãn tab. Cùng queryKey với query bên trong tab nên React Query
  // dùng chung một lần fetch, không gọi hai lần.
  const relation = { lead_id: id ?? null };
  const { data: relatedTasks } = useRelatedTasks(relation);
  const { data: relatedTickets } = useRelatedTickets(relation);

  // Số liệu tài sản dùng chung cache với danh sách.
  const { data: prospectStats } = useProspectStatsMap();
  const stat = lead?.prospect_id
    ? prospectStats?.[`${lead.prospect_kind}:${lead.prospect_id}`]
    : undefined;

  const handleDelete = async () => {
    if (!lead) return;
    try {
      await del.mutateAsync(lead.id);
      toast.success("Đã xóa khách hàng tiềm năng");
      navigate(LIST_URL);
    } catch {
      toast.error("Xóa thất bại — có thể còn cơ hội đang gắn");
    }
    setDeleteOpen(false);
  };

  const handleConvert = async () => {
    if (!lead) return;
    try {
      await convert.mutateAsync({ leadId: lead.id });
      toast.success("Đã chuyển thành khách hàng");
    } catch (err) {
      toast.error(leadErrorMessage(err) ?? "Chuyển đổi thất bại");
    }
    setConvertOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !lead) {
    return (
      <div className="p-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(LIST_URL)} className="-ml-2 mb-4">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Khách hàng tiềm năng
        </Button>
        <p className="text-sm text-muted-foreground">Không tìm thấy khách hàng tiềm năng này.</p>
      </div>
    );
  }

  const converted = lead.status === "converted";
  const hasHistory = !!lead.prospect_id && !!lead.prospect_kind;
  const role = stat ? entityRole(stat.entity_type, stat.parent_id) : null;
  // Cá nhân không có đơn vị thành viên; chi nhánh thì bản thân đã nằm dưới một
  // công ty mẹ nên cũng không quản lý cấp dưới — ẩn tab thay vì hiện bảng rỗng.
  const hasBranches = hasHistory && role === "main";
  // Lead trỏ thẳng tới auction_organizations qua prospect_id — không phải suy
  // qua ba con trỏ như bên Khách hàng.
  const auctionOrgId = lead.prospect_kind === "auction_org" ? lead.prospect_id : null;

  return (
    <div className="p-6 space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(LIST_URL)} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-1.5" /> Khách hàng tiềm năng
      </Button>

      {/* Header — thao tác neo ở GÓC DƯỚI-PHẢI của card (items-stretch để cột
          phải cao bằng cột trái, justify-end đẩy nút xuống đáy). */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-stretch justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="outline">
                {SOURCE_LABELS[lead.source] ?? lead.source}
              </Badge>
              <Badge variant="secondary">
                {LEAD_TYPE_LABELS[lead.lead_type as CustomerSegment] ?? "Khác"}
              </Badge>
              {/* Chi nhánh cũng là một khách hàng tiềm năng độc lập — badge này
                  là thứ duy nhất phân biệt nó với trụ sở chính. */}
              {role && (
                <Badge
                  variant={role === "branch" ? "outline" : "secondary"}
                  className={role === "branch" ? "border-warning/40 text-warning" : ""}
                >
                  {ENTITY_ROLE_LABELS[role]}
                  {stat?.subtype === "amc" && " · AMC"}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold text-foreground break-words">{lead.name}</h1>
            <p className="font-mono text-sm text-muted-foreground mt-0.5">{lead.code ?? "—"}</p>
            {stat?.parent_name && (
              <p className="text-sm text-muted-foreground mt-1">
                Trực thuộc <strong className="text-foreground">{stat.parent_name}</strong>
              </p>
            )}
            {lead.province && (
              <p className="text-sm text-muted-foreground mt-2 inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {lead.province}
              </p>
            )}
          </div>

          {/* Trạng thái neo GÓC TRÊN-PHẢI và đổi ngay tại chỗ; các thao tác
              nặng hơn (sửa / chuyển đổi / xóa) dồn xuống đáy cột. */}
          <div className="flex flex-col justify-between items-end gap-4">
            <LeadStatusMenu leadId={lead.id} status={lead.status} />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4 mr-1.5" />
                Sửa
              </Button>
              <Button size="sm" disabled={converted} onClick={() => setConvertOpen(true)}>
                <UserCheck className="h-4 w-4 mr-1.5" />
                {converted ? "Đã chuyển đổi" : "Chuyển thành khách hàng"}
              </Button>
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
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={tab}
        onValueChange={(v) =>
          setSearchParams(v === "thong-tin" ? {} : { tab: v }, { replace: true })
        }
      >
        <TabsList>
          <TabsTrigger value="thong-tin" className="gap-1.5">
            <Info className="h-4 w-4" />
            Thông tin
          </TabsTrigger>
          <TabsTrigger value="cong-viec" className="gap-1.5">
            <ListTodo className="h-4 w-4" />
            Công việc
            {!!relatedTasks?.length && (
              <span className="text-[10px] bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded-full">
                {relatedTasks.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="tickets" className="gap-1.5">
            <TicketIcon className="h-4 w-4" />
            Tickets
            {!!relatedTickets?.length && (
              <span className="text-[10px] bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded-full">
                {relatedTickets.length}
              </span>
            )}
          </TabsTrigger>
          {auctionOrgId && (
            <TabsTrigger value="dau-gia-vien" className="gap-1.5">
              <IdCard className="h-4 w-4" />
              Đấu giá viên
            </TabsTrigger>
          )}
          {hasHistory && (
            <TabsTrigger value="lich-su" className="gap-1.5">
              <Gavel className="h-4 w-4" />
              Lịch sử đấu giá
              {stat && (
                <span className="text-[10px] bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded-full">
                  {stat.total_listings}
                </span>
              )}
            </TabsTrigger>
          )}
          {hasBranches && (
            <TabsTrigger value="chi-nhanh" className="gap-1.5">
              <Network className="h-4 w-4" />
              Chi nhánh / AMC
              {!!stat?.branch_count && (
                <span className="text-[10px] bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded-full">
                  {stat.branch_count}
                </span>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="thong-tin" className="mt-4">
          <LeadInfoTab
            lead={lead}
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

        {auctionOrgId && (
          <TabsContent value="dau-gia-vien" className="mt-4">
            <AuctioneersTab source={{ kind: "auctionOrg", id: auctionOrgId }} />
          </TabsContent>
        )}

        <TabsContent value="cong-viec" className="mt-4">
          <RelatedTasksTab relation={{ lead_id: lead.id }} />
        </TabsContent>

        <TabsContent value="tickets" className="mt-4">
          <RelatedTicketsTab relation={{ lead_id: lead.id }} />
        </TabsContent>

        {hasHistory && (
          <TabsContent value="lich-su" className="mt-4">
            <ProspectAuctionHistoryTab kind={lead.prospect_kind!} prospectId={lead.prospect_id!} />
          </TabsContent>
        )}

        {hasBranches && (
          <TabsContent value="chi-nhanh" className="mt-4">
            <ProspectBranchesTab kind={lead.prospect_kind!} prospectId={lead.prospect_id!} />
          </TabsContent>
        )}
      </Tabs>

      <LeadFormDialog open={editOpen} onOpenChange={setEditOpen} editing={lead} />

      <AlertDialog open={convertOpen} onOpenChange={setConvertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Chuyển thành khách hàng?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{lead.name}&quot; sẽ được tạo thành khách hàng, và mọi cơ hội đang gắn sẽ chuyển
              sang khách hàng đó. Nếu đã có khách trùng SĐT/email, hệ thống sẽ báo để bạn gộp thay vì
              tạo mới.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleConvert}>Chuyển đổi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa khách hàng tiềm năng?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{lead.name}&quot; sẽ bị xóa. Không xóa được nếu còn cơ hội đang gắn.
              {lead.source === MARKET_DATA_SOURCE && (
                <>
                  {" "}Lưu ý: đây là lead sinh từ dữ liệu sàn — nếu pháp nhân này vẫn còn tài sản
                  trên sàn thì lần đồng bộ sau sẽ tạo lại.
                </>
              )}
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
