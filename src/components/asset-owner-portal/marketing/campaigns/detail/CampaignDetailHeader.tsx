import { useNavigate } from "react-router-dom";
import { AlertTriangle, Check, Loader2, Pencil, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { useSubmitCampaign } from "@/hooks/useOwnerMarketingCampaigns";
import { formatShareDateTime } from "@/lib/ownerReportShare";
import { CAMPAIGN_CHANNEL_META, type CampaignRow } from "@/lib/ownerMarketing/campaigns";
import { ownerCampaignEditHref } from "@/lib/ownerMarketing/routes";
import { CampaignStatusBadge } from "../CampaignStatusBadge";

export interface CampaignPermissions {
  edit: boolean;
  remove: boolean;
  review: boolean;
  /** Có quyền duyệt nhưng là người soạn / gửi duyệt. */
  selfReview: boolean;
}

interface CampaignDetailHeaderProps {
  campaign: CampaignRow;
  perms: CampaignPermissions;
  personName: (userId: string | null) => string | null;
  onReview: (mode: "approve" | "reject") => void;
  onDelete: () => void;
}

/** Tiêu đề + trạng thái + MỘT nút chính theo bước của quy trình duyệt hai người. */
export function CampaignDetailHeader({ campaign: c, perms, personName, onReview, onDelete }: CampaignDetailHeaderProps) {
  const navigate = useNavigate();
  const submit = useSubmitCampaign();

  const meta = [
    `${c.assetKeys.length} tài sản`,
    c.channels.map((ch) => CAMPAIGN_CHANNEL_META[ch].label).join(", ") || "Chưa chọn kênh",
    c.branchName,
    personName(c.createdBy) ? `Soạn bởi ${personName(c.createdBy)}` : null,
  ].filter(Boolean);

  const actions = (
    <>
      {perms.remove && (
        <Button variant="ghost" className="gap-1.5 text-muted-foreground hover:text-destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4" strokeWidth={1.5} />
          Xoá nháp
        </Button>
      )}
      {perms.edit && (
        <Button
          variant={c.status === "rejected" ? "default" : "outline"}
          className="gap-1.5"
          onClick={() => navigate(ownerCampaignEditHref(c.id))}
        >
          <Pencil className="h-4 w-4" strokeWidth={1.5} />
          {c.status === "rejected" ? "Sửa lại" : "Sửa"}
        </Button>
      )}
      {perms.edit && c.status === "draft" && (
        <Button className="gap-1.5" disabled={submit.isPending} onClick={() => submit.mutate(c.id)}>
          {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" strokeWidth={1.5} />}
          Gửi duyệt
        </Button>
      )}
      {c.status === "pending_approval" && perms.review && !perms.selfReview && (
        <>
          <Button variant="outline" className="gap-1.5" onClick={() => onReview("reject")}>
            <X className="h-4 w-4" strokeWidth={1.5} />
            Từ chối
          </Button>
          <Button className="gap-1.5" onClick={() => onReview("approve")}>
            <Check className="h-4 w-4" strokeWidth={1.5} />
            Duyệt
          </Button>
        </>
      )}
    </>
  );

  return (
    <div className="space-y-3">
      <OwnerPageHeader
        title={c.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <CampaignStatusBadge status={c.status} />
            <span>{meta.join(" · ")}</span>
          </span>
        }
        actions={actions}
      />

      {c.status === "pending_approval" && (
        <p className="rounded-xl bg-warning/10 px-3.5 py-2.5 text-sm text-foreground">
          Gửi duyệt {c.submittedAt ? formatShareDateTime(c.submittedAt) : ""}
          {personName(c.submittedBy) ? ` bởi ${personName(c.submittedBy)}` : ""}.{" "}
          {perms.review
            ? perms.selfReview
              ? "Bạn là người soạn / gửi duyệt nên không tự duyệt được — nhờ một người khác có quyền Duyệt."
              : "Kiểm tra nội dung bên dưới rồi Duyệt hoặc Từ chối."
            : "Đang chờ người có quyền Duyệt xem xét."}
        </p>
      )}

      {c.status === "rejected" && c.rejectedReason && (
        <div className="flex gap-2 rounded-xl bg-destructive/10 px-3.5 py-2.5 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" strokeWidth={1.5} />
          <p className="min-w-0 break-words">
            <span className="font-semibold">Bị từ chối{personName(c.rejectedBy) ? ` bởi ${personName(c.rejectedBy)}` : ""}:</span>{" "}
            {c.rejectedReason}
          </p>
        </div>
      )}
    </div>
  );
}
