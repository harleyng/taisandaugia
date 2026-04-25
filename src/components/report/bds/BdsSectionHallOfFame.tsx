import { Trophy, Tag } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReportSection } from "../ReportSection";
import { bdsTopBidWars, bdsTopDeals } from "@/lib/mockBdsReport";
import { cn } from "@/lib/utils";

interface Row {
  date: string;
  location: string;
  type: string;
  area: string;
  start: number;
  win: number;
  delta: number;
}

const SessionTable = ({ rows, deltaPositive }: { rows: Row[]; deltaPositive: boolean }) => (
  <div className="overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">Ngày</TableHead>
          <TableHead>Vị trí</TableHead>
          <TableHead>Loại</TableHead>
          <TableHead className="text-right">DT</TableHead>
          <TableHead className="text-right">Khởi điểm</TableHead>
          <TableHead className="text-right">Trúng</TableHead>
          <TableHead className="text-right">Chênh</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, idx) => (
          <TableRow key={idx} className="cursor-pointer">
            <TableCell className="font-medium tabular-nums">{r.date}</TableCell>
            <TableCell>{r.location}</TableCell>
            <TableCell>{r.type}</TableCell>
            <TableCell className="text-right tabular-nums">{r.area}</TableCell>
            <TableCell className="text-right tabular-nums">{r.start.toFixed(1)} tỷ</TableCell>
            <TableCell className="text-right tabular-nums font-semibold">
              {r.win.toFixed(1)} tỷ
            </TableCell>
            <TableCell
              className={cn(
                "text-right tabular-nums font-semibold",
                deltaPositive ? "text-accent" : "text-muted-foreground",
              )}
            >
              {r.delta > 0 ? "+" : ""}
              {r.delta.toFixed(1)}%
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

export const BdsSectionHallOfFame = () => (
  <ReportSection
    id="bds-b4"
    label="B4"
    title="Hall of Fame — phiên đáng chú ý"
    keyInsight="Bidding war cực mạnh tập trung ở nhà phố trung tâm Q.1 và Cầu Giấy — chênh lệch lên tới +114%. Ngược lại, deal hiếm thường rơi vào lô đất NN diện tích lớn."
    deepDiveLabel=""
    hideDeepDive
  >
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold text-foreground">
            Top 5 phiên có chênh lệch cao nhất (bidding wars)
          </h3>
        </div>
        <SessionTable rows={bdsTopBidWars} deltaPositive />
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Tag className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Top 5 phiên trúng gần / dưới khởi điểm (deal hiếm)
          </h3>
        </div>
        <SessionTable rows={bdsTopDeals} deltaPositive={false} />
      </Card>
    </div>
  </ReportSection>
);
