import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Building2, ListChecks, Loader2, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DetailHero } from "@/components/shared/DetailHero";
import { serviceKind, serviceRequestListPath, type ServiceKindKey } from "@/lib/serviceRequests/kinds";
import { ServiceStatusBadge } from "./DetailSection";

export interface ServiceDetailTab {
  /** Slug trên URL (?tab=…). Tab đầu tiên là mặc định, không ghi lên URL. */
  value: string;
  label: string;
  icon: LucideIcon;
  content: React.ReactNode;
}

/**
 * Khung trang chi tiết yêu cầu dịch vụ — cùng bố cục chi tiết khách hàng: nút quay lại, DetailHero
 * (trạng thái + loại, tên tài sản, mã, việc tiếp theo, nút thao tác), rồi Tabs theo ?tab=.
 * Nội dung riêng từng loại là `tabs`; `children` (dialog) render ngoài tab.
 */
export function ServiceDetailShell({
  kind,
  isLoading,
  found,
  notFoundText,
  header,
  actions,
  tabs = [],
  children,
}: {
  kind: ServiceKindKey;
  isLoading: boolean;
  found: boolean;
  notFoundText: string;
  header?: {
    code: string;
    status: string;
    statusLabel: string;
    /** Tên tài sản — tiêu đề lớn của hero. */
    title: string;
    partner?: string | null;
    suffix?: React.ReactNode;
    nextAction: string;
  };
  actions?: React.ReactNode;
  tabs?: ServiceDetailTab[];
  children?: React.ReactNode;
}) {
  const navigate = useNavigate();
  const { state } = useLocation() as { state?: { listSearch?: string } };
  const [searchParams, setSearchParams] = useSearchParams();
  const back = () => navigate(serviceRequestListPath(kind, state?.listSearch));
  const k = serviceKind(kind);

  const backButton = (
    <Button variant="ghost" size="sm" onClick={back} className="-ml-2">
      <ArrowLeft className="mr-1.5 h-4 w-4" /> Yêu cầu dịch vụ
    </Button>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!found || !header) {
    return (
      <div className="p-6">
        <div className="mb-4">{backButton}</div>
        <p className="text-sm text-muted-foreground">{notFoundText}</p>
      </div>
    );
  }

  const defaultTab = tabs[0]?.value;
  const rawTab = searchParams.get("tab");
  const tab = tabs.some((t) => t.value === rawTab) ? (rawTab as string) : defaultTab;
  // Giữ state (bộ lọc danh sách) khi đổi tab — thiếu nó nút quay lại mất bộ lọc.
  const setTab = (v: string) =>
    setSearchParams(v === defaultTab ? {} : { tab: v }, { replace: true, state });

  return (
    <div className="space-y-4 p-6">
      {backButton}

      <DetailHero
        status={<ServiceStatusBadge status={header.status} label={header.statusLabel} />}
        badges={
          <>
            <Badge variant="outline" className="gap-1">
              <k.icon className="h-3 w-3" />
              {k.label}
            </Badge>
            {header.suffix}
          </>
        }
        name={header.title}
        code={header.code}
        subtitle={
          <>
            {header.partner && (
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                {header.partner}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <ListChecks className="h-3.5 w-3.5 shrink-0" />
              Việc tiếp theo: {header.nextAction}
            </span>
          </>
        }
        actions={actions || null}
      />

      {tabs.length > 0 && (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto flex-wrap">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
                <t.icon className="h-4 w-4" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((t) => (
            <TabsContent key={t.value} value={t.value} className="mt-4 space-y-4">
              {t.content}
            </TabsContent>
          ))}
        </Tabs>
      )}

      {children}
    </div>
  );
}
