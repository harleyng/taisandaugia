import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, ExternalLink, FileSignature, Upload } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
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
import { AttachSignedDialog } from "@/components/sale-contracts/AttachSignedDialog";
import { CancelSaleDialog } from "@/components/sale-contracts/CancelSaleDialog";
import { ConfirmHandoverDialog } from "@/components/sale-contracts/ConfirmHandoverDialog";
import { ConfirmSignedDialog } from "@/components/sale-contracts/ConfirmSignedDialog";
import { supabase } from "@/integrations/supabase/client";
import { usePostingBrief } from "@/hooks/useOwnerContracts";
import {
  useAttachSignedSale,
  useCancelSaleContract,
  useConfirmSaleHandover,
  useConfirmSaleSigned,
  useSaleContractDetail,
} from "@/hooks/useSaleContracts";
import { ownerContractsPath } from "@/lib/contracts/paths";
import { qk } from "@/lib/queryKeys";
import { dayMonth } from "@/lib/contracts/detailView";
import { ownerSides, saleActivity, saleNextStep, saleStepper, saleSummary, saleTerms } from "@/lib/contracts/saleView";
import { canAttachSigned, canCancel, canConfirmHandover, canConfirmSigned } from "@/lib/saleContracts/stage";
import { PORTAL_SALE_CONTRACTS_PATH, SALE_BUCKET } from "@/lib/saleContracts/files";
import { ownerPostingPath } from "@/lib/vrTour/paths";
import type { SaleAssetSnapshot, SaleContract, SaleSide } from "@/types/auction-sale-contract";

type DialogKind =
  | { kind: "attach"; side: SaleSide }
  | { kind: "confirm"; side: SaleSide }
  | { kind: "cancel"; side: SaleSide }
  | { kind: "handover"; side: SaleSide }
  | null;

function docsOf(c: SaleContract): ContractDoc[] {
  const docs: ContractDoc[] = [
    c.signed_doc_path
      ? { key: "contract", name: "Hợp đồng mua bán đã ký", sub: `PDF · ${dayMonth(c.signed_uploaded_at) ?? ""}`.trim(), action: <StorageDocLink path={c.signed_doc_path} bucket={SALE_BUCKET} /> }
      : c.draft_doc_path
        ? { key: "contract", name: "Dự thảo hợp đồng mua bán", sub: `PDF · tổ chức chia sẻ ${dayMonth(c.draft_uploaded_at) ?? ""}`.trim(), action: <StorageDocLink path={c.draft_doc_path} bucket={SALE_BUCKET} /> }
        : { key: "contract", name: "Hợp đồng mua bán", sub: "Chưa có — tổ chức đang soạn dự thảo", action: null },
    {
      key: "handover",
      name: "Biên bản bàn giao",
      sub: c.handover_doc_path ? `PDF · ${dayMonth(c.handed_over_at) ?? ""}`.trim() : "Chưa có — lập khi bàn giao",
      action: c.handover_doc_path ? <StorageDocLink path={c.handover_doc_path} bucket={SALE_BUCKET} /> : null,
    },
  ];
  if (c.title_transfer_status !== "not_required") {
    docs.push({
      key: "title",
      name: "Giấy tờ sang tên",
      sub: c.title_transfer_doc_path ? "Đã tải lên" : "Chưa có — cập nhật khi làm thủ tục sang tên",
      action: c.title_transfer_doc_path ? <StorageDocLink path={c.title_transfer_doc_path} bucket={SALE_BUCKET} /> : null,
    });
  }
  return docs;
}

/** Hồ sơ số hoá của hợp đồng mua bán — đi qua hợp đồng ký gửi gốc. */
function useSalePostingId(consignmentContractId: string | null | undefined) {
  return useQuery({
    queryKey: qk.saleContracts.postingOf(consignmentContractId),
    enabled: !!consignmentContractId,
    staleTime: Infinity,
    queryFn: async () => {
      const { data } = await supabase
        .from("consignment_contracts")
        .select("asset_posting_id")
        .eq("id", consignmentContractId!)
        .maybeSingle();
      return data?.asset_posting_id ?? null;
    },
  }).data ?? null;
}

/**
 * /chu-tai-san/hop-dong/mua-ban/:id — hợp đồng mua bán trong cổng chủ tài sản (design
 * "Hop Dong - Danh sach & Chi tiet"). Cùng RPC sale_contract_detail với bên mua / tổ
 * chức; nút theo `can_act` (bên bán / bên mua). Việc của tổ chức (ghi thu, sửa điều
 * khoản, hẹn bàn giao…) làm ở cổng tổ chức — người đóng cả vai đó có nút mở sang.
 */
export default function OwnerSaleContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useSaleContractDetail(id ?? null);
  const postingId = useSalePostingId(data?.contract.consignment_contract_id);
  const brief = usePostingBrief(postingId);
  const attachSigned = useAttachSignedSale();
  const confirmSigned = useConfirmSaleSigned();
  const cancel = useCancelSaleContract();
  const confirmHandover = useConfirmSaleHandover();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const close = () => setDialog(null);
  const back = () => navigate(ownerContractsPath("mua-ban"));

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
  const asset = (c.asset_snapshot ?? {}) as SaleAssetSnapshot;
  const sides = ownerSides(data.can_act);
  const next = saleNextStep(data, sides);
  const confirmSide = sides.find((s) => canConfirmSigned(c, s));
  const attachSide = sides.find((s) => canAttachSigned(c, s));
  const handoverSide = sides.find((s) => canConfirmHandover(c, s));
  const cancelSide = canCancel(c) ? sides[0] : undefined;
  const ref = { id: c.id, organization_id: c.organization_id };
  const sessionId = c.session_id;

  return (
    <div className="space-y-5">
      <ContractDetailHeader
        eyebrow="Hợp đồng mua bán tài sản"
        title={asset.title ?? brief?.title ?? "Tài sản"}
        code={c.code}
        location={[asset.district, asset.province].filter(Boolean).join(", ") || brief?.location || null}
        updatedAt={c.updated_at}
        imageUrl={asset.image_url ?? brief?.imageUrl ?? null}
        stepper={saleStepper(data)}
        mine={next.mine}
        onBack={back}
        onOpenPosting={postingId ? () => navigate(ownerPostingPath(postingId)) : null}
      />

      <ContractDetailLayout
        main={
          <>
            <ContractNextStepCard
              next={next}
              terms={saleTerms(data)}
              cancel={cancelSide ? <CancelLink onClick={() => setDialog({ kind: "cancel", side: cancelSide })} /> : null}
              actions={
                attachSide || confirmSide || handoverSide || data.can_act.org ? (
                  <>
                    {data.can_act.org && (
                      <Button variant="outline" className="gap-1.5" onClick={() => navigate(`${PORTAL_SALE_CONTRACTS_PATH}/${c.id}`)}>
                        <ExternalLink className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                        Mở ở cổng tổ chức
                      </Button>
                    )}
                    {attachSide && (
                      <Button
                        variant={confirmSide ? "outline" : "default"}
                        className="gap-1.5"
                        onClick={() => setDialog({ kind: "attach", side: attachSide })}
                      >
                        <Upload className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                        {c.signed_doc_path ? "Thay bản đã ký" : "Tải bản đã ký"}
                      </Button>
                    )}
                    {confirmSide && (
                      <Button className="gap-1.5" onClick={() => setDialog({ kind: "confirm", side: confirmSide })}>
                        <Check className="h-4 w-4" strokeWidth={2} aria-hidden />
                        Xác nhận bản đã ký
                      </Button>
                    )}
                    {handoverSide && (
                      <Button className="gap-1.5" onClick={() => setDialog({ kind: "handover", side: handoverSide })}>
                        <Check className="h-4 w-4" strokeWidth={2} aria-hidden />
                        Xác nhận bàn giao
                      </Button>
                    )}
                  </>
                ) : null
              }
            />
            <ContractDocumentsCard docs={docsOf(c)} />
          </>
        }
        side={
          <>
            <ContractSummaryCard view={saleSummary(data)} />
            <ContractActivityCard items={saleActivity(data.events)} />
          </>
        }
      />

      <AttachSignedDialog
        open={dialog?.kind === "attach"}
        onOpenChange={(v) => !v && close()}
        isPending={attachSigned.isPending}
        defaultContractNo={c.contract_no}
        replacing={!!c.signed_doc_path}
        onSubmit={(v) =>
          dialog?.kind === "attach" &&
          attachSigned.mutate(
            { contract: ref, side: dialog.side, file: v.file, signedDate: v.signedDate, contractNo: v.contractNo || null, confirm: v.confirm },
            { onSuccess: close },
          )
        }
      />
      <ConfirmSignedDialog
        open={dialog?.kind === "confirm"}
        onOpenChange={(v) => !v && close()}
        side={dialog?.kind === "confirm" ? dialog.side : "seller"}
        signedDocPath={c.signed_doc_path}
        isPending={confirmSigned.isPending}
        onConfirm={() =>
          dialog?.kind === "confirm" &&
          c.signed_doc_path &&
          confirmSigned.mutate({ contractId: c.id, side: dialog.side, signedDocPath: c.signed_doc_path }, { onSuccess: close })
        }
      />
      <CancelSaleDialog
        open={dialog?.kind === "cancel"}
        onOpenChange={(v) => !v && close()}
        side={dialog?.kind === "cancel" ? dialog.side : "seller"}
        isPending={cancel.isPending}
        isSigned={c.status === "signed"}
        onSubmit={(v) =>
          dialog?.kind === "cancel" &&
          cancel.mutate({ contractId: c.id, side: dialog.side, kind: v.kind, reason: v.reason, sessionId }, { onSuccess: close })
        }
      />
      <ConfirmHandoverDialog
        open={dialog?.kind === "handover"}
        onOpenChange={(v) => !v && close()}
        side={dialog?.kind === "handover" ? dialog.side : "seller"}
        isPending={confirmHandover.isPending}
        onSubmit={(file) =>
          dialog?.kind === "handover" && confirmHandover.mutate({ contract: ref, side: dialog.side, file, sessionId }, { onSuccess: close })
        }
      />
    </div>
  );
}
