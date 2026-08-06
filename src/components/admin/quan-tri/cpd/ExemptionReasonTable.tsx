import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { CpdExemptionReasonDef } from "@/types/cpd-catalog";
import { useCpdCatalogAdmin } from "@/hooks/useCpdCatalogAdmin";
import { ExemptionReasonDialog } from "./ExemptionReasonDialog";

interface Props {
  reasons: CpdExemptionReasonDef[];
  canEdit: boolean;
}

export function ExemptionReasonTable({ reasons, canEdit }: Props) {
  const { removeReason } = useCpdCatalogAdmin();
  const [editing, setEditing] = useState<CpdExemptionReasonDef | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);

  const nextSortOrder = (reasons.at(-1)?.sortOrder ?? 0) + 10;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Tổ chức chọn từ danh sách này khi đánh dấu đấu giá viên được miễn nghĩa
          vụ trong năm. Người được miễn tính là tuân thủ trên mọi báo cáo.
        </p>
        {canEdit && (
          <Button
            size="sm"
            className="shrink-0"
            onClick={() => { setEditing(undefined); setDialogOpen(true); }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Thêm trường hợp
          </Button>
        )}
      </div>

      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2.5">Trường hợp</th>
              <th className="text-left font-medium px-3 py-2.5 hidden md:table-cell w-36">Mã</th>
              <th className="text-left font-medium px-3 py-2.5 w-32">Minh chứng</th>
              <th className="text-left font-medium px-3 py-2.5 w-28">Trạng thái</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {reasons.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground text-xs">
                  Chưa có trường hợp miễn nào.
                </td>
              </tr>
            )}

            {reasons.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="px-3 py-2.5">
                  <p className="font-medium">{r.name}</p>
                  {r.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
                  )}
                </td>
                <td className="px-3 py-2.5 hidden md:table-cell">
                  <code className="text-xs text-muted-foreground">{r.code}</code>
                </td>
                <td className="px-3 py-2.5 text-xs">
                  {r.requiresEvidence ? "Bắt buộc" : "Không bắt buộc"}
                </td>
                <td className="px-3 py-2.5">
                  {r.isActive ? (
                    <Badge variant="secondary" className="font-normal text-xs">Đang dùng</Badge>
                  ) : (
                    <Badge variant="outline" className="font-normal text-xs text-muted-foreground">
                      Đã tắt
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  {canEdit && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setEditing(r); setDialogOpen(true); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => removeReason.mutate(r.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ExemptionReasonDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        existing={editing}
        nextSortOrder={nextSortOrder}
      />
    </div>
  );
}
