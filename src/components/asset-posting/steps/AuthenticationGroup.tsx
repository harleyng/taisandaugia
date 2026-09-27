import { BadgeCheck } from "lucide-react";
import { PostingAuthenticationCard } from "@/components/authentication/PostingAuthenticationCard";
import type { AuthenticationRequiredReason } from "@/types/authentication";
import { Group, Pill } from "../fields";

interface AuthenticationGroupProps {
  postingId: string | null;
  ensurePostingId: () => Promise<string | null>;
  reasons: AuthenticationRequiredReason[];
  lotReason: string | null;
  isAntique: boolean;
}

/**
 * Khối "Giám định" ở bước 4 — mọi nhóm tài sản đều đặt được; luật bắt buộc / nghi giả
 * chỉ cắn ở nhóm Cổ vật (hoặc khi sàn đánh dấu). Đặt đơn tự lưu nháp như 3D / VR tour.
 */
export function AuthenticationGroup({ postingId, ensurePostingId, reasons, lotReason, isAntique }: AuthenticationGroupProps) {
  const required = reasons.length > 0;
  return (
    <Group
      icon={<BadgeCheck className="h-4 w-4" />}
      title="Giám định"
      desc={
        isAntique
          ? "Cổ vật có chứng thư của đơn vị giám định độc lập được gắn huy hiệu “Đã giám định” và người mua trả giá cao hơn"
          : "Chứng thư giám định độc lập giúp tăng mức xác minh của lô"
      }
      right={required ? <Pill tone="req">Bắt buộc</Pill> : null}
    >
      <PostingAuthenticationCard
        postingId={postingId}
        mode="owner"
        resolvePostingId={ensurePostingId}
        requiredReasons={reasons}
        lotReason={lotReason}
      />
      {required && (
        <p className="mt-3 text-xs text-muted-foreground">
          Giám định cần vài ngày làm việc. Bạn có thể “Lưu nháp” và nộp hồ sơ khi đã có chứng thư.
        </p>
      )}
    </Group>
  );
}
