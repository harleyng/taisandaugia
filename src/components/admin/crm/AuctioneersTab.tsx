import { useState } from "react";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Auctioneer } from "@/types/auctioneer";
import { POSITION_LABELS, computeDaysUntilExpiry } from "@/types/auctioneer";
import type { DossierEvent } from "@/types/personnel";
import { evaluatePerson } from "@/lib/personnel/cpd";
import { formLabel } from "@/lib/personnel/cpd-catalog";
import { useCpdCatalog } from "@/hooks/useCpdCatalog";
import { CpdProofBadge, CpdStatusBadge } from "@/components/cpd/CpdStatusBadge";
import { useAdminOrgAuctioneers, type AuctioneerSource } from "@/hooks/useAdminOrgAuctioneers";
import AuctioneerDetailSheet from "./AuctioneerDetailSheet";

interface Props {
  source: AuctioneerSource;
}

const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString("vi-VN") : "—");

/**
 * Đội ngũ đấu giá viên của một công ty đấu giá — dùng chung cho tab bên Khách
 * hàng và bên Khách hàng tiềm năng. Xem `useAdminOrgAuctioneers` để biết cách
 * nối bản ghi CRM với tổ chức.
 */
export default function AuctioneersTab({ source }: Props) {
  const { data, isLoading } = useAdminOrgAuctioneers(source);
  const { index, resolve } = useCpdCatalog();
  const [selected, setSelected] = useState<Auctioneer | null>(null);
  const year = new Date().getFullYear();

  const labelOf = (e: DossierEvent) => formLabel(
    e.cpdActivityTypeId ? index.typeById.get(e.cpdActivityTypeId) : undefined,
    e.cpdActivityRoleId ? index.roleById.get(e.cpdActivityRoleId) : undefined,
  );

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          Đội ngũ đấu giá viên ({data?.auctioneers.length ?? 0})
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Dữ liệu do chính tổ chức khai trên cổng /portal. Bấm một dòng để xem hồ sơ
          đầy đủ. Chỉ đọc — sàn không sửa hồ sơ của tổ chức.
        </p>
      </div>

      {isLoading && <div className="h-24 rounded-lg bg-muted animate-pulse" />}

      {/* Nói rõ vì sao rỗng: bảng customers không có cột nối tổ chức, nên "không
          có dữ liệu" và "chưa nối được" là hai chuyện khác nhau. */}
      {!isLoading && data?.resolvedVia === null && (
        <p className="text-sm text-muted-foreground">
          {source.kind === "auctionOrg"
            ? "Tổ chức này chưa khai báo đấu giá viên nào trên cổng /portal."
            : "Chưa nối được khách hàng này với tổ chức đấu giá nào trên hệ thống. Liên kết được thiết lập qua con trỏ tổ chức trên bản ghi khách hàng, qua khách hàng tiềm năng đã chuyển đổi, hoặc khi tài khoản của khách hàng là chủ sở hữu một tổ chức đã xác thực."}
        </p>
      )}

      {!isLoading && data && data.resolvedVia !== null && data.auctioneers.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Tổ chức đã nối nhưng chưa khai báo đấu giá viên nào.
        </p>
      )}

      {!isLoading && data && data.auctioneers.length > 0 && (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-left font-medium px-1 py-2">Họ và tên</th>
                <th className="text-left font-medium px-1 py-2 hidden sm:table-cell">Chức vụ</th>
                <th className="text-left font-medium px-1 py-2 hidden md:table-cell">Thẻ ĐGV</th>
                <th className="text-left font-medium px-1 py-2">Bồi dưỡng {year}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.auctioneers.map((a) => {
                const x = data.exemptionsByPerson.get(a.id)?.find((e) => e.year === year);
                const ev = evaluatePerson(
                  a.id,
                  data.eventsByPerson.get(a.id) ?? [],
                  year,
                  resolve,
                  x ? { reasonName: index.reasonById.get(x.reasonId)?.name } : undefined,
                  labelOf,
                );
                const daysLeft = computeDaysUntilExpiry(a.licenseExpiryDate);
                return (
                  <tr
                    key={a.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => setSelected(a)}
                  >
                    <td className="px-1 py-2.5">
                      <span className="font-medium">{a.fullName}</span>
                      {!a.isActive && (
                        <Badge variant="outline" className="ml-2 text-xs font-normal">
                          Đã nghỉ
                        </Badge>
                      )}
                    </td>
                    <td className="px-1 py-2.5 text-muted-foreground hidden sm:table-cell">
                      {POSITION_LABELS[a.position]}
                    </td>
                    <td className="px-1 py-2.5 text-muted-foreground hidden md:table-cell">
                      {a.licenseNumber || "—"}
                      {daysLeft !== undefined && daysLeft < 60 && a.isActive && (
                        <span className="block text-xs text-warning">
                          {daysLeft < 0 ? "Đã hết hạn" : `Hết hạn sau ${daysLeft} ngày`}
                        </span>
                      )}
                      {a.licenseExpiryDate && daysLeft !== undefined && daysLeft >= 60 && (
                        <span className="block text-xs text-muted-foreground">
                          đến {fmtDate(a.licenseExpiryDate)}
                        </span>
                      )}
                    </td>
                    <td className="px-1 py-2.5">
                      {a.isActive ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <CpdStatusBadge ev={ev} />
                          <CpdProofBadge ev={ev} />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Không áp dụng</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AuctioneerDetailSheet
        person={selected}
        events={selected ? (data?.eventsByPerson.get(selected.id) ?? []) : []}
        exemptions={selected ? (data?.exemptionsByPerson.get(selected.id) ?? []) : []}
        onOpenChange={(o) => { if (!o) setSelected(null); }}
      />
    </div>
  );
}
