import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, CreditCard, FileSignature } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { ContractDetailHeader } from "@/components/asset-owner-portal/contracts/detail/ContractDetailHeader";
import { ContractNextStepCard } from "@/components/asset-owner-portal/contracts/detail/ContractNextStepCard";
import { ActionDocLink, ContractDocumentsCard } from "@/components/asset-owner-portal/contracts/detail/ContractDocumentsCard";
import { ContractActivityCard, ContractSummaryCard } from "@/components/asset-owner-portal/contracts/detail/ContractSideCards";
import { ContractDetailLayout } from "@/components/asset-owner-portal/contracts/detail/ContractDetailLayout";
import { ContractClausesView } from "@/components/contracts/ContractClausesView";
import { usePostingBrief } from "@/hooks/useOwnerContracts";
import { downloadServiceContractPdf, useServiceContractDetail } from "@/hooks/useServiceContracts";
import { ownerContractsPath } from "@/lib/contracts/paths";
import { dayMonth } from "@/lib/contracts/detailView";
import {
  serviceActivity,
  serviceNextStep,
  serviceStageOfDetail,
  serviceStepper,
  serviceSummary,
  serviceTerms,
} from "@/lib/contracts/serviceView";
import { SERVICE_CONTRACT_LABELS, serviceOrderOwnerPath } from "@/lib/serviceContracts";
import { serviceTemplateType } from "@/lib/contracts/templates/schema";
import { ownerPostingPath } from "@/lib/vrTour/paths";

/**
 * /chu-tai-san/hop-dong/dich-vu/:id — hợp đồng cung ứng dịch vụ đã giao kết (design
 * "Hop Dong - Danh sach & Chi tiet"). Hợp đồng bất biến; thao tác duy nhất là thanh
 * toán / xem đơn — nằm ở thẻ đơn trong hồ sơ (nơi có cổng quyền của đơn).
 */
export default function OwnerServiceContractPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useServiceContractDetail(id);
  const brief = usePostingBrief(data?.contract.asset_posting_id);
  const [downloading, setDownloading] = useState(false);
  const back = () => navigate(ownerContractsPath("dich-vu"));

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-72" />
        <Skeleton className="h-52 w-full rounded-2xl" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={back}>
          <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
          Hợp đồng
        </Button>
        <div className="rounded-2xl bg-card shadow-card">
          <EmptyState icon={FileSignature} title="Không tìm thấy hợp đồng" description="Hợp đồng không tồn tại hoặc bạn không có quyền xem." />
        </div>
      </div>
    );
  }

  const c = data.contract;
  const stage = serviceStageOfDetail(data);
  const next = serviceNextStep(data);
  const orderPath = serviceOrderOwnerPath(c.service_kind, c.asset_posting_id);
  const onDownload = async () => {
    setDownloading(true);
    try {
      await downloadServiceContractPdf(data);
    } catch {
      toast.error("Không tạo được tệp PDF. Vui lòng thử lại.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-5">
      <ContractDetailHeader
        eyebrow={`Hợp đồng dịch vụ · ${SERVICE_CONTRACT_LABELS[c.service_kind]}`}
        title={c.terms.posting_title ?? brief?.title ?? "Tài sản"}
        code={c.code}
        location={brief?.location ?? null}
        updatedAt={[data.order?.cancelled_at, data.order?.done_at, data.order?.paid_at, c.accepted_at].find(Boolean) ?? null}
        imageUrl={brief?.imageUrl ?? null}
        stepper={serviceStepper(data)}
        mine={next.mine}
        onBack={back}
        onOpenPosting={() => navigate(ownerPostingPath(c.asset_posting_id))}
      />

      <ContractDetailLayout
        main={
          <>
            <ContractNextStepCard
              next={next}
              terms={serviceTerms(data)}
              actions={
                stage === "awaiting_payment" ? (
                  <Button className="gap-1.5" onClick={() => navigate(orderPath)}>
                    <CreditCard className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    Thanh toán
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => navigate(orderPath)}>
                    Xem đơn dịch vụ
                  </Button>
                )
              }
            />
            <ContractDocumentsCard
              docs={[
                {
                  key: "contract",
                  name: "Hợp đồng cung ứng dịch vụ",
                  sub: `PDF · đồng ý ${dayMonth(c.accepted_at) ?? ""} · mẫu ${c.template_version}`,
                  action: <ActionDocLink onClick={() => void onDownload()} busy={downloading} />,
                },
              ]}
            />
            <Collapsible className="rounded-2xl bg-card shadow-card">
              <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 px-[22px] py-5 text-left">
                <span className="text-base font-semibold tracking-tight text-foreground">Điều khoản hợp đồng</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" aria-hidden />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-[22px] pb-5">
                <ContractClausesView templateType={serviceTemplateType(c.service_kind)} clauses={data.template.clauses} />
              </CollapsibleContent>
            </Collapsible>
          </>
        }
        side={
          <>
            <ContractSummaryCard view={serviceSummary(data)} />
            <ContractActivityCard items={serviceActivity(data)} />
          </>
        }
      />
    </div>
  );
}
