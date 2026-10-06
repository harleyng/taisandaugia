import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ChevronRight, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useHasAdminPermission } from "@/hooks/useAdminPermissions";
import { useOwnerSubBenefitCatalog } from "@/hooks/useOwnerSubscriptionPlans";
import { useAdminOwnerSubscriptionList, useAdminSubCatalog, useSavePackage, useSavePlan } from "@/hooks/useAdminOwnerSubscriptions";
import { DefaultTag, SellBadge } from "@/components/admin/owner-subscriptions/PackageBits";
import { PackagePlansTable } from "@/components/admin/owner-subscriptions/PackagePlansTable";
import { PackageTermsCard } from "@/components/admin/owner-subscriptions/PackageTermsCard";
import { PackageOrgPicker } from "@/components/admin/owner-subscriptions/PackageOrgPicker";
import { PlanEditor } from "@/components/admin/owner-subscriptions/PlanEditor";
import { OwnerPreviewDialog } from "@/components/admin/owner-subscriptions/OwnerPreviewDialog";
import {
  type PackageDraft,
  type PlanDraft,
  blankPackageDraft,
  draftToOwnerPlan,
  packageMissing,
  packageStats,
  packageTerms,
  packageToDraft,
} from "@/lib/ownerSubscription/packages";
import { formatSubDate } from "@/lib/ownerSubscription/status";
import type { AdminOwnerSubRow, AdminSubPackage, SubTerm } from "@/lib/ownerSubscription/types";

const LIST = "/admin/goi-thue-bao/danh-muc";

/** /admin/goi-thue-bao/danh-muc/:packageId (moi = tạo mới) — chi tiết / tạo bộ gói. */
export default function AdminSubPackagePage() {
  const { packageId = "moi" } = useParams();
  const { data, isLoading } = useAdminSubCatalog();
  const { data: rows, isLoading: rowsLoading } = useAdminOwnerSubscriptionList();
  const isNew = packageId === "moi";
  const pkg = data?.packages.find((k) => k.id === packageId) ?? null;

  if (isLoading || rowsLoading || !data || !rows) return <Skeleton className="m-6 h-96 rounded-2xl" />;
  if (!isNew && !pkg) return <div className="p-6 text-sm text-muted-foreground">Không tìm thấy bộ gói.</div>;
  return <PackageEditor key={packageId} pkg={pkg} packages={data.packages} library={data.terms} rows={rows} />;
}

interface EditorProps {
  pkg: AdminSubPackage | null;
  packages: AdminSubPackage[];
  library: SubTerm[];
  rows: AdminOwnerSubRow[];
}

function PackageEditor({ pkg, packages, library, rows }: EditorProps) {
  const navigate = useNavigate();
  const canEdit = useHasAdminPermission("goi-thue-bao", pkg ? "update" : "create");
  const savePackage = useSavePackage();
  const savePlan = useSavePlan();
  const { data: benefitCatalog = [] } = useOwnerSubBenefitCatalog();

  const [d, setD] = useState<PackageDraft>(() => (pkg ? packageToDraft(pkg) : blankPackageDraft()));
  const [base, setBase] = useState(() => JSON.stringify(d));
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const set = (patch: Partial<PackageDraft>) => setD((v) => ({ ...v, ...patch }));

  const dirty = JSON.stringify(d) !== base;
  const missing = packageMissing(d);
  const stats = pkg ? packageStats(pkg, rows) : null;
  const terms = packageTerms(d.term_ids, library);
  const usingCount = (planId: string | null) =>
    planId ? rows.filter((r) => r.plan_id === planId && (r.status === "active" || r.status === "scheduled")).length : 0;
  const defs = useMemo(() => new Map(benefitCatalog.map((b) => [b.key, b])), [benefitCatalog]);
  const previewPlans = d.plans.filter((p) => p.is_active).map((p, i) => draftToOwnerPlan(p, defs, p.key === d.featured_key, i));

  const back = () => {
    if (!dirty || window.confirm("Bỏ các thay đổi chưa lưu?")) navigate(LIST);
  };
  const move = (i: number, dir: -1 | 1) => {
    const plans = [...d.plans];
    [plans[i], plans[i + dir]] = [plans[i + dir], plans[i]];
    set({ plans });
  };
  const applyPlan = (p: PackageDraft, plan: PlanDraft): PackageDraft => {
    const exists = p.plans.some((x) => x.key === plan.key);
    return {
      ...p,
      plans: exists ? p.plans.map((x) => (x.key === plan.key ? plan : x)) : [...p.plans, plan],
      featured_key: !plan.is_active && p.featured_key === plan.key ? null : p.featured_key,
    };
  };
  const onPlanSave = async (plan: PlanDraft) => {
    let saved = plan;
    if (d.id) {
      // Bộ đã có: lưu gói ngay, coi như đã lưu trong bản gốc (thay đổi khác của bộ vẫn chờ lưu).
      let res: { plan_id: string };
      try {
        res = await savePlan.mutateAsync({ packageId: d.id, plan });
      } catch {
        return; // toast lỗi đã hiện trong hook
      }
      saved = { ...plan, id: res.plan_id, key: plan.id ? plan.key : res.plan_id };
      setBase((b) => JSON.stringify(applyPlan(JSON.parse(b) as PackageDraft, saved)));
    }
    setD((v) => applyPlan(v, saved));
    setEditing(null);
  };
  const onSave = () =>
    savePackage.mutate(d, {
      onSuccess: () => {
        setBase(JSON.stringify(d));
        navigate(LIST);
      },
    });

  if (editing) {
    const plan = editing === "new" ? null : (d.plans.find((p) => p.key === editing) ?? null);
    return (
      <PlanEditor
        plan={plan}
        packageName={d.name}
        terms={terms}
        featured={!!plan && d.featured_key === plan.key}
        usingCount={usingCount(plan?.id ?? null)}
        canEdit={canEdit}
        saving={savePlan.isPending}
        onSave={onPlanSave}
        onBack={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="space-y-4 p-6">
      <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <button type="button" className="hover:text-foreground" onClick={back}>
          Gói thuê bao
        </button>
        <ChevronRight className="h-3.5 w-3.5" />
        <button type="button" className="hover:text-foreground" onClick={back}>
          Danh mục gói
        </button>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">{pkg ? pkg.name : "Thêm bộ gói"}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-2.5 text-xl font-semibold text-foreground">
            {pkg ? pkg.name : "Thêm bộ gói"}
            {d.is_default && <DefaultTag />}
            {pkg && <SellBadge active={pkg.is_active} />}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {pkg && stats
              ? `${d.is_default ? `${stats.members.length} tổ chức chưa gán bộ riêng` : `${d.workspace_ids.length} tổ chức được gán`} · ${stats.using.length} đang dùng · sửa ${formatSubDate(pkg.updated_at.slice(0, 10))}`
              : "Đặt tên, thêm gói, chọn kỳ mua và tổ chức."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!d.plans.length} onClick={() => setPreviewOpen(true)}>
            <Eye className="mr-1.5 h-4 w-4" /> Xem như chủ tài sản
          </Button>
          {pkg && !d.is_default && canEdit && (
            <Button variant="outline" onClick={() => set({ is_active: !d.is_active })}>
              {d.is_active ? "Ngừng bán bộ" : "Mở bán lại"}
            </Button>
          )}
        </div>
      </div>

      {pkg && d.is_active !== pkg.is_active && (
        <div className="flex gap-2.5 rounded-xl border border-warning/40 bg-warning/10 px-3.5 py-2.5 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            {d.is_active
              ? "Bộ sẽ mở bán lại sau khi lưu."
              : `Sau khi lưu, tổ chức của bộ không mua / gia hạn được; ${stats?.using.length ?? 0} tổ chức đang dùng chạy tới hết hạn.`}
          </span>
        </div>
      )}

      <section className="rounded-2xl border bg-card">
        <div className="border-b px-5 py-3.5">
          <h2 className="text-base font-semibold text-foreground">Thông tin bộ gói</h2>
        </div>
        <fieldset disabled={!canEdit} className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pkg-name">
              Tên bộ gói <span className="text-destructive">*</span>
            </Label>
            <Input id="pkg-name" value={d.name} maxLength={60} placeholder="VD: Ngân hàng" onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pkg-desc">Đối tượng / ghi chú nội bộ</Label>
            <Input
              id="pkg-desc"
              value={d.description}
              maxLength={160}
              placeholder="VD: Chi nhánh xử lý nợ theo HĐ khung"
              onChange={(e) => set({ description: e.target.value })}
            />
          </div>
        </fieldset>
      </section>

      <PackagePlansTable
        plans={d.plans}
        featuredKey={d.featured_key}
        usingCount={usingCount}
        canEdit={canEdit}
        onMove={move}
        onFeatured={(featured_key) => set({ featured_key })}
        onEdit={setEditing}
        onAdd={() => setEditing("new")}
      />

      <PackageTermsCard library={library} selected={d.term_ids} plans={d.plans} canEdit={canEdit} onChange={(term_ids) => set({ term_ids })} />

      <section className="rounded-2xl border bg-card">
        <div className="flex items-center gap-3 border-b px-5 py-3.5">
          <h2 className="text-base font-semibold text-foreground">Tổ chức được dùng</h2>
          {!d.is_default && (
            <span className="text-xs text-muted-foreground">
              {d.workspace_ids.length} / {rows.length}
            </span>
          )}
        </div>
        <div className="p-5 pt-3.5">
          {d.is_default ? (
            <p className="rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              Bộ mặc định — mọi tổ chức chưa được gán bộ riêng (<b className="text-foreground">{stats?.members.length ?? 0}</b> tổ chức) thấy
              bộ này. Gán tổ chức vào bộ khác ở trang của bộ đó.
            </p>
          ) : (
            <PackageOrgPicker
              packageId={d.id}
              selected={d.workspace_ids}
              baseSelected={pkg?.workspace_ids ?? []}
              planIds={pkg?.plans.map((p) => p.id) ?? []}
              rows={rows}
              packages={packages}
              canEdit={canEdit}
              onChange={(workspace_ids) => set({ workspace_ids })}
            />
          )}
        </div>
      </section>

      {canEdit && (dirty || !pkg) && (
        <div className="sticky bottom-0 z-30 -mx-6 -mb-6 border-t bg-card shadow-[0_-6px_20px_hsl(var(--foreground)/0.06)]">
          <div className="flex flex-wrap items-center gap-2.5 px-6 py-3">
            <span className="flex-1 text-[13px] text-muted-foreground">
              {missing.length
                ? `Cần: ${missing.join(", ")}`
                : pkg
                  ? "Có thay đổi chưa lưu · áp dụng từ lần mua / gia hạn sau"
                  : "Bộ gói mới"}
            </span>
            <Button variant="outline" onClick={back}>
              Huỷ
            </Button>
            <Button disabled={missing.length > 0 || savePackage.isPending} onClick={onSave}>
              {savePackage.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {pkg ? "Lưu bộ gói" : "Tạo bộ gói"}
            </Button>
          </div>
        </div>
      )}

      <OwnerPreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} packageName={d.name} plans={previewPlans} terms={terms} />
    </div>
  );
}
