import { useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, FileSignature, Upload, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ContractStatusStepper } from "@/components/consignment/ContractStatusStepper";
import { ContractTermsCard } from "@/components/consignment/ContractTermsCard";
import { ContractFileButton } from "@/components/consignment/ContractFileButton";
import { AttachSignedDialog } from "@/components/consignment/AttachSignedDialog";
import { ConfirmSignedDialog } from "@/components/consignment/ConfirmSignedDialog";
import { CancelContractDialog } from "@/components/consignment/CancelContractDialog";
import { OrgIdentity } from "./ChosenOrgCard";
import { OwnerAddressDialog } from "./OwnerAddressDialog";
import {
  useAttachSignedContract,
  useCancelContract,
  useConfirmContract,
  useOwnerKycAddress,
} from "@/hooks/useConsignmentContract";
import { canAttachSigned, canCancel, canConfirm, isContractOpen } from "@/lib/consignment/contractState";
import {
  CONTRACT_STATUS_BADGE_CLASS,
  CONTRACT_STATUS_LABELS_OWNER,
  type ConsignmentContract,
} from "@/types/consignment-contract";
import type { RequestOrg } from "@/hooks/useAssetPosting";

type DialogKind = "attach" | "confirm" | "cancel" | "address" | null;

function nextStepText(c: ConsignmentContract, orgName: string): string {
  switch (c.status) {
    case "drafting":
      return `${orgName} đang soạn dự thảo hợp đồng theo báo giá bạn đã chọn.`;
    case "awaiting_signatures":
      return "Dự thảo đã sẵn sàng. Hai bên ký bản giấy, rồi một bên tải bản đã ký lên đây.";
    case "awaiting_confirmation":
      return canConfirm(c, "owner")
        ? "Mở bản đã ký, kiểm tra và xác nhận đúng hợp đồng hai bên đã ký."
        : `Bạn đã xác nhận. Chờ ${orgName} xác nhận bản đã ký.`;
    case "signed":
      return `Hợp đồng có hiệu lực${c.signed_date ? ` từ ngày ${format(new Date(c.signed_date), "dd/MM/yyyy")}` : ""}. ${orgName} có thể đưa tài sản vào phiên đấu giá.`;
    default:
      return "";
  }
}

interface OwnerContractPanelProps {
  contract: ConsignmentContract;
  org: RequestOrg | null;
  postingId: string;
  startingPrice: number | null;
}

/** Hợp đồng dịch vụ với tổ chức đã chốt — theo góc nhìn chủ tài sản. */
export function OwnerContractPanel({ contract: c, org, postingId, startingPrice }: OwnerContractPanelProps) {
  const ctx = { side: "owner", postingId } as const;
  const attach = useAttachSignedContract(ctx);
  const confirm = useConfirmContract(ctx);
  const cancel = useCancelContract(ctx);
  const addressQuery = useOwnerKycAddress();
  const [dialog, setDialog] = useState<DialogKind>(null);

  const orgName = org?.name ?? "Tổ chức đấu giá";
  const open = isContractOpen(c);
  const missingAddress = open && addressQuery.isSuccess && !addressQuery.data?.address?.trim();
  const close = () => setDialog(null);

  return (
    <Card className={c.status === "signed" ? "border-success/40" : "border-primary/20"}>
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold text-foreground">Hợp đồng dịch vụ đấu giá</h2>
              <p className="text-xs text-muted-foreground">
                {c.code}
                {c.contract_no && ` · Số ${c.contract_no}`}
              </p>
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${CONTRACT_STATUS_BADGE_CLASS[c.status]}`}>
            {CONTRACT_STATUS_LABELS_OWNER[c.status]}
          </span>
        </div>

        {org && <OrgIdentity org={org} />}

        <ContractStatusStepper contract={c} viewer="owner" />

        {c.status !== "cancelled" && (
          <p className="flex items-start gap-1.5 text-sm text-foreground">
            {c.status === "signed" && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />}
            {nextStepText(c, orgName)}
          </p>
        )}

        {missingAddress && (
          <div className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-start gap-1.5 text-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              Hồ sơ xác thực chưa có địa chỉ — tổ chức chưa lập được hợp đồng.
            </span>
            <Button size="sm" variant="outline" onClick={() => setDialog("address")}>
              Bổ sung địa chỉ
            </Button>
          </div>
        )}

        {(c.draft_doc_path || c.signed_doc_path) && (
          <div className="flex flex-wrap gap-2">
            {c.draft_doc_path && <ContractFileButton path={c.draft_doc_path} label="Dự thảo hợp đồng" />}
            {c.signed_doc_path && <ContractFileButton path={c.signed_doc_path} label="Bản đã ký" />}
          </div>
        )}

        <Separator />
        <ContractTermsCard terms={c.terms} startingPrice={startingPrice} />

        {open && (
          <div className="flex flex-wrap gap-2 pt-1">
            {canConfirm(c, "owner") && (
              <Button onClick={() => setDialog("confirm")} className="gap-2">
                <CheckCircle2 className="h-4 w-4" /> Xác nhận bản đã ký
              </Button>
            )}
            {canAttachSigned(c) && (
              <Button variant="outline" onClick={() => setDialog("attach")} className="gap-2">
                <Upload className="h-4 w-4" /> {c.signed_doc_path ? "Tải bản đã ký khác" : "Tải bản đã ký"}
              </Button>
            )}
            {canCancel(c) && (
              <Button variant="ghost" onClick={() => setDialog("cancel")} className="gap-2 text-destructive hover:text-destructive">
                <XCircle className="h-4 w-4" /> Huỷ hợp đồng
              </Button>
            )}
          </div>
        )}
      </CardContent>

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
        current={addressQuery.data ?? null}
      />
    </Card>
  );
}
