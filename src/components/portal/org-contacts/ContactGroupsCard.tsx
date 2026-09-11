import { Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useOrgContactGroups, useToggleGroupMember } from "@/hooks/useOrgContactGroups";
import type { OrgContactListRow } from "@/types/org-contacts";

interface Props {
  contact: OrgContactListRow;
  canEdit: boolean;
}

export function ContactGroupsCard({ contact, canEdit }: Props) {
  const { data: groups = [], isLoading } = useOrgContactGroups();
  const toggle = useToggleGroupMember();
  const memberOf = new Set(contact.group_ids);

  return (
    <Card className="space-y-4 rounded-2xl p-5">
      <div>
        <h2 className="font-semibold text-foreground">Nhóm khách hàng</h2>
        <p className="text-sm text-muted-foreground">
          Nhóm dùng để lọc danh sách gửi khi tiếp thị phiên. Tạo nhóm ở tab "Nhóm" của trang Khách hàng.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Đang tải nhóm…</p>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          <Users className="mx-auto mb-2 h-6 w-6" />
          Tổ chức chưa có nhóm khách hàng nào.
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {groups.map((g) => (
            <li key={g.id}>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 has-[:disabled]:cursor-default">
                <Checkbox
                  checked={memberOf.has(g.id)}
                  disabled={!canEdit || toggle.isPending}
                  onCheckedChange={(v) => toggle.mutate({ groupId: g.id, contactId: contact.id, member: v === true })}
                  className="mt-0.5"
                />
                <span className="min-w-0 text-sm">
                  <span className="block font-medium text-foreground">{g.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {g.member_count} khách{g.description ? ` · ${g.description}` : ""}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
