/**
 * Chú giải của lưới 12 tháng — A9 yêu cầu LUÔN hiện, ngay trên lưới.
 *
 * Bốn dấu hiệu, chỉ dùng token có sẵn: viền `border-primary` = tháng của bản
 * mốc · nền `bg-primary/15` = tháng dự kiến mới · chấm `bg-success` = đã xong ·
 * viền `border-destructive` = trễ kế hoạch.
 */
export function PlanGridLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label="Chú giải lưới tiến độ">
      <li className="flex items-center gap-1.5">
        <span className="h-4 w-6 rounded border border-primary bg-card" aria-hidden="true" />
        Tháng theo bản mốc
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-4 w-6 rounded border border-primary/30 bg-primary/15" aria-hidden="true" />
        Dự kiến mới
      </li>
      <li className="flex items-center gap-1.5">
        <span className="flex h-4 w-6 items-center justify-center rounded border border-border bg-card" aria-hidden="true">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
        </span>
        Đã đấu thành
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-4 w-6 rounded border border-destructive bg-card" aria-hidden="true" />
        Trễ kế hoạch
      </li>
    </ul>
  );
}
