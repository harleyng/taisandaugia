import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContactTable } from "./ContactTable";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { useDeleteOrgContact, useUpdateContactFlags } from "@/hooks/useOrgContacts";
import type { OrgContactGroup, OrgContactListRow } from "@/types/org-contacts";

type ConsentFilter = "all" | "consented" | "not_consented" | "inactive";

const PILLS: { key: ConsentFilter; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "consented", label: "Đồng ý nhận tin" },
  { key: "not_consented", label: "Chưa đồng ý" },
  { key: "inactive", label: "Ngừng theo dõi" },
];

const matchesPill = (c: OrgContactListRow, key: ConsentFilter) => {
  if (key === "all") return true;
  if (key === "inactive") return c.status === "inactive";
  return c.status === "active" && c.notifications_enabled === (key === "consented");
};

const pill = (active: boolean) =>
  [
    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
  ].join(" ");

interface Props {
  contacts: OrgContactListRow[];
  groups: OrgContactGroup[];
  isLoading: boolean;
  groupFilter: string;
  onGroupFilterChange: (id: string) => void;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (c: OrgContactListRow) => void;
}

export function ContactsSection({
  contacts, groups, isLoading, groupFilter, onGroupFilterChange, canEdit, canDelete, onEdit,
}: Props) {
  const navigate = useNavigate();
  const flags = useUpdateContactFlags();
  const del = useDeleteOrgContact();
  const [search, setSearch] = useState("");
  const [consent, setConsent] = useState<ConsentFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<OrgContactListRow | null>(null);

  const groupNames = useMemo(() => new Map(groups.map((g) => [g.id, g.name])), [groups]);

  const counts = useMemo(
    () => Object.fromEntries(PILLS.map((p) => [p.key, contacts.filter((c) => matchesPill(c, p.key)).length])),
    [contacts],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (!matchesPill(c, consent)) return false;
      if (groupFilter !== "all" && !c.group_ids.includes(groupFilter)) return false;
      if (!q) return true;
      return [c.full_name, c.code, c.phone, c.email, c.zalo, c.company_name, c.province]
        .some((v) => (v ?? "").toLowerCase().includes(q));
    });
  }, [contacts, consent, groupFilter, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1">
        {PILLS.map((p) => (
          <button key={p.key} className={pill(consent === p.key)} onClick={() => setConsent(p.key)}>
            {p.label} <span className="text-xs opacity-70">({counts[p.key] ?? 0})</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên, mã, SĐT, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={groupFilter} onValueChange={onGroupFilterChange}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Tất cả nhóm" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả nhóm</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name} ({g.member_count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ContactTable
        rows={filtered}
        isLoading={isLoading}
        groupName={(id) => groupNames.get(id)}
        canEdit={canEdit}
        canDelete={canDelete}
        onOpen={(c) => navigate(`/portal/khach-hang/${c.id}`)}
        onEdit={onEdit}
        onDelete={setDeleteTarget}
        onToggleConsent={(c) => flags.mutate({ id: c.id, patch: { notifications_enabled: !c.notifications_enabled } })}
        onToggleStatus={(c) =>
          flags.mutate({ id: c.id, patch: { status: c.status === "active" ? "inactive" : "active" } })
        }
      />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Xoá khách hàng?"
        description={`"${deleteTarget?.full_name ?? ""}" sẽ bị xoá cùng nhu cầu và tư cách thành viên nhóm. Không hoàn tác được.`}
        pending={del.isPending}
        onConfirm={() => deleteTarget && del.mutate(deleteTarget.id, { onSettled: () => setDeleteTarget(null) })}
      />
    </div>
  );
}
