import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AudienceReasons } from "./AudienceReasons";
import type { AuctionSessionItem } from "@/types/auction-session";
import type { AudienceRow, OrgContactInterest } from "@/types/org-contacts";

interface Props {
  rows: AudienceRow[];
  lotsById: Map<string, AuctionSessionItem>;
  interestsById: Map<string, OrgContactInterest>;
  groupName: (id: string) => string | undefined;
  /** Có ⇒ hiện cột chọn để ghi nhận liên hệ. */
  selection?: {
    selected: ReadonlySet<string>;
    onChange: (next: Set<string>) => void;
  };
  contactedAt?: Map<string, string>;
}

const shortWhen = (iso: string) => new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });

export function AudienceTable({ rows, lotsById, interestsById, groupName, selection, contactedAt }: Props) {
  const navigate = useNavigate();
  const allSelected = !!selection && rows.length > 0 && rows.every((r) => selection.selected.has(r.contact_id));

  const toggle = (id: string, on: boolean) => {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (on) next.add(id);
    else next.delete(id);
    selection.onChange(next);
  };

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            {selection && (
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  aria-label="Chọn tất cả"
                  onCheckedChange={(v) => selection.onChange(v === true ? new Set(rows.map((r) => r.contact_id)) : new Set())}
                />
              </TableHead>
            )}
            <TableHead>Khách hàng</TableHead>
            <TableHead>Liên hệ</TableHead>
            <TableHead className="min-w-[280px]">Lô khớp & lý do</TableHead>
            <TableHead>Nhóm</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const contacted = contactedAt?.get(r.contact_id);
            return (
              <TableRow key={r.contact_id} className="cursor-pointer" onClick={() => navigate(`/portal/khach-hang/${r.contact_id}`)}>
                {selection && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selection.selected.has(r.contact_id)}
                      aria-label={`Chọn ${r.full_name}`}
                      onCheckedChange={(v) => toggle(r.contact_id, v === true)}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <p className="font-medium text-foreground">{r.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">{r.code}</span>
                    {r.company_name ? ` · ${r.company_name}` : ""}
                  </p>
                  {contacted && (
                    <Badge variant="outline" className="mt-1 border-success/30 bg-success/10 font-normal text-success">
                      Đã liên hệ {shortWhen(contacted)}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {r.phone && <p>{r.phone}</p>}
                  {r.zalo && r.zalo !== r.phone && <p className="text-muted-foreground">Zalo: {r.zalo}</p>}
                  {r.email && <p className="text-muted-foreground">{r.email}</p>}
                </TableCell>
                <TableCell>
                  <AudienceReasons reasons={r.reasons} lotsById={lotsById} interestsById={interestsById} />
                </TableCell>
                <TableCell>
                  <div className="flex max-w-[180px] flex-wrap gap-1">
                    {r.group_ids.map(groupName).filter(Boolean).map((g) => (
                      <Badge key={g} variant="secondary" className="font-normal">{g}</Badge>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
