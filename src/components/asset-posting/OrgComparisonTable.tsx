import { Award, CheckCircle2, Wifi } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EXPERIENCE_TIER_LABELS, type OrgMatchResult } from "@/lib/orgMatching";
import { OrgMatchCard } from "./OrgMatchCard";

interface OrgComparisonTableProps {
  results: OrgMatchResult[];
  selectedId: string | null;
  onSelect: (orgId: string) => void;
}

/** Bảng so sánh tổ chức đấu giá theo 4 tiêu chí: năng lực/kinh nghiệm · uy tín · cơ sở vật chất · thù lao. */
export function OrgComparisonTable({ results, selectedId, onSelect }: OrgComparisonTableProps) {
  return (
    <div>
      {/* Mobile: danh sách card */}
      <div className="space-y-3 sm:hidden">
        {results.map((r) => (
          <OrgMatchCard
            key={r.org.id}
            result={r}
            selected={selectedId === r.org.id}
            onSelect={() => onSelect(r.org.id)}
          />
        ))}
      </div>

      {/* Desktop: bảng so sánh */}
      <div className="hidden sm:block rounded-2xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="min-w-[180px]">Tổ chức đấu giá</TableHead>
              <TableHead>Năng lực / Kinh nghiệm</TableHead>
              <TableHead>Uy tín</TableHead>
              <TableHead>Cơ sở vật chất</TableHead>
              <TableHead className="text-right">Thù lao</TableHead>
              <TableHead className="text-center">Điểm khớp</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((r) => {
              const selected = selectedId === r.org.id;
              return (
                <TableRow key={r.org.id} className={selected ? "bg-primary/5" : undefined}>
                  <TableCell>
                    <div className="font-medium text-foreground">{r.org.name}</div>
                    {r.org.province && <div className="text-xs text-muted-foreground">{r.org.province}</div>}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5 text-sm">
                      <Award className="h-3.5 w-3.5 text-accent shrink-0" />
                      {EXPERIENCE_TIER_LABELS[r.attrs.experience_tier]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5 text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                      {r.attrs.successful_sessions} phiên
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {r.attrs.has_online_platform && (
                        <Badge variant="secondary" className="text-[10px] font-normal gap-1">
                          <Wifi className="h-2.5 w-2.5" /> Sàn trực tuyến
                        </Badge>
                      )}
                      {r.attrs.facilities.slice(0, 2).map((f) => (
                        <Badge key={f} variant="secondary" className="text-[10px] font-normal">
                          {f}
                        </Badge>
                      ))}
                      {r.attrs.facilities.length > 2 && (
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          +{r.attrs.facilities.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">~{r.attrs.commission_rate}%</TableCell>
                  <TableCell className="text-center">
                    <span className="text-base font-bold text-primary">{Math.round(r.score)}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      onClick={() => onSelect(r.org.id)}
                    >
                      {selected ? "Đã chọn" : "Chọn"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
