import { useState } from "react";
import { Pencil, Plus, Target, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InterestRowDialog } from "./InterestRowDialog";
import { useDeleteContactInterest } from "@/hooks/useOrgContactInterests";
import { interestParts } from "@/lib/orgContacts/interestLabel";
import type { OrgContactInterest, OrgContactListRow } from "@/types/org-contacts";

interface Props {
  contact: OrgContactListRow;
  canEdit: boolean;
}

/** Nhu cầu khai báo của khách — đầu vào DUY NHẤT của truy vấn chọn người nhận. */
export function InterestsCard({ contact, canEdit }: Props) {
  const del = useDeleteContactInterest();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OrgContactInterest | null>(null);
  const interests = contact.org_contact_interests;

  const open = (i: OrgContactInterest | null) => {
    setEditing(i);
    setDialogOpen(true);
  };

  return (
    <Card className="space-y-4 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground">Nhu cầu tài sản</h2>
          <p className="text-sm text-muted-foreground">
            Khách được chọn gửi tin cho một lô khi khớp <strong>bất kỳ</strong> nhu cầu nào dưới đây.
          </p>
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => open(null)}>
            <Plus className="h-4 w-4" />
            Thêm nhu cầu
          </Button>
        )}
      </div>

      {interests.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          <Target className="mx-auto mb-2 h-6 w-6" />
          Chưa khai nhu cầu — khách này sẽ không xuất hiện trong danh sách gửi của phiên nào.
        </div>
      ) : (
        <ul className="divide-y rounded-xl border">
          {interests.map((i) => {
            const [categories, region, price] = interestParts(i);
            return (
              <li key={i.id} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0 space-y-0.5 text-sm">
                  <p className="font-medium text-foreground">{categories}</p>
                  <p className="text-muted-foreground">
                    {region}
                    {price ? ` · ${price}` : ""}
                  </p>
                  {i.note && <p className="text-xs text-muted-foreground">{i.note}</p>}
                </div>
                {canEdit && (
                  <div className="flex shrink-0 gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Sửa nhu cầu" onClick={() => open(i)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      aria-label="Xoá nhu cầu"
                      disabled={del.isPending}
                      onClick={() => del.mutate(i.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <InterestRowDialog open={dialogOpen} onOpenChange={setDialogOpen} contactId={contact.id} editing={editing} />
    </Card>
  );
}
