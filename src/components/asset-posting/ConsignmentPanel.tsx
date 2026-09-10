import { Building2, Loader2, MapPin, Phone, Sparkles, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { QuoteComparison } from "./QuoteComparison";
import {
  BROKER_REQUEST_STATUS_LABELS,
  SERVICE_REQUEST_STATUS_LABELS,
  type AssetBrokerRequest,
  type AssetPosting,
} from "@/types/asset-posting";
import type { RequestOrg, RequestWithOrg } from "@/hooks/useAssetPosting";

const BROKER_STEPS: { key: AssetBrokerRequest["status"]; label: string }[] = [
  { key: "pending", label: "Đã gửi sàn" },
  { key: "sourcing", label: "Đang tìm tổ chức" },
  { key: "quoted", label: "Có báo giá" },
  { key: "selected", label: "Đã chọn" },
];

function BrokerProgress({ status }: { status: AssetBrokerRequest["status"] }) {
  const idx = BROKER_STEPS.findIndex((s) => s.key === status);
  return (
    <div className="flex items-center gap-1.5">
      {BROKER_STEPS.map((s, i) => (
        <div key={s.key} className="flex flex-1 flex-col gap-1.5">
          <div className={`h-1 rounded-full ${i <= idx ? "bg-primary" : "bg-border"}`} />
          <span className={`text-[11px] ${i <= idx ? "font-medium text-foreground" : "text-muted-foreground"}`}>
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChosenOrgCard({ org, request }: { org: RequestOrg; request: RequestWithOrg | null }) {
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center gap-3">
          {org.logo_url ? (
            <img src={org.logo_url} alt={org.name} className="h-11 w-11 rounded-lg object-cover" />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-background">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{org.name}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {org.province && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {org.province}
                </span>
              )}
              {org.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {org.phone}
                </span>
              )}
            </div>
          </div>
        </div>
        {request && (
          <>
            <Separator />
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Trạng thái</span>
              <Badge variant="secondary" className="font-normal">
                {SERVICE_REQUEST_STATUS_LABELS[request.status]}
              </Badge>
            </div>
            {request.message && (
              <p className="rounded-lg border border-border bg-background p-3 text-sm text-foreground">
                “{request.message}”
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface ConsignmentPanelProps {
  posting: AssetPosting;
  requests: RequestWithOrg[];
  brokerRequest: AssetBrokerRequest | null;
  org: RequestOrg | null;
  onSelectQuote: (requestId: string) => void;
  isSelecting: boolean;
  onCancelBroker: () => void;
  isCancelling: boolean;
}

/**
 * Toàn bộ trạng thái ký gửi của một hồ sơ trên trang chủ tài sản: tiến trình
 * nhờ sàn, các báo giá nhận được, và tổ chức cuối cùng được chọn.
 */
export function ConsignmentPanel({
  posting,
  requests,
  brokerRequest,
  org,
  onSelectQuote,
  isSelecting,
  onCancelBroker,
  isCancelling,
}: ConsignmentPanelProps) {
  const decided = requests.some((r) => r.status === "selected");
  const quotes = requests.filter((r) => r.status === "quoted" || r.status === "selected");
  const declined = requests.filter((r) => r.status === "declined");
  const waiting = requests.filter((r) => r.status === "sent" || r.status === "seen");

  if (!brokerRequest && requests.length === 0) return null;

  return (
    <div className="space-y-4">
      {brokerRequest && brokerRequest.status !== "cancelled" && (
        <Card className="border-primary/20">
          <CardContent className="space-y-4 pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="font-semibold text-foreground">Sàn đang chọn tổ chức giúp bạn</p>
                  <p className="text-sm text-muted-foreground">
                    {BROKER_REQUEST_STATUS_LABELS[brokerRequest.status]}
                    {waiting.length > 0 && ` · đã gửi ${waiting.length + quotes.length} tổ chức`}
                  </p>
                </div>
              </div>
              {/* Huỷ được khi sàn chưa gửi đi đâu; đã có báo giá thì chọn hoặc để đó. */}
              {brokerRequest.status === "pending" && (
                <Button variant="ghost" size="sm" className="gap-1.5" onClick={onCancelBroker} disabled={isCancelling}>
                  {isCancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                  Huỷ
                </Button>
              )}
            </div>

            <BrokerProgress status={brokerRequest.status} />

            {brokerRequest.note && (
              <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground">
                “{brokerRequest.note}”
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {quotes.length > 0 && (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div>
              <h2 className="font-semibold text-foreground">
                {decided ? "Tổ chức bạn đã chọn" : `${quotes.length} báo giá nhận được`}
              </h2>
              {!decided && (
                <p className="text-sm text-muted-foreground">
                  So sánh và chọn một tổ chức để ký gửi. Chọn xong, các báo giá còn lại sẽ đóng lại.
                </p>
              )}
            </div>
            <QuoteComparison
              quotes={quotes}
              acceptableCommissionPct={posting.commission_pct}
              onSelect={onSelectQuote}
              isSelecting={isSelecting}
              decided={decided}
            />
          </CardContent>
        </Card>
      )}

      {/* Chưa có báo giá nào: cho biết đang chờ ai, đừng để màn hình trống. */}
      {quotes.length === 0 && waiting.length > 0 && (
        <Card>
          <CardContent className="space-y-2 pt-5">
            <p className="font-semibold text-foreground">Đang chờ tổ chức phản hồi</p>
            <div className="space-y-1.5">
              {waiting.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-foreground">{r.org?.name ?? "Tổ chức đấu giá"}</span>
                  <Badge variant="secondary" className="shrink-0 font-normal">
                    {SERVICE_REQUEST_STATUS_LABELS[r.status]}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {declined.length > 0 && !decided && (
        <Card className="border-border">
          <CardContent className="space-y-1.5 pt-5">
            <p className="text-sm font-semibold text-foreground">Tổ chức đã từ chối</p>
            {declined.map((r) => (
              <p key={r.id} className="text-sm text-muted-foreground">
                {r.org?.name ?? "Tổ chức đấu giá"}
                {r.decline_reason ? ` — ${r.decline_reason}` : ""}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {decided && org && <ChosenOrgCard org={org} request={requests.find((r) => r.status === "selected") ?? null} />}
    </div>
  );
}
