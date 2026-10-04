import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { OutcomeFieldError } from "@/components/asset-owner-portal/outcomes/OutcomeFieldError";
import { IconTile } from "@/components/asset-owner-portal/ui/IconTile";
import { useCredits } from "@/hooks/useCredits";
import { useOwnerSubscription } from "@/hooks/useOwnerSubscription";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import {
  useCreateMarketingOrder,
  useMarketableAssets,
  type MarketingPackage,
} from "@/hooks/useOwnerMarketingOrders";
import { coverageFor, coverageLabel } from "@/lib/ownerSubscription/coverage";
import {
  BRIEF_MAX,
  MKT_GOAL_LABELS,
  MKT_ORDER_BENEFIT,
  MKT_ORDER_GOALS,
  MKT_ORDER_PACKAGES,
  MKT_PACKAGE_META,
  type MktOrderPackage,
} from "@/lib/ownerMarketing/orders";
import { OrderPaymentPreview } from "./OrderPaymentPreview";
import { paymentBlocked } from "./payment";

const schema = z.object({
  packageKey: z.enum(MKT_ORDER_PACKAGES, { errorMap: () => ({ message: "Chọn gói" }) }),
  listingId: z.string().min(1, "Chọn tài sản"),
  goal: z.enum(MKT_ORDER_GOALS, { errorMap: () => ({ message: "Chọn mục tiêu" }) }),
  brief: z.string().max(BRIEF_MAX, `Tối đa ${BRIEF_MAX.toLocaleString("en-US")} ký tự`),
});
type FormValues = z.infer<typeof schema>;

interface CreateMarketingOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packages: MarketingPackage[];
  /** Gói đã chọn ở hộp "Chọn gói" (ChooseMarketingPackageDialog). */
  initialPackage?: MktOrderPackage | null;
  initialListingId?: string | null;
  /** Quay lại hộp "Chọn gói", giữ tài sản đang chọn. */
  onChangePackage: (listingId: string | null) => void;
}

const Req = () => <span className="text-destructive">*</span>;

/**
 * Bước 2 của "Tạo đơn mới" — gói đã chọn ở hộp trước; ở đây chọn tài sản + mục tiêu + ghi chú. Gói giá cố
 * định trả ngay (gói dịch vụ trước, rồi credit); gói báo giá gửi yêu cầu để sàn báo giá.
 */
export function CreateMarketingOrderDialog({
  open,
  onOpenChange,
  packages,
  initialPackage,
  initialListingId,
  onChangePackage: backToPicker,
}: CreateMarketingOrderDialogProps) {
  const { workspaceId, canIn } = useOwnerWorkspace();
  const { assets: all, isLoading } = useMarketableAssets(open);
  const { data: subscription } = useOwnerSubscription(open ? workspaceId : null);
  const { balance } = useCredits();
  const create = useCreateMarketingOrder();

  // Chỉ tin đang mở bán, trong phạm vi chi nhánh người đặt có quyền (server cũng chặn).
  const assets = useMemo(
    () => all.filter((a) => a.status === "ACTIVE" && canIn("truyen-thong", "share", a.branchId)),
    [all, canIn],
  );

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const errors = form.formState.errors;

  useEffect(() => {
    if (!open) return;
    form.reset({
      packageKey: initialPackage ?? packages[0]?.key ?? "mkt_featured_owner",
      listingId: initialListingId ?? "",
      goal: "registrations",
      brief: "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const packageKey = form.watch("packageKey");
  const pkg = packages.find((p) => p.key === packageKey) ?? null;
  const pkgMeta = pkg ? MKT_PACKAGE_META[pkg.key] : null;
  const onChangePackage = () => backToPicker(form.getValues("listingId") || null);
  const benefit = pkg ? MKT_ORDER_BENEFIT[pkg.key] : undefined;
  const coverage = pkg?.pricing === "credits" && benefit ? coverageFor(subscription, benefit) : null;
  const coverageText = coverage && benefit ? coverageLabel(coverage, benefit) : "";
  const blocked = paymentBlocked(pkg, coverage, balance);
  const preselectedMissing = !!initialListingId && !isLoading && !assets.some((a) => a.listingId === initialListingId);

  const busy = create.isPending;
  const submit = form.handleSubmit((v) =>
    create.mutate(
      { packageKey: v.packageKey, listingId: v.listingId, goal: v.goal, brief: v.brief.trim() },
      { onSuccess: () => onOpenChange(false) },
    ),
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Giao việc cho sàn</DialogTitle>
          <DialogDescription>Sàn thực hiện truyền thông cho tài sản và báo kết quả cho bạn tại đây.</DialogDescription>
        </DialogHeader>

        <form id="mkt-order-form" onSubmit={submit} className="min-w-0 space-y-4">
          <div className="space-y-1.5">
            <Label>
              Gói <Req />
            </Label>
            <div className="flex items-start gap-3 rounded-lg border border-border px-3 py-2.5">
              {pkgMeta && <IconTile icon={pkgMeta.icon} size="sm" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{pkg?.name ?? "Chưa chọn gói"}</p>
                {pkgMeta && <p className="mt-0.5 text-xs text-muted-foreground">{pkgMeta.summary}</p>}
              </div>
              <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={onChangePackage} disabled={busy}>
                Đổi gói
              </Button>
            </div>
            <OutcomeFieldError msg={errors.packageKey?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mkt-order-asset">
              Tài sản <Req />
            </Label>
            <Controller
              control={form.control}
              name="listingId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={(v) => v && field.onChange(v)} disabled={isLoading}>
                  <SelectTrigger id="mkt-order-asset">
                    <SelectValue placeholder={isLoading ? "Đang tải…" : "Chọn tài sản đang mở bán"} />
                  </SelectTrigger>
                  <SelectContent>
                    {assets.map((a) => (
                      <SelectItem key={a.listingId} value={a.listingId}>
                        {a.title}
                        {a.branchName ? ` · ${a.branchName}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {!isLoading && assets.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Chưa có tài sản nào đang mở bán trên sàn trong phạm vi của bạn.
              </p>
            )}
            {preselectedMissing && (
              <p className="text-xs text-muted-foreground">
                Tài sản vừa chọn không còn mở bán hoặc ngoài phạm vi chi nhánh của bạn.
              </p>
            )}
            <OutcomeFieldError msg={errors.listingId?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mkt-order-goal">
              Mục tiêu <Req />
            </Label>
            <Controller
              control={form.control}
              name="goal"
              render={({ field }) => (
                <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                  <SelectTrigger id="mkt-order-goal">
                    <SelectValue placeholder="Chọn mục tiêu" />
                  </SelectTrigger>
                  <SelectContent>
                    {MKT_ORDER_GOALS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {MKT_GOAL_LABELS[g]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <OutcomeFieldError msg={errors.goal?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mkt-order-brief">Ghi chú cho sàn</Label>
            <Textarea
              id="mkt-order-brief"
              rows={3}
              maxLength={BRIEF_MAX}
              placeholder="Đối tượng muốn tiếp cận, thời điểm, điểm nổi bật của tài sản…"
              {...form.register("brief")}
            />
            <OutcomeFieldError msg={errors.brief?.message} />
          </div>

          <OrderPaymentPreview pkg={pkg} coverage={coverage} coverageText={coverageText} balance={balance} />
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Huỷ
          </Button>
          <Button type="submit" form="mkt-order-form" disabled={busy || blocked}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {pkg?.pricing === "quote"
              ? "Gửi yêu cầu báo giá"
              : coverage?.kind === "covered"
                ? "Đặt gói (dùng lượt gói dịch vụ)"
                : `Đặt gói · ${(pkg?.creditCost ?? 0).toLocaleString("en-US")} credit`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
