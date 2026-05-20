import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertCircle, ArrowRight, FileEdit } from "lucide-react";
import { ReviewOutcome } from "./Step5PendingReview";

interface Step6ReviewResultProps {
  outcome: ReviewOutcome;
  onApprovedContinue: () => void;
  onRejectedResubmit: () => void;
  onNeedsMoreInfoResubmit: () => void;
}

export const Step6ReviewResult = ({
  outcome,
  onApprovedContinue,
  onRejectedResubmit,
  onNeedsMoreInfoResubmit,
}: Step6ReviewResultProps) => {
  if (outcome === "approved") {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center text-center py-6 gap-4">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-green-700">KYC được phê duyệt!</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Hồ sơ của bạn đã được xác minh thành công. Tiếp tục bước cuối để kích hoạt tài khoản công ty.
            </p>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
          {[
            "Thông tin công ty đã được xác minh",
            "Giấy tờ pháp lý hợp lệ",
            "Định danh người đại diện đã xác nhận",
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
              {item}
            </div>
          ))}
        </div>

        <Button className="w-full" onClick={onApprovedContinue}>
          Tiếp tục — Nạp tiền kích hoạt
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (outcome === "rejected") {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center text-center py-6 gap-4">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
            <XCircle className="h-10 w-10 text-red-500" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-red-700">Hồ sơ bị từ chối</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Hồ sơ của bạn chưa đáp ứng yêu cầu xác minh. Vui lòng xem lý do và nộp lại.
            </p>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-red-800">Lý do từ chối:</p>
          <ul className="space-y-2">
            {[
              "Giấy phép hoạt động đấu giá đã hết hiệu lực — vui lòng cung cấp bản cập nhật.",
              "Ảnh mặt sau CCCD bị mờ, không thể đọc được số giấy tờ.",
            ].map((reason, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                {reason}
              </li>
            ))}
          </ul>
        </div>

        <Button className="w-full" variant="outline" onClick={onRejectedResubmit}>
          <FileEdit className="mr-2 h-4 w-4" />
          Sửa và nộp lại hồ sơ
        </Button>
      </div>
    );
  }

  // needs_more_info
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center py-6 gap-4">
        <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center">
          <AlertCircle className="h-10 w-10 text-amber-500" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-amber-700">Cần bổ sung thông tin</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Hồ sơ của bạn cần được bổ sung thêm tài liệu trước khi có thể phê duyệt.
          </p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-amber-800">Yêu cầu bổ sung:</p>
        <ul className="space-y-2">
          {[
            "Cần thêm Quyết định bổ nhiệm Giám đốc (bản sao công chứng).",
            "Ảnh selfie kèm giấy tờ chưa đủ rõ — vui lòng chụp lại trong điều kiện ánh sáng tốt hơn.",
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <Button className="w-full" onClick={onNeedsMoreInfoResubmit}>
        <FileEdit className="mr-2 h-4 w-4" />
        Bổ sung hồ sơ
      </Button>
    </div>
  );
};
