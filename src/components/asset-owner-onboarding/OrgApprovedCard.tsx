import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Plus } from "lucide-react";
import type { AssetOwnerWorkspace } from "@/types/asset-owner";

interface Props {
  /** Không gian sinh ra từ CHÍNH hồ sơ này (không phải không gian đang chọn). */
  workspace: AssetOwnerWorkspace | null;
  loading: boolean;
  /** Chọn Trạm của hồ sơ này trước khi vào cổng (tài khoản có thể có nhiều Trạm). */
  onEnter?: () => void;
  /** Khai thêm một tổ chức khác (một tài khoản KYC được nhiều tổ chức). */
  onAddOrg?: () => void;
}

/**
 * Hồ sơ tổ chức đã duyệt. Việc khớp tài sản đã chạy phía server khi duyệt
 * (trigger create_workspace_on_org_approval) nên không còn bước claim tay ở đây.
 * Không gian chi nhánh (match_scope = 'entity') chỉ nhận tài sản đứng tên đúng
 * chi nhánh — không có alias để chỉnh.
 */
export const OrgApprovedCard = ({ workspace, loading, onEnter, onAddOrg }: Props) => {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isBranch = workspace?.match_scope === "entity";
  const claimed = workspace?.total_claimed ?? 0;

  return (
    <div className="rounded-2xl bg-success/10 border border-success/25 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-success" />
        <h3 className="font-semibold text-foreground">
          {isBranch ? "Trạm Điều Hành của chi nhánh đã sẵn sàng" : "Tổ chức đã được xác thực"}
        </h3>
      </div>

      {isBranch ? (
        <>
          <p className="text-sm text-muted-foreground">
            Đã gán <strong className="text-foreground">{claimed} tài sản</strong> đứng tên{" "}
            <strong className="text-foreground">«{workspace?.primary_name}»</strong> vào Trạm Điều Hành.
          </p>
          <p className="text-xs text-muted-foreground">
            Tài sản của trụ sở và các chi nhánh khác không tự động gán vào Trạm của chi nhánh. Tài sản
            mới đứng tên chi nhánh sẽ được gán khi bạn bấm "Khớp lại" ở mục Chi nhánh.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Hệ thống đã tự nhận diện và gán{" "}
            <strong className="text-foreground">{claimed} tài sản</strong>{" "}
            vào danh mục của bạn dựa trên tên và các alias đã khai. Bạn không cần làm thêm bước nào.
          </p>
          <p className="text-xs text-muted-foreground">
            Muốn bổ sung alias hoặc đơn vị thành viên để tìm thêm tài sản? Vào mục{" "}
            <strong>Chi nhánh</strong> trong cổng Chủ tài sản.
          </p>
        </>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button onClick={() => { onEnter?.(); navigate("/chu-tai-san/dashboard"); }}>
          {isBranch ? "Vào Trạm Điều Hành" : "Vào cổng Chủ tài sản"}
        </Button>
        {!isBranch && (
          <Button variant="outline" onClick={() => { onEnter?.(); navigate("/chu-tai-san/chi-nhanh-amc"); }}>
            Quản lý alias &amp; chi nhánh
          </Button>
        )}
        {onAddOrg && (
          <Button variant="ghost" onClick={onAddOrg}>
            <Plus className="h-4 w-4" />
            Đăng ký thêm tổ chức
          </Button>
        )}
      </div>
    </div>
  );
};
