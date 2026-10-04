import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChooseOrgAndRequest } from "@/components/asset-posting/ChooseOrgAndRequest";
import { postingToBriefInput, postingToMatchCriteria } from "@/components/asset-posting/wizardSchema";
import type { AssetPosting } from "@/types/asset-posting";

interface FindOrgsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  posting: AssetPosting;
  /** Tổ chức đã nhận hồ sơ — không gửi lại được (UNIQUE ở DB). */
  sentOrgIds: Set<string>;
  /** Số tổ chức đang giữ hồ sơ — áp trần MAX_RFQ_ORGS. */
  activeCount: number;
  /** Còn nhờ sàn được không (mỗi hồ sơ một yêu cầu chưa huỷ). */
  allowBroker: boolean;
}

/**
 * "Tìm tổ chức khác": toàn bộ danh sách xếp hạng + bản mô tả gửi tổ chức — cùng
 * khối với bước cuối wizard số hoá, chỉ mở trong hộp thoại.
 */
export function FindOrgsDialog({ open, onOpenChange, posting, sentOrgIds, activeCount, allowBroker }: FindOrgsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{sentOrgIds.size ? "Gửi thêm tổ chức đấu giá" : "Chọn tổ chức nhận hồ sơ"}</DialogTitle>
          <DialogDescription>Tổ chức được xếp theo chuyên môn, địa bàn, hình thức, kinh nghiệm và thù lao.</DialogDescription>
        </DialogHeader>
        {open && (
          <ChooseOrgAndRequest
            postingId={posting.id}
            criteria={postingToMatchCriteria(posting)}
            briefInput={postingToBriefInput(posting)}
            alreadySentIds={sentOrgIds}
            activeCount={activeCount}
            allowBroker={allowBroker}
            onSent={() => onOpenChange(false)}
            onSkip={() => onOpenChange(false)}
            skipLabel="Đóng"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
