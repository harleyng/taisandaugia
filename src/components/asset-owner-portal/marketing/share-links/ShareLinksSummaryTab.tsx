import { useMemo, useState } from "react";
import { AlertCircle, Link2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { OwnerFilterBar } from "@/components/asset-owner-portal/ui/OwnerFilterBar";
import { OwnerFilterSelect } from "@/components/asset-owner-portal/ui/OwnerFilterSelect";
import { OwnerSearchInput } from "@/components/asset-owner-portal/ui/OwnerSearchInput";
import { StatTile } from "@/components/asset-owner-portal/ui/StatTile";
import { ShareLinkDialog } from "@/components/asset-posting/share/ShareLinkDialog";
import { ShareLinksTable } from "@/components/asset-posting/share/ShareLinksTable";
import { useOwnerShareLinks, type ShareableAsset } from "@/hooks/useShareLinks";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { MKT_CHANNELS, MKT_CHANNEL_META } from "@/lib/ownerMarketing/links";
import { shareTargetOf, type PostingShareLink, type ShareTarget } from "@/lib/postingShare/types";
import {
  FILTER_ALL,
  KIND_FILTERS,
  SOURCE_FILTERS,
  STATE_FILTERS,
  branchOptions,
  filterShareLinks,
  summarizeShareLinks,
  type ShareLinkFilters,
} from "@/lib/shareLinks/filters";
import { formatCount } from "@/lib/shareLinks/series";
import { PickShareAssetDialog } from "./PickShareAssetDialog";

export type ShareLinksFilterKey = "q" | "kenh" | "nguon" | "loai" | "tinh-trang" | "chi-nhanh" | "tai-san";

interface ShareLinksSummaryTabProps {
  filters: ShareLinkFilters;
  onFilter: (key: ShareLinksFilterKey, value: string) => void;
}

/**
 * Menu Truyền thông → "Link theo dõi": TỔNG HỢP mọi link Hồ sơ online của Trạm — link gửi riêng
 * từ hồ sơ số hoá, link của tin trên sàn, link do chiến dịch tạo và link /l/ cũ đã chuyển.
 * Bấm một dòng ⇒ trang chi tiết link (biểu đồ theo ngày).
 */
export function ShareLinksSummaryTab({ filters: f, onFilter }: ShareLinksSummaryTabProps) {
  const { workspaceId } = useOwnerWorkspace();
  const { data, isLoading, isError, refetch } = useOwnerShareLinks();
  const [picking, setPicking] = useState(false);
  const [creating, setCreating] = useState<{ target: ShareTarget; title: string } | null>(null);
  const [editing, setEditing] = useState<PostingShareLink | null>(null);

  const rows = useMemo(() => data?.links ?? [], [data]);
  const visible = useMemo(() => filterShareLinks(rows, f), [rows, f]);
  const totals = useMemo(() => summarizeShareLinks(visible), [visible]);
  const branches = useMemo(() => branchOptions(rows), [rows]);
  const assetTitle = f.asset ? (rows.find((r) => r.postingId === f.asset || r.listingId === f.asset)?.targetTitle ?? "Tài sản") : null;

  const pick = (a: ShareableAsset) => {
    if (!workspaceId) return;
    setPicking(false);
    setCreating({
      target:
        a.kind === "posting"
          ? { kind: "posting", postingId: a.id, workspaceId }
          : { kind: "listing", listingId: a.id, workspaceId },
      title: a.title,
    });
  };

  const createButton = data?.canCreate && (
    <Button className="gap-1.5" onClick={() => setPicking(true)}>
      <Plus className="h-4 w-4" strokeWidth={1.5} />
      Tạo link
    </Button>
  );

  let body;
  if (isLoading) {
    body = (
      <div className="space-y-2.5">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  } else if (isError) {
    body = (
      <div className="rounded-2xl bg-card shadow-card">
        <EmptyState
          icon={AlertCircle}
          tone="destructive"
          title="Không tải được danh sách link"
          description="Vui lòng thử lại."
          action={
            <Button variant="outline" onClick={() => refetch()}>
              Thử lại
            </Button>
          }
        />
      </div>
    );
  } else if (rows.length === 0) {
    body = (
      <div className="rounded-2xl bg-card shadow-card">
        <EmptyState
          icon={Link2}
          title="Chưa có link Hồ sơ online nào"
          description="Mỗi link là một trang hồ sơ đẹp trên điện thoại cho một người nhận × một kênh (Zalo, SMS, app…). Đơn vị chỉ thấy số lượt xem, không thấy ai xem."
          action={createButton || undefined}
        />
      </div>
    );
  } else {
    body = (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Link" value={formatCount(totals.links)} context={`${formatCount(totals.active)} đang mở`} />
          <StatTile label="Lượt xem" value={formatCount(totals.views)} context={`${formatCount(totals.viewers)} người xem`} />
          <StatTile label="Bấm “Mua hồ sơ”" value={formatCount(totals.dossier)} context="Trọn đời các link đang lọc" />
          <StatTile label="Theo dõi / lưu" value={formatCount(totals.follow)} context="Người nhận đăng ký theo dõi" />
        </div>

        <OwnerFilterBar
          tabs={
            assetTitle ? (
              <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 py-1 pl-3 pr-1 text-sm font-medium text-primary">
                <span className="truncate">Tài sản: {assetTitle}</span>
                <button type="button" className="rounded-full p-0.5 hover:bg-primary/15" aria-label="Bỏ lọc tài sản" onClick={() => onFilter("tai-san", "")}>
                  <X className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </span>
            ) : (
              <p className="text-sm text-muted-foreground">Thành viên đơn vị mở link không được tính.</p>
            )
          }
        >
          <OwnerSearchInput
            value={f.q}
            onValueChange={(v) => onFilter("q", v)}
            placeholder="Tìm theo link, tài sản, chiến dịch"
            aria-label="Tìm link theo nhãn, tài sản hoặc chiến dịch"
          />
          <OwnerFilterSelect label="Kênh" value={f.channel} onValueChange={(v) => onFilter("kenh", v)}>
            <SelectItem value={FILTER_ALL}>Tất cả</SelectItem>
            {MKT_CHANNELS.map((c) => (
              <SelectItem key={c} value={c}>
                {MKT_CHANNEL_META[c].label}
              </SelectItem>
            ))}
          </OwnerFilterSelect>
          <OwnerFilterSelect label="Nguồn" value={f.source} onValueChange={(v) => onFilter("nguon", v)}>
            {SOURCE_FILTERS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </OwnerFilterSelect>
          <OwnerFilterSelect label="Loại tài sản" value={f.kind} onValueChange={(v) => onFilter("loai", v)}>
            {KIND_FILTERS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </OwnerFilterSelect>
          <OwnerFilterSelect label="Trạng thái" value={f.state} onValueChange={(v) => onFilter("tinh-trang", v)}>
            {STATE_FILTERS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </OwnerFilterSelect>
          {branches.length > 1 && (
            <OwnerFilterSelect label="Chi nhánh" value={f.branch} onValueChange={(v) => onFilter("chi-nhanh", v)}>
              <SelectItem value={FILTER_ALL}>Tất cả</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </OwnerFilterSelect>
          )}
          {createButton}
        </OwnerFilterBar>

        <div className="rounded-2xl bg-card p-4 shadow-card sm:p-5">
          {visible.length === 0 ? (
            <EmptyState icon={Link2} compact title="Không có link nào khớp" description="Thử từ khoá hoặc bộ lọc khác." />
          ) : (
            <ShareLinksTable links={visible} canShare={false} showAsset onEdit={setEditing} />
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {body}
      <PickShareAssetDialog open={picking} onOpenChange={setPicking} onPick={pick} />
      <ShareLinkDialog
        target={creating?.target ?? null}
        targetTitle={creating?.title}
        open={!!creating}
        link={null}
        onClose={() => setCreating(null)}
      />
      <ShareLinkDialog
        target={editing ? shareTargetOf(editing) : null}
        open={!!editing}
        link={editing}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

