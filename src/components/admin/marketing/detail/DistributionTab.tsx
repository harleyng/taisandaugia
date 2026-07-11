import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Filter, ListChecks, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useCampaignRecipients,
  resolveAudience,
  fetchAudienceCount,
} from "@/hooks/useCampaigns";
import { describeSpec, hasAnyAudience } from "@/lib/marketing/audienceCriteria";
import {
  AudienceListDrawer,
  type AudienceListRow,
} from "@/components/admin/marketing/audience/AudienceListDrawer";
import type { Campaign } from "@/types/marketing";

const PREVIEW_CAP = 500;

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-36 shrink-0 text-sm text-muted-foreground">{label}:</span>
      <span className="text-sm text-foreground">{children}</span>
    </div>
  );
}

function AudiencePanel({
  icon,
  title,
  subtitle,
  badges,
  recipientLabel,
  onView,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badges?: string[];
  recipientLabel: string;
  onView: () => void;
}) {
  const hasCount = recipientLabel !== "—";

  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4">
      {/* Loại đối tượng + badges */}
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 text-primary">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          {badges && badges.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {badges.map((b, i) => (
                <span
                  key={i}
                  className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {b}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Số người nhận (tiêu đề) + ghi chú opt-in + CTA */}
      <div className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p
            className={`text-sm font-semibold tabular-nums ${
              hasCount ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {recipientLabel} người nhận
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Chỉ gửi tới người dùng đã cho phép gửi email.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onView}
          className="shrink-0 self-start sm:self-auto"
        >
          Xem danh sách
          <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function DistributionTab({ campaign }: { campaign: Campaign }) {
  const spec = campaign.audience_spec;
  const chips = describeSpec(spec);
  const configured = hasAnyAudience(spec);
  const hasSnapshot = campaign.recipient_count > 0;

  const [open, setOpen] = useState(false);
  const [resolvedRows, setResolvedRows] = useState<AudienceListRow[] | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState(false);

  // Sent campaigns keep a recipient snapshot; load it lazily via the shared query.
  const { data: recipients, isLoading: recipientsLoading } = useCampaignRecipients(
    hasSnapshot ? campaign.id : undefined,
  );

  // Bản nháp/chưa gửi: đếm sống số người đủ điều kiện để vẫn thấy "sẽ gửi cho ai".
  const { data: eligibleCount, isFetching: countFetching } = useQuery<number>({
    queryKey: ["campaign_eligible_count", campaign.id],
    queryFn: () => fetchAudienceCount(spec, campaign.respect_optin),
    enabled: configured && !hasSnapshot,
    staleTime: 30_000,
  });

  const openDrawer = async () => {
    setOpen(true);
    if (hasSnapshot || resolvedRows) return;
    setResolving(true);
    setResolveError(false);
    try {
      setResolvedRows(
        await resolveAudience(spec, campaign.respect_optin, PREVIEW_CAP, 0),
      );
    } catch {
      setResolveError(true);
    } finally {
      setResolving(false);
    }
  };

  const drawerRows: AudienceListRow[] = hasSnapshot
    ? (recipients ?? []).map((r) => ({ email: r.email, name: r.name }))
    : (resolvedRows ?? []);
  const drawerTotal = hasSnapshot
    ? campaign.recipient_count
    : (eligibleCount ?? campaign.eligible_count ?? drawerRows.length);
  const drawerLoading = hasSnapshot ? recipientsLoading : resolving;

  // Có snapshot → số đã gửi; chưa gửi → số đủ điều kiện (đếm sống); đang tải → "…".
  const recipientLabel = hasSnapshot
    ? campaign.recipient_count.toLocaleString("vi-VN")
    : eligibleCount != null
      ? eligibleCount.toLocaleString("vi-VN")
      : countFetching
        ? "…"
        : "—";

  const audience =
    spec.kind === "all"
      ? {
          icon: <Users className="h-4 w-4" />,
          title: "Gửi tới tất cả khách hàng",
          subtitle: undefined as string | undefined,
        }
      : spec.kind === "criteria"
        ? {
            icon: <Filter className="h-4 w-4" />,
            title: "Gửi theo tiêu chí",
            subtitle: undefined as string | undefined,
          }
        : {
            icon: <ListChecks className="h-4 w-4" />,
            title: "Gửi theo danh sách cụ thể",
            subtitle: undefined as string | undefined,
          };

  return (
    <div className="max-w-2xl space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Đối tượng phân phối</h3>

        {configured ? (
          <AudiencePanel
            icon={audience.icon}
            title={audience.title}
            subtitle={audience.subtitle}
            badges={spec.kind === "criteria" ? chips : undefined}
            recipientLabel={recipientLabel}
            onView={openDrawer}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Chưa cấu hình đối tượng.
          </div>
        )}
      </section>

      <section className="space-y-2.5">
        <h3 className="text-sm font-semibold text-foreground">Thời gian phân phối</h3>
        <Row label="Kiểu lịch">
          {campaign.schedule_type === "scheduled" ? "Hẹn thời gian cụ thể" : "Gửi ngay lập tức"}
        </Row>
        <Row label="Thời gian hẹn gửi">{fmt(campaign.scheduled_at)}</Row>
        <Row label="Thời gian đã gửi">{fmt(campaign.sent_at)}</Row>
      </section>

      <AudienceListDrawer
        open={open}
        onOpenChange={setOpen}
        title={hasSnapshot ? "Danh sách người nhận" : "Đối tượng đủ điều kiện"}
        total={drawerTotal}
        rows={drawerRows}
        loading={drawerLoading}
        error={resolveError}
      />
    </div>
  );
}
