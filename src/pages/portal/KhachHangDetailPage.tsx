import { useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Pencil, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContactConsentBadge } from "@/components/portal/org-contacts/ContactConsentBadge";
import { ContactFormDialog } from "@/components/portal/org-contacts/ContactFormDialog";
import { ContactGroupsCard } from "@/components/portal/org-contacts/ContactGroupsCard";
import { ContactInfoCard } from "@/components/portal/org-contacts/ContactInfoCard";
import { ContactOutreachHistoryCard } from "@/components/portal/org-contacts/ContactOutreachHistoryCard";
import { DeleteConfirmDialog } from "@/components/portal/org-contacts/DeleteConfirmDialog";
import { InterestsCard } from "@/components/portal/org-contacts/InterestsCard";
import { useDeleteOrgContact, useOrgContact } from "@/hooks/useOrgContacts";
import { useHasOrgPermission } from "@/hooks/useOrgPermissions";

const TABS = ["thong-tin", "nhu-cau", "nhom", "lich-su"] as const;
type TabKey = (typeof TABS)[number];

/** /portal/khach-hang/:id — thông tin, nhu cầu, nhóm của một khách. */
export default function KhachHangDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const rawTab = params.get("tab");
  const tab: TabKey = TABS.includes(rawTab as TabKey) ? (rawTab as TabKey) : "thong-tin";

  const { data: contact, isLoading } = useOrgContact(id);
  const canEdit = useHasOrgPermission("khach-hang", "update");
  const canDelete = useHasOrgPermission("khach-hang", "delete");
  const del = useDeleteOrgContact();
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const back = () => navigate("/portal/khach-hang");
  const shell = (content: ReactNode) => (
    <div className="space-y-5 px-6 py-6">
      <Button variant="ghost" size="sm" className="-ml-2 gap-1.5" onClick={back}>
        <ArrowLeft className="h-4 w-4" />
        Danh bạ khách hàng
      </Button>
      {content}
    </div>
  );

  if (isLoading) {
    return shell(
      <Card className="flex items-center justify-center gap-2 rounded-2xl p-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Đang tải khách hàng…
      </Card>,
    );
  }

  if (!contact) {
    return shell(
      <Card className="space-y-3 rounded-2xl p-10 text-center">
        <ShieldAlert className="mx-auto h-9 w-9 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Không tìm thấy khách hàng, hoặc bạn không có quyền xem.</p>
      </Card>,
    );
  }

  return shell(
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">{contact.full_name}</h1>
            <ContactConsentBadge enabled={contact.notifications_enabled} status={contact.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{contact.code}</span>
            {contact.company_name ? ` · ${contact.company_name}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {canDelete && (
            <Button variant="outline" size="sm" className="gap-1.5 text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" />
              Xoá
            </Button>
          )}
          {canEdit && (
            <Button size="sm" className="gap-1.5" onClick={() => setFormOpen(true)}>
              <Pencil className="h-4 w-4" />
              Sửa thông tin
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="thong-tin">Thông tin</TabsTrigger>
          <TabsTrigger value="nhu-cau">Nhu cầu ({contact.org_contact_interests.length})</TabsTrigger>
          <TabsTrigger value="nhom">Nhóm ({contact.group_ids.length})</TabsTrigger>
          <TabsTrigger value="lich-su">Lịch sử tiếp thị</TabsTrigger>
        </TabsList>
        <TabsContent value="thong-tin" className="mt-4">
          <ContactInfoCard contact={contact} />
        </TabsContent>
        <TabsContent value="nhu-cau" className="mt-4">
          <InterestsCard contact={contact} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="nhom" className="mt-4">
          <ContactGroupsCard contact={contact} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="lich-su" className="mt-4">
          <ContactOutreachHistoryCard contactId={contact.id} />
        </TabsContent>
      </Tabs>

      <ContactFormDialog open={formOpen} onOpenChange={setFormOpen} editing={contact} />
      <DeleteConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Xoá khách hàng?"
        description={`"${contact.full_name}" sẽ bị xoá cùng nhu cầu và tư cách thành viên nhóm. Không hoàn tác được.`}
        pending={del.isPending}
        onConfirm={() => del.mutate(contact.id, { onSuccess: back })}
      />
    </>,
  );
}
