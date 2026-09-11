import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FileDown, FileUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContactFormDialog } from "@/components/portal/org-contacts/ContactFormDialog";
import { ContactImportDialog } from "@/components/portal/org-contacts/ContactImportDialog";
import { ContactsSection } from "@/components/portal/org-contacts/ContactsSection";
import { GroupsSection } from "@/components/portal/org-contacts/GroupsSection";
import { useOrgContactGroups } from "@/hooks/useOrgContactGroups";
import { useOrgContacts } from "@/hooks/useOrgContacts";
import { useHasOrgPermission } from "@/hooks/useOrgPermissions";
import { exportContactsXlsx } from "@/lib/orgContacts/contactExport";
import type { OrgContactListRow } from "@/types/org-contacts";

type TabKey = "lien-he" | "nhom";

/** /portal/khach-hang — danh bạ khách hàng RIÊNG của tổ chức. */
export default function KhachHangPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab: TabKey = params.get("tab") === "nhom" ? "nhom" : "lien-he";
  const groupFilter = params.get("nhom") ?? "all";

  const { data: contacts = [], isLoading } = useOrgContacts();
  const { data: groups = [], isLoading: groupsLoading } = useOrgContactGroups();
  const canCreate = useHasOrgPermission("khach-hang", "create");
  const canEdit = useHasOrgPermission("khach-hang", "update");
  const canDelete = useHasOrgPermission("khach-hang", "delete");
  const canExport = useHasOrgPermission("khach-hang", "export");

  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<OrgContactListRow | null>(null);

  const setQuery = (next: { tab?: TabKey; nhom?: string }) => {
    const p = new URLSearchParams(params);
    if (next.tab) p.set("tab", next.tab);
    if (next.nhom !== undefined) {
      if (next.nhom === "all") p.delete("nhom");
      else p.set("nhom", next.nhom);
    }
    setParams(p, { replace: true });
  };

  const consented = contacts.filter((c) => c.status === "active" && c.notifications_enabled).length;
  const groupName = (id: string) => groups.find((g) => g.id === id)?.name;

  return (
    <div className="space-y-5 px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Khách hàng</h1>
          <p className="text-sm text-muted-foreground">
            {contacts.length} khách · {consented} đồng ý nhận tin · Danh bạ riêng của tổ chức, dùng để chọn người nhận
            khi tiếp thị phiên đấu giá.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canExport && contacts.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportContactsXlsx(contacts, groupName)}>
              <FileDown className="h-4 w-4" />
              Xuất Excel
            </Button>
          )}
          {canCreate && (
            <>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setImportOpen(true)}>
                <FileUp className="h-4 w-4" />
                Import
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Thêm khách hàng
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setQuery({ tab: v as TabKey })}>
        <TabsList>
          <TabsTrigger value="lien-he">Liên hệ ({contacts.length})</TabsTrigger>
          <TabsTrigger value="nhom">Nhóm ({groups.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="lien-he" className="mt-4">
          <ContactsSection
            contacts={contacts}
            groups={groups}
            isLoading={isLoading}
            groupFilter={groupFilter}
            onGroupFilterChange={(id) => setQuery({ nhom: id })}
            canEdit={canEdit}
            canDelete={canDelete}
            onEdit={(c) => {
              setEditing(c);
              setFormOpen(true);
            }}
          />
        </TabsContent>
        <TabsContent value="nhom" className="mt-4">
          <GroupsSection
            groups={groups}
            isLoading={groupsLoading}
            canCreate={canCreate}
            canEdit={canEdit}
            canDelete={canDelete}
            onOpenGroup={(g) => setQuery({ tab: "lien-he", nhom: g.id })}
          />
        </TabsContent>
      </Tabs>

      <ContactFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        onCreated={(id) => navigate(`/portal/khach-hang/${id}?tab=nhu-cau`)}
      />
      <ContactImportDialog open={importOpen} onOpenChange={setImportOpen} existing={contacts} />
    </div>
  );
}
