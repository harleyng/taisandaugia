import { useNavigate } from "react-router-dom";
import { Handshake, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { stripViDiacritics } from "@/lib/normalizeVi";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { OwnerFilterBar } from "@/components/asset-owner-portal/ui/OwnerFilterBar";
import { OwnerSearchInput } from "@/components/asset-owner-portal/ui/OwnerSearchInput";
import { OwnerTabBar } from "@/components/asset-owner-portal/ui/OwnerTabs";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { ConsignmentTable } from "@/components/consignment/owner/ConsignmentTable";
import { useOwnerConsignments, type OwnerConsignmentRow } from "@/hooks/useOwnerConsignments";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useWorkspaceBranchOptions } from "@/hooks/useOwnerWorkspaceMembers";
import { useUrlFilterState } from "@/hooks/useUrlFilterState";
import {
  CONSIGNMENT_FILTERS,
  matchesConsignmentFilter,
  type ConsignmentFilter,
} from "@/lib/consignment/ownerConsignment";

const FILTER_KEYS = CONSIGNMENT_FILTERS.map((f) => f.key);

/** Ô tìm: tên, mã hồ sơ, quận/huyện, tỉnh/thành, tổ chức đã chốt — không phân biệt dấu. */
function matchesQuery(r: OwnerConsignmentRow, query: string): boolean {
  const q = stripViDiacritics(query);
  if (!q) return true;
  const p = r.posting;
  return [p.title, p.code, p.district, p.province, r.chosenOrgName].some((v) => !!v && stripViDiacritics(v).includes(q));
}

/**
 * /chu-tai-san/ky-gui-dau-gia — theo dõi ký gửi của mọi hồ sơ trong tenant đang
 * chọn (thiết kế "Ky Gui Dau Gia - Danh sach & Chi tiet"): ai đang chờ ai, báo
 * giá nào cần chọn.
 *
 * Không có nút tạo: số hoá và gửi tổ chức vẫn là một luồng liền ở menu "Số hoá
 * tài sản". Hồ sơ được duyệt mà chưa gửi ai hiện ở nhóm "Chưa gửi". Người dùng
 * chốt BỎ dải "hồ sơ đang chờ bạn" của thiết kế — tab "Cần bạn xử lý" đã làm việc đó.
 */
export default function OwnerConsignmentsPage() {
  const navigate = useNavigate();
  const { rows, isLoading, error } = useOwnerConsignments();
  const { workspaceId } = useOwnerWorkspace();
  const { data: branches } = useWorkspaceBranchOptions(workspaceId);
  const branchLabel = new Map((branches ?? []).map((b) => [b.id, b.label]));
  const [{ nhom, q }, setFilter] = useUrlFilterState<{ nhom: ConsignmentFilter; q: string }>(
    { nhom: "tat-ca", q: "" },
    { nhom: FILTER_KEYS },
  );

  const countOf = (key: ConsignmentFilter) => rows.filter((r) => matchesConsignmentFilter(key, r)).length;
  const visible = rows.filter((r) => matchesConsignmentFilter(nhom, r) && matchesQuery(r, q));

  return (
    <div className="space-y-5">
      <OwnerPageHeader
        title="Ký gửi đấu giá"
        subtitle="Gửi hồ sơ cho tổ chức đấu giá, so sánh báo giá và chọn nơi ký gửi."
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-card p-10 text-center text-sm text-destructive shadow-card">
          Không tải được danh sách ký gửi. Vui lòng thử lại.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl bg-card shadow-card">
          <EmptyState
            icon={Handshake}
            title="Chưa có tài sản nào để ký gửi"
            description="Hồ sơ số hoá sau khi được duyệt sẽ hiện ở đây để bạn gửi cho tổ chức đấu giá."
            action={
              <Button variant="outline" className="gap-1.5" onClick={() => navigate("/chu-tai-san/dang-tai-san")}>
                <UploadCloud className="h-4 w-4" />
                Số hoá tài sản
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          <OwnerFilterBar
            tabs={
              <OwnerTabBar
                value={nhom}
                onValueChange={(v) => setFilter("nhom", v)}
                aria-label="Lọc theo giai đoạn ký gửi"
                items={CONSIGNMENT_FILTERS.map((f) => ({
                  value: f.key,
                  label: f.label,
                  count: countOf(f.key),
                  attention: f.key === "can-xu-ly",
                }))}
              />
            }
          >
            <OwnerSearchInput
              value={q}
              onValueChange={(v) => setFilter("q", v)}
              placeholder="Tìm theo tên, mã hồ sơ, khu vực"
              aria-label="Tìm theo tên tài sản, mã hồ sơ, quận/huyện, tỉnh/thành hoặc tổ chức đấu giá"
            />
          </OwnerFilterBar>

          <ConsignmentTable rows={visible} branchLabel={branchLabel} emptyText="Không có hồ sơ nào trong nhóm này." />
        </div>
      )}
    </div>
  );
}
