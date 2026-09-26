import { Scale } from "lucide-react";
import { PostingLegalConsultCard } from "@/components/legal-consult/PostingLegalConsultCard";
import { Group } from "../fields";

interface LegalConsultGroupProps {
  postingId: string | null;
  ensurePostingId: () => Promise<string | null>;
  /** Giấy tờ sở hữu + tài liệu bổ sung đã tải ở bước này. */
  docPaths: string[];
}

/**
 * Khối "Tư vấn pháp lý" cuối bước 3 — tuỳ chọn, không chặn "Tiếp tục" / "Hoàn tất"
 * (BR-CNS-01: kết quả chỉ tư vấn). Gửi yêu cầu tự lưu nháp như Giám định.
 */
export function LegalConsultGroup({ postingId, ensurePostingId, docPaths }: LegalConsultGroupProps) {
  return (
    <Group
      icon={<Scale className="h-4 w-4" />}
      title="Tư vấn pháp lý (tuỳ chọn)"
      desc="Chuyên gia rà soát giấy tờ và chỉ ra mục nào còn thiếu trước khi bạn đưa tài sản ra đấu giá"
    >
      <PostingLegalConsultCard
        postingId={postingId}
        mode="owner"
        resolvePostingId={ensurePostingId}
        postingDocPaths={docPaths}
      />
    </Group>
  );
}
