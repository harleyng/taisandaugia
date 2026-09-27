import { useMemo, useState } from "react";
import { FileSpreadsheet, Loader2, Plus, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { OwnerFilterBar } from "@/components/asset-owner-portal/ui/OwnerFilterBar";
import { OwnerTabBar } from "@/components/asset-owner-portal/ui/OwnerTabs";
import { OwnerSearchInput } from "@/components/asset-owner-portal/ui/OwnerSearchInput";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { useOwnerDigitizedPostings } from "@/hooks/useOwnerDigitizedPostings";
import { useReady3dPostingIds } from "@/hooks/useAsset3dScans";
import { useAttachedVrPostingIds } from "@/hooks/useVrTourOrders";
import { useAuthenticatedPostingIds } from "@/hooks/useAuthenticationOrders";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useWorkspaceBranchOptions } from "@/hooks/useOwnerWorkspaceMembers";
import { useUrlFilterState } from "@/hooks/useUrlFilterState";
import { stripViDiacritics } from "@/lib/normalizeVi";
import { DIGITIZE_FILTERS, matchesDigitizeFilter, type DigitizeFilter } from "@/lib/asset-posting/digitizeStatus";
import { DigitizeTable } from "./digitize/DigitizeTable";
import { PostingImportDialog } from "./digitize/PostingImportDialog";

const FILTER_KEYS = DIGITIZE_FILTERS.map((f) => f.key);

interface AssetPostingsLandingProps {
  onCreate: () => void;
  hrefOf: (postingId: string) => string;
}

/**
 * Trang "Số hoá tài sản": hồ sơ của TENANT đang chọn (không gian hoặc Cá nhân) với
 * MỘT trạng thái gộp mỗi dòng (digitizeStatusOf) + tab lọc + tìm kiếm trên URL.
 * Người xem / Cán bộ ngoài phạm vi chỉ xem: không có nút tạo.
 */
export function AssetPostingsLanding({ onCreate, hrefOf }: AssetPostingsLandingProps) {
  const { rows, isLoading, error } = useOwnerDigitizedPostings();
  const { workspaceId, canCreatePosting } = useOwnerWorkspace();
  const { data: branches, isLoading: branchesLoading } = useWorkspaceBranchOptions(workspaceId);
  const [importOpen, setImportOpen] = useState(false);
  const { data: with3d } = useReady3dPostingIds();
  const { data: withVr } = useAttachedVrPostingIds();
  const { data: authenticated } = useAuthenticatedPostingIds();
  const [{ nhom, q }, setFilter] = useUrlFilterState<{ nhom: DigitizeFilter; q: string }>(
    { nhom: "tat-ca", q: "" },
    { nhom: FILTER_KEYS },
  );

  const branchLabel = useMemo(() => new Map((branches ?? []).map((b) => [b.id, b.label])), [branches]);

  const needle = stripViDiacritics(q);
  const searched = useMemo(
    () =>
      needle
        ? rows.filter((r) => {
            const p = r.posting;
            const hay = [p.title, p.code, p.ward, p.district, p.province].filter(Boolean).join(" ");
            return stripViDiacritics(hay).includes(needle);
          })
        : rows,
    [rows, needle],
  );
  const visible = searched.filter((r) => matchesDigitizeFilter(nhom, r.status));

  const existing = useMemo(
    () => rows.map((r) => ({ title: r.posting.title, province: r.posting.province, code: r.posting.code })),
    [rows],
  );

  const createButton = canCreatePosting ? (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-1.5">
        <FileSpreadsheet className="h-4 w-4" />
        Nhập từ Excel
      </Button>
      <Button onClick={onCreate} className="gap-1.5">
        <Plus className="h-4 w-4" />
        Số hoá tài sản
      </Button>
    </div>
  ) : null;

  return (
    <div className="space-y-5">
      <OwnerPageHeader
        title="Số hoá tài sản"
        subtitle="Số hoá hồ sơ tài sản và gửi yêu cầu tới tổ chức đấu giá phù hợp."
        actions={createButton}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="rounded-2xl bg-card p-10 text-center text-sm text-destructive shadow-card">
          Không tải được danh sách hồ sơ. Vui lòng thử lại.
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl bg-card shadow-card">
          <EmptyState
            icon={UploadCloud}
            title="Chưa có tài sản nào"
            description={
              canCreatePosting
                ? "Bắt đầu số hoá hồ sơ tài sản đầu tiên để nhận gợi ý tổ chức đấu giá phù hợp."
                : "Không gian này chưa có hồ sơ tài sản nào."
            }
            action={createButton}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <OwnerFilterBar
            tabs={
              <OwnerTabBar
                aria-label="Lọc hồ sơ theo giai đoạn"
                value={nhom}
                onValueChange={(v) => setFilter("nhom", v)}
                items={DIGITIZE_FILTERS.map((f) => ({
                  value: f.key,
                  label: f.label,
                  // Số đếm theo tab không đổi khi gõ tìm — như mọi danh sách khác của Trạm.
                  count: rows.filter((r) => matchesDigitizeFilter(f.key, r.status)).length,
                  attention: f.key === "can-xu-ly",
                }))}
              />
            }
          >
            <OwnerSearchInput
              value={q}
              onValueChange={(v) => setFilter("q", v)}
              className="sm:w-72"
              placeholder="Tìm theo tên, mã hồ sơ, khu vực"
              aria-label="Tìm hồ sơ theo tên, mã hồ sơ hoặc khu vực"
            />
          </OwnerFilterBar>

          <DigitizeTable
            rows={visible}
            hrefOf={hrefOf}
            marks={{ with3d, withVr, authenticated }}
            branchLabel={branchLabel}
            emptyText={needle ? "Không có hồ sơ nào khớp từ khoá." : "Không có hồ sơ nào trong mục này."}
          />
        </div>
      )}

      {canCreatePosting && (
        <PostingImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          branches={branches ?? []}
          existing={existing}
          loading={!!workspaceId && branchesLoading}
        />
      )}
    </div>
  );
}
