import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Check, FileSignature, Share2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { ContractDetailHeader } from "@/components/asset-owner-portal/contracts/detail/ContractDetailHeader";
import { ContractNextStepCard } from "@/components/asset-owner-portal/contracts/detail/ContractNextStepCard";
import {
  ContractDocumentsCard,
  StorageDocLink,
  type ContractDoc,
} from "@/components/asset-owner-portal/contracts/detail/ContractDocumentsCard";
import { ContractActivityCard, ContractSummaryCard } from "@/components/asset-owner-portal/contracts/detail/ContractSideCards";
import { CancelLink, ContractDetailLayout } from "@/components/asset-owner-portal/contracts/detail/ContractDetailLayout";
import { ConsignmentCanvas } from "@/components/portal/consignment/ConsignmentCanvas";
import { Note } from "@/components/portal/consignment/detail/DetailCard";
import {
  ConsignmentContractDialogs,
  type ContractDialogKind,
} from "@/components/portal/contracts/ConsignmentContractDialogs";
import { ConsignmentOwnerPartyCard, ConsignmentPlanCard } from "@/components/portal/contracts/ConsignmentPartyCards";
import { useOrgConsignmentContractById } from "@/hooks/useConsignmentContract";
import { useOrgServiceRequests } from "@/hooks/useOrgServiceRequests";
import { useHasOrgPermission } from "@/hooks/useOrgPermissions";
import { dayMonth } from "@/lib/contracts/detailView";
import { consignmentStepper, consignmentTerms } from "@/lib/contracts/consignmentView";
import { orgConsignmentActivity, orgConsignmentNextStep, orgConsignmentSummary } from "@/lib/contracts/orgConsignmentView";
import { portalConsignmentRequestPath } from "@/lib/contracts/portalRows";
import { canAttachSigned, canCancel, canConfirm, canShareDraft, isContractOpen } from "@/lib/consignment/contractState";
import type { ConsignmentContract } from "@/types/consignment-contract";

const QUOTE_BUCKET = "quote-docs";
const LIST_PATH = "/portal/hop-dong?loai=ky-gui";

function docsOf(c: ConsignmentContract): ContractDoc[] {
  const uploader = c.signed_uploaded_side === "org" ? "bạn" : "chủ tài sản";
  return [
    {
      key: "draft",
      name: "Dự thảo hợp đồng",
      sub: c.draft_doc_path ? `PDF · bạn chia sẻ ${dayMonth(c.draft_uploaded_at) ?? ""}`.trim() : "Chưa có — bạn soạn và chia sẻ",
      action: c.draft_doc_path ? <StorageDocLink path={c.draft_doc_path} /> : null,
    },
    {
      key: "signed",
      name: "Bản đã ký (scan)",
      sub: c.signed_doc_path
        ? `PDF · ${uploader} tải lên ${dayMonth(c.signed_uploaded_at) ?? ""}`.trim()
        : "Chưa có — một bên tải lên sau khi ký",
      action: c.signed_doc_path ? <StorageDocLink path={c.signed_doc_path} /> : null,
    },
    {
      key: "quote",
      name: "Báo giá đã chốt",
      sub: c.terms.quote_doc_path
        ? `PDF · ${dayMonth(c.terms.quoted_at) ?? ""}`.trim()
        : "Không có tệp — báo giá lập trực tiếp trên sàn",
      action: c.terms.quote_doc_path ? <StorageDocLink path={c.terms.quote_doc_path} bucket={QUOTE_BUCKET} /> : null,
    },
  ];
}

/**
 * /portal/hop-dong/ky-gui/:id — hợp đồng ký gửi với chủ tài sản, theo góc nhìn tổ chức.
 * MỌI thao tác hợp đồng ở đây (trang yêu cầu chỉ còn lối vào). Quyền ghi = mã
 * `yeu-cau-ky-gui:update` VÀ `can_act` của RPC — server mới là cổng thật.
 */
export default function HopDongKyGuiDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useOrgConsignmentContractById(id);
  const { requests, auctionOrgId } = useOrgServiceRequests();
  const canUpdate = useHasOrgPermission("yeu-cau-ky-gui", "update");
  const canCreateSession = useHasOrgPermission("phien-dau-gia", "create");
  const [dialog, setDialog] = useState<ContractDialogKind | null>(null);
  const back = () => navigate(LIST_PATH);

  if (isLoading) {
    return (
      <ConsignmentCanvas>
        <Skeleton className="h-5 w-72" />
        <Skeleton className="h-52 w-full rounded-2xl" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </ConsignmentCanvas>
    );
  }

  if (error || !data) {
    return (
      <ConsignmentCanvas>
        <Button type="button" variant="ghost" size="sm" className="-ml-2 self-start" onClick={back}>
          <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
          Hợp đồng
        </Button>
        <div className="rounded-2xl bg-card shadow-card">
          <EmptyState
            icon={FileSignature}
            title="Không tìm thấy hợp đồng"
            description="Hợp đồng không tồn tại hoặc bạn không có quyền xem."
          />
        </div>
      </ConsignmentCanvas>
    );
  }

  const c = data.contract;
  const request = requests.find((r) => r.id === data.request_id) ?? null;
  const startingPrice = request?.starting_price ?? null;
  const ownerName = data.owner_party?.org_name ?? data.owner_party?.full_name ?? null;
  const next = orgConsignmentNextStep(c, data.missing);
  const open = isContractOpen(c);
  const actor = canUpdate && data.can_act;
  const showShare = actor && canShareDraft(c, "org") && c.status !== "awaiting_confirmation";
  const showConfirm = actor && canConfirm(c, "org");
  const showAttach = actor && canAttachSigned(c) && c.status !== "drafting";

  return (
    <ConsignmentCanvas>
      <ContractDetailHeader
        eyebrow="Hợp đồng ký gửi đấu giá"
        title={data.asset?.title ?? request?.title ?? "Tài sản"}
        code={c.code}
        location={request ? [request.district, request.province].filter(Boolean).join(", ") || null : null}
        updatedAt={c.updated_at}
        imageUrl={request?.image_urls?.[0] ?? null}
        stepper={consignmentStepper(c)}
        mine={next.mine && actor}
        onBack={back}
        onOpenPosting={() => navigate(portalConsignmentRequestPath(data.request_id))}
        postingLabel="Yêu cầu ký gửi"
      />

      <ContractDetailLayout
        main={
          <>
            <ContractNextStepCard
              next={{ ...next, mine: next.mine && actor }}
              terms={consignmentTerms(c)}
              cancel={actor && canCancel(c) ? <CancelLink onClick={() => setDialog("cancel")} /> : null}
              actions={
                showShare || showAttach || showConfirm || (c.status === "signed" && canCreateSession) ? (
                  <>
                    {showShare && (
                      <Button
                        variant={c.status === "drafting" ? "default" : "outline"}
                        className="gap-1.5"
                        onClick={() => setDialog("share")}
                      >
                        <Share2 className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                        {c.status === "drafting" ? "Chia sẻ dự thảo" : "Chia sẻ dự thảo mới"}
                      </Button>
                    )}
                    {showAttach && (
                      <Button
                        variant={c.status === "awaiting_signatures" ? "default" : "outline"}
                        className="gap-1.5"
                        onClick={() => setDialog("attach")}
                      >
                        <Upload className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                        {c.signed_doc_path ? "Tải bản đã ký khác" : "Tải bản đã ký"}
                      </Button>
                    )}
                    {showConfirm && (
                      <Button className="gap-1.5" onClick={() => setDialog("confirm")}>
                        <Check className="h-4 w-4" strokeWidth={2} aria-hidden />
                        Xác nhận bản đã ký
                      </Button>
                    )}
                    {c.status === "signed" && canCreateSession && (
                      <Button onClick={() => navigate("/portal/phien-dau-gia/moi")}>Tạo phiên đấu giá</Button>
                    )}
                  </>
                ) : null
              }
            >
              {open && data.missing.includes("org_legal_rep") && (
                <Note tone="warning">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-start gap-1.5">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
                      Tổ chức chưa khai người đại diện theo pháp luật.
                    </span>
                    <Button size="sm" variant="outline" onClick={() => navigate("/portal/nang-luc/thong-tin-chung")}>
                      Cập nhật Thông tin chung
                    </Button>
                  </div>
                </Note>
              )}
              {open && !actor && <p className="text-[12.5px] text-muted-foreground">Bạn chỉ có quyền xem hợp đồng này.</p>}
            </ContractNextStepCard>
            <ConsignmentOwnerPartyCard detail={data} />
            <ContractDocumentsCard docs={docsOf(c)} />
            <ConsignmentPlanCard terms={c.terms} startingPrice={startingPrice} />
          </>
        }
        side={
          <>
            <ContractSummaryCard view={orgConsignmentSummary(c, ownerName, startingPrice)} />
            <ContractActivityCard items={orgConsignmentActivity(data.events, c.cancel_reason)} />
          </>
        }
      />

      <ConsignmentContractDialogs
        detail={data}
        requestId={data.request_id}
        auctionOrgId={auctionOrgId}
        open={dialog}
        onClose={() => setDialog(null)}
      />
    </ConsignmentCanvas>
  );
}
