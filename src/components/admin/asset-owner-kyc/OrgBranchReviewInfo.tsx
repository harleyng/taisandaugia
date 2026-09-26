import { AlertTriangle, GitBranch, Building2 } from "lucide-react";
import { useOwnerEntityListingCount } from "@/hooks/useOwnerEntityListingCount";
import { isFreeMailDomain } from "@/lib/assetOwnerKyc/orgKycValidation";

interface Props {
  orgName: string | null;
  officialEmail: string | null;
  emailDomain: string | null;
  linkedOwner: { id: string; name: string } | null;
  parentOwner: { id: string; name: string } | null;
}

/**
 * Khối nhận diện hồ sơ CHI NHÁNH ở màn duyệt KYC (Phase 13). Admin phải thấy ngay:
 * chi nhánh của ai, hồ sơ rút gọn (D3), Trạm sẽ nhận đúng bao nhiêu tài sản, và
 * email có phải hộp thư miễn phí không (gắn cờ, không chặn).
 */
export const OrgBranchReviewInfo = ({
  orgName, officialEmail, emailDomain, linkedOwner, parentOwner,
}: Props) => {
  const { data: listingCount } = useOwnerEntityListingCount(linkedOwner?.id);
  const freeMail = isFreeMailDomain(emailDomain || officialEmail);

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <GitBranch className="h-4 w-4 text-primary" strokeWidth={1.5} />
          Chi nhánh của «{parentOwner?.name ?? "—"}»
        </span>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
          Hồ sơ rút gọn
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        Chỉ bắt buộc email công vụ, giấy giao việc / uỷ quyền của Giám đốc chi nhánh và giấy tờ tuỳ
        thân của cán bộ. Không yêu cầu quyết định thành lập, selfie, MST chi nhánh.
      </p>

      <div className="flex items-start gap-2 text-sm">
        <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" strokeWidth={1.5} />
        {linkedOwner ? (
          <p className="text-foreground">
            Thực thể danh bạ: <strong>{linkedOwner.name}</strong>
            <span className="block text-xs text-muted-foreground">
              Duyệt xong, Trạm Điều Hành nhận{" "}
              {listingCount !== undefined ? <strong className="text-foreground">{listingCount}</strong> : "…"}{" "}
              tài sản đứng tên đúng chi nhánh này — không gồm trụ sở và chi nhánh khác.
            </span>
          </p>
        ) : (
          <p className="text-foreground">
            Chưa có trong danh bạ.
            <span className="block text-xs text-muted-foreground">
              Duyệt xong, hệ thống tạo «{orgName ?? "—"}» trong danh bạ dưới «{parentOwner?.name ?? "—"}»
              (quan hệ đã xác nhận). Trạm bắt đầu với 0 tài sản.
            </span>
          </p>
        )}
      </div>

      {freeMail && (
        <div className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-foreground">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" strokeWidth={1.5} />
          <span>
            Email công vụ dùng hộp thư miễn phí ({emailDomain || officialEmail}). Hãy đối chiếu kỹ giấy
            giao việc / uỷ quyền trước khi duyệt.
          </span>
        </div>
      )}
    </div>
  );
};
