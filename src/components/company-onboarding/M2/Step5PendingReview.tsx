import { Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuctionCompany } from "@/lib/mockAuctionCompanies";

export type ReviewOutcome = "approved" | "rejected" | "needs_more_info";

interface Step5PendingReviewProps {
  company: AuctionCompany;
  onSimulateOutcome: (outcome: ReviewOutcome) => void;
}

export const Step5PendingReview = ({ company, onSimulateOutcome }: Step5PendingReviewProps) => {
  return (
    <div className="space-y-6">
      {/* Status display */}
      <div className="flex flex-col items-center text-center py-6 gap-4">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center">
            <Clock className="h-10 w-10 text-amber-500" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500" />
          </span>
        </div>

        <div>
          <h3 className="text-xl font-bold text-foreground">Đang chờ duyệt</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Hồ sơ của <span className="font-medium text-foreground">{company.name}</span> đã được gửi thành công và đang được đội ngũ kiểm duyệt của chúng tôi xem xét.
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-muted/40 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tiến trình</p>
        <div className="space-y-3">
          {[
            { label: "Hồ sơ đã nhận", done: true, time: "Vừa xong" },
            { label: "Kiểm tra tài liệu", done: false, time: "1–2 ngày làm việc" },
            { label: "Xác minh thông tin công ty", done: false, time: "1–2 ngày làm việc" },
            { label: "Phê duyệt tài khoản", done: false, time: "Sau khi xác minh" },
          ].map((item, i) => (
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

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
        Chúng tôi sẽ thông báo kết quả qua email sau khi hoàn tất kiểm duyệt. Thời gian xử lý thông thường là <strong>1–3 ngày làm việc</strong>.
      </div>

      {/* Demo controls */}
      <div className="border-2 border-dashed border-muted-foreground/20 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground text-center uppercase tracking-wide">
          Demo Controls (chỉ hiện trong prototype)
        </p>
        <p className="text-xs text-muted-foreground text-center">Chọn kết quả duyệt để xem giao diện tương ứng:</p>
        <div className="grid grid-cols-3 gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-green-300 text-green-700 hover:bg-green-50 text-xs flex-col h-auto py-2.5 gap-1"
            onClick={() => onSimulateOutcome("approved")}
          >
            <CheckCircle className="h-4 w-4" />
            Duyệt
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-50 text-xs flex-col h-auto py-2.5 gap-1"
            onClick={() => onSimulateOutcome("rejected")}
          >
            <XCircle className="h-4 w-4" />
            Từ chối
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-300 text-amber-700 hover:bg-amber-50 text-xs flex-col h-auto py-2.5 gap-1"
            onClick={() => onSimulateOutcome("needs_more_info")}
          >
            <AlertCircle className="h-4 w-4" />
            Cần thêm
          </Button>
        </div>
      </div>
    </div>
  );
};
