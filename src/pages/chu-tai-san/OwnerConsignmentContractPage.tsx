import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, FileSignature, Upload } from "lucide-react";
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
import { AttachSignedDialog } from "@/components/consignment/AttachSignedDialog";
import { ConfirmSignedDialog } from "@/components/consignment/ConfirmSignedDialog";
import { CancelContractDialog } from "@/components/consignment/CancelContractDialog";
import { OwnerAddressDialog } from "@/components/asset-posting/OwnerAddressDialog";
import { usePostingBrief, useOwnerConsignmentContract } from "@/hooks/useOwnerContracts";
import {
  useAttachSignedContract,
  useCancelContract,
  useConfirmContract,
  usePostingPartyAddress,
} from "@/hooks/useConsignmentContract";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { ownerContractsPath } from "@/lib/contracts/paths";
import { dayMonth } from "@/lib/contracts/detailView";
import {
  consignmentActivity,
  consignmentNextStep,
  consignmentStepper,
  consignmentSummary,
  consignmentTerms,
} from "@/lib/contracts/consignmentView";
import { canAttachSigned, canCancel, canConfirm, isContractOpen } from "@/lib/consignment/contractState";
import { ownerPostingPath } from "@/lib/vrTour/paths";
import type { ConsignmentContract } from "@/types/consignment-contract";

type DialogKind = "attach" | "confirm" | "cancel" | "address" | null;

const QUOTE_BUCKET = "quote-docs";

function docsOf(c: ConsignmentContract, orgName: string): ContractDoc[] {
  const uploader = c.signed_uploaded_side === "owner" ? "bạn" : orgName;
  return [
    {
      key: "draft",
      name: "Dự thảo hợp đồng",
      sub: c.draft_doc_path ? `PDF · ${orgName} chia sẻ ${dayMonth(c.draft_uploaded_at) ?? ""}`.trim() : "Chưa có — tổ chức đang soạn",
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
 * /chu-tai-san/hop-dong/ky-gui/:id — hợp đồng dịch vụ đấu giá với tổ chức đã chốt (design
 * "Hop Dong - Danh sach & Chi tiet"). Thao tác phía chủ tài sản (xác nhận / tải bản ký,
 * huỷ, bổ sung địa chỉ) dùng lại các hộp thoại + RPC cũ; quyền ghi theo hồ sơ của hợp
 * đồng (ký gửi:update) — RLS + RPC mới là cổng thật.
 */
export default function OwnerConsignmentContractPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useOwnerConsignmentContract(id);
  const { postingAccess } = useOwnerWorkspace();
  const postingId = data?.contract.asset_posting_id ?? null;
  const brief = usePostingBrief(postingId);
  const addressQuery = usePostingPartyAddress(postingId);
  const ctx = { side: "owner", postingId: postingId ?? "" } as const;
  const attach = useAttachSignedContract(ctx);
  const confirm = useConfirmContract(ctx);
  const cancel = useCancelContract(ctx);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const close = () => setDialog(null);
  const back = () => navigate(ownerContractsPath("ky-gui"));

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
          <EmptyState
            icon={FileSignature}
            title="Không tìm thấy hợp đồng"
            description="Hợp đồng không tồn tại hoặc bạn không có quyền xem trong không gian đang chọn."
          />
        </div>
      </div>
    );
  }

  const { contract: c, posting, org, events } = data;
  const orgName = org?.name ?? c.org_party?.name ?? "Tổ chức đấu giá";
  const canWrite = posting ? postingAccess(posting).consign : false;
  const open = isContractOpen(c);
  const missingAddress = open && addressQuery.isSuccess && !addressQuery.data?.address?.trim();
  const next = consignmentNextStep(c, orgName, missingAddress);
  const showConfirm = canWrite && canConfirm(c, "owner");
  const showAttach = canWrite && open && canAttachSigned(c) && c.status !== "drafting";
  const showAddress = missingAddress && !!addressQuery.data?.canEdit;

  return (
    <div className="space-y-5">
      <ContractDetailHeader
        eyebrow="Hợp đồng ký gửi đấu giá"
        title={c.asset_snapshot?.title ?? posting?.title ?? brief?.title ?? "Tài sản"}
        code={c.code}
        location={brief?.location ?? null}
        updatedAt={c.updated_at}
        imageUrl={brief?.imageUrl ?? null}
        stepper={consignmentStepper(c)}
        mine={next.mine}
        onBack={back}
        onOpenPosting={() => navigate(ownerPostingPath(c.asset_posting_id))}
      />

      <ContractDetailLayout
        main={
          <>
            <ContractNextStepCard
              next={next}
              terms={consignmentTerms(c)}
              cancel={canWrite && canCancel(c) ? <CancelLink onClick={() => setDialog("cancel")} /> : null}
              actions={
                showAddress || showConfirm || showAttach ? (
                  <>
                    {showAttach && (
                      <Button variant={showConfirm ? "outline" : "default"} className="gap-1.5" onClick={() => setDialog("attach")}>
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
                    {showAddress && <Button onClick={() => setDialog("address")}>Bổ sung địa chỉ</Button>}
                  </>
                ) : null
              }
            >
              {missingAddress && !addressQuery.data?.canEdit && addressQuery.data?.workspaceId && (
                <p className="text-[12.5px] text-warning">Trưởng đơn vị cần bổ sung địa chỉ trụ sở.</p>
              )}
            </ContractNextStepCard>
            <ContractDocumentsCard docs={docsOf(c, orgName)} />
          </>
        }
        side={
          <>
            <ContractSummaryCard
              view={consignmentSummary(c, orgName, posting?.starting_price ?? null, missingAddress)}
            />
            <ContractActivityCard items={consignmentActivity(events, orgName, c.cancel_reason)} />
          </>
        }
      />

      <AttachSignedDialog
        open={dialog === "attach"}
        onOpenChange={(o) => !o && close()}
        isPending={attach.isPending}
        defaultContractNo={c.contract_no}
        replacing={!!c.signed_doc_path}
        onSubmit={(v) => attach.mutate({ contract: c, ...v }, { onSuccess: close })}
      />
      <ConfirmSignedDialog
        open={dialog === "confirm"}
        onOpenChange={(o) => !o && close()}
        isPending={confirm.isPending}
        signedDocPath={c.signed_doc_path}
        signedDate={c.signed_date}
        onConfirm={() =>
          c.signed_doc_path &&
          confirm.mutate({ contractId: c.id, signedDocPath: c.signed_doc_path }, { onSettled: close })
        }
      />
      <CancelContractDialog
        open={dialog === "cancel"}
        onOpenChange={(o) => !o && close()}
        isPending={cancel.isPending}
        side="owner"
        onConfirm={(reason) => cancel.mutate({ contractId: c.id, reason }, { onSuccess: close })}
      />
      <OwnerAddressDialog
        open={dialog === "address"}
        onOpenChange={(o) => !o && close()}
        postingId={c.asset_posting_id}
        current={addressQuery.data ?? null}
      />
    </div>
  );
}
