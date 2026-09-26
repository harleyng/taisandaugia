import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * "Xem tất cả" / "Thu gọn" — mở rộng tại chỗ vì chưa có trang đích (Phase 8 có /chu-tai-san/ket-qua).
 * Không lặp số đếm: viên số cạnh tiêu đề thẻ đã nói tổng, và nhãn ngắn giữ tiêu đề không bị cắt trên mobile.
 */
export function ShowAllToggle({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2 text-xs text-muted-foreground"
      aria-expanded={expanded}
      onClick={onToggle}
    >
      {expanded ? "Thu gọn" : "Xem tất cả"}
    </Button>
  );
}

/** Khung chờ đúng dáng danh sách thẻ việc. */
export function PulseListSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-[62px] w-full rounded-xl" />
      ))}
    </div>
  );
}

/** Thay chỗ nút khi người xem không có quyền ghi. */
export function ReadOnlyNote({ children = "Chỉ xem" }: { children?: string }) {
  return <span className="text-xs text-muted-foreground">{children}</span>;
}
