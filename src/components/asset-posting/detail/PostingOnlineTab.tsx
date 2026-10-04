import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ownerShareLinksHref } from "@/lib/ownerMarketing/routes";
import type { AssetPosting } from "@/types/asset-posting";
import { PostingShareCard } from "../share/PostingShareCard";

/**
 * Tab "Hồ sơ online" của hồ sơ số hoá: mọi link /hs/:code của hồ sơ — link gửi riêng lẫn link
 * do chiến dịch truyền thông tạo. Bấm một link ⇒ trang chi tiết (biểu đồ theo ngày).
 */
export function PostingOnlineTab({ posting }: { posting: AssetPosting }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-3">
      <PostingShareCard posting={posting} />
      {posting.workspace_id && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => navigate(ownerShareLinksHref(posting.id))}>
            Xem cùng các link khác của đơn vị
            <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        </div>
      )}
    </div>
  );
}
