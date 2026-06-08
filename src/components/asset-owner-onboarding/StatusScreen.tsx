import { Clock, CheckCircle2, XCircle, RefreshCw, ArrowRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import type { AssetOwnerKYCStatus, AssetOwnerOrgKYCStatus } from "@/types/asset-owner";

type Status = AssetOwnerKYCStatus | AssetOwnerOrgKYCStatus;

interface Props {
  status: Status;
  rejectionReason?: string | null;
  onResubmit?: () => void;
  isOrg?: boolean;
  submittedAt?: string | null;
  orgName?: string | null;
  hideBackButton?: boolean;
}

const TIMELINE_IND = [
  { label: "Hồ sơ đã nhận", done: true, time: "Vừa xong" },
  { label: "Kiểm tra giấy tờ eKYC", done: false, time: "1–2 ngày làm việc" },
  { label: "Xác minh danh tính", done: false, time: "1–2 ngày làm việc" },
  { label: "Kích hoạt vai trò Chủ tài sản", done: false, time: "Sau khi xác minh" },
];

const TIMELINE_ORG = [
  { label: "Hồ sơ tổ chức đã nhận", done: true, time: "Vừa xong" },
  { label: "Kiểm tra tài liệu pháp lý", done: false, time: "1–2 ngày làm việc" },
  { label: "Xác minh thông tin tổ chức", done: false, time: "1–2 ngày làm việc" },
  { label: "Phê duyệt & tạo workspace", done: false, time: "Sau khi xác minh" },
];

export const StatusScreen = ({ status, rejectionReason, onResubmit, isOrg, submittedAt, orgName, hideBackButton }: Props) => {
  const navigate = useNavigate();
  const timeline = isOrg ? TIMELINE_ORG : TIMELINE_IND;

  if (status === "pending_review" || status === "under_review") {
    const isUnderReview = status === "under_review";
    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col items-center text-center py-6 gap-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center">
              <Clock className="h-10 w-10 text-amber-500" />
            </div>
            {!isUnderReview && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500" />
              </span>
            )}
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">
              {isUnderReview ? "Đang xét duyệt" : "Đang chờ duyệt"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {isOrg
                ? <>Hồ sơ của <span className="font-medium text-foreground">{orgName ?? "tổ chức"}</span> đã được gửi thành công và đang được đội ngũ kiểm duyệt xem xét.</>
                : "Hồ sơ cá nhân của bạn đã được gửi thành công và đang chờ xét duyệt."}
            </p>
            {submittedAt && (
              <p className="text-xs text-muted-foreground mt-1">
                Nộp lúc {new Date(submittedAt).toLocaleString("vi-VN")}
              </p>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-muted/40 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tiến trình</p>
          <div className="space-y-3">
            {timeline.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.done ? "bg-green-500" : "bg-border"}`} />
                <p className={`text-sm flex-1 ${item.done ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  {item.label}
                </p>
                <span className="text-xs text-muted-foreground">{item.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Email notice */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
          <Mail className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800">
            Chúng tôi sẽ thông báo kết quả qua email sau khi hoàn tất kiểm duyệt. Thời gian xử lý thông thường là <strong>1–3 ngày làm việc</strong>.
          </p>
        </div>

        {!hideBackButton && (
          <Button variant="outline" className="w-full" onClick={() => navigate("/profile?tab=my-assets")}>
            Về trang tài sản của tôi
          </Button>
        )}
      </div>
    );
  }

  if (status === "approved") {
    return (
      <div className="text-center py-10 space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-50 border-2 border-green-200">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground text-lg">Xác thực thành công!</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {isOrg
              ? "Workspace của tổ chức đã được tạo. Bắt đầu claim tài sản."
              : "Vai trò Chủ tài sản đã được kích hoạt."}
          </p>
        </div>
        <Button onClick={() => navigate("/profile?tab=my-assets")} className="gap-1.5">
          Xem tài sản của tôi
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <div className="text-center py-10 space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 border-2 border-red-200">
          <XCircle className="h-8 w-8 text-red-500" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground text-lg">Hồ sơ bị từ chối</h3>
          {rejectionReason && (
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">{rejectionReason}</p>
          )}
        </div>
        {onResubmit && (
          <Button onClick={onResubmit} variant="outline" size="sm" className="gap-1.5">
            <RefreshCw className="h-4 w-4" />
            Nộp lại hồ sơ
          </Button>
        )}
      </div>
    );
  }

  return null;
};
