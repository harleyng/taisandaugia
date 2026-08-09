import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Hero dùng chung cho hai trang chi tiết CRM: khách hàng tiềm năng và khách hàng.
 *
 * Vì sao phải tách ra: hai trang vốn là bản copy của nhau và đã bắt đầu phân kỳ
 * (mã ở trang này là badge, ở trang kia là chữ mono). Quan trọng hơn, cả hai
 * cùng mang một lỗi bố cục — xem BA LUẬT bên dưới. Sửa ở một chỗ thì trang còn
 * lại vẫn hỏng, nên bố cục phải sống ở đúng một nơi.
 *
 * Component sở hữu BỐ CỤC; trang truyền NỘI DUNG qua slot. Không nhồi prop dữ
 * liệu vì hai trang khác nhau thật (trang khách hàng có nút mã lead nguồn và
 * cổng quyền canEdit/canDelete; trang lead có hành động chuyển đổi) — ép chung
 * một prop-shape chỉ đẻ ra cờ điều kiện.
 *
 * ─── BA LUẬT BỐ CỤC, ĐỪNG SỬA NẾU CHƯA ĐỌC ──────────────────────────────────
 *
 * 1. Cột trái `flex-1 min-w-0`, cụm thống kê `shrink-0`.
 *    Tên tổ chức ở đây dài thật ("Công ty TNHH MTV Quản lý nợ và Khai thác tài
 *    sản Ngân hàng TMCP Công Thương Việt Nam"). Thiếu `min-w-0` thì cột trái
 *    không co được và đẩy vỡ hàng.
 *
 * 2. Neo phải bằng `ml-auto` / `justify-end`, TUYỆT ĐỐI KHÔNG `justify-between`.
 *    Đây là bug gốc: với `flex-wrap`, khi cụm bên phải rớt xuống dòng mới nó
 *    thành phần tử DUY NHẤT của dòng đó, và `justify-between` đặt phần tử đơn
 *    lẻ ở flex-start ⇒ trạng thái và nút trôi về giữa card. `ml-auto` đúng ở cả
 *    hai trường hợp (cùng dòng và đã wrap).
 *
 * 3. `h1` có `max-w-4xl`.
 *    Tiêu đề 80+ ký tự trải hết chiều ngang card trên màn rộng làm mắt mất điểm
 *    bám khi xuống dòng.
 */

export interface HeroStat {
  icon: LucideIcon;
  label: string;
  value: string | number;
}

interface CrmDetailHeroProps {
  /** Menu/badge trạng thái — đứng ĐẦU hàng badge. */
  status: ReactNode;
  /** Mã bản ghi; render thành badge "#<code>". Rỗng thì ẩn hẳn, không hiện "#—". */
  code?: string | null;
  /** Badge phụ đứng sau mã: nguồn, phân khúc, mã lead nguồn… */
  badges?: ReactNode;
  name: string;
  /** Dòng phân loại ngay dưới tên. */
  subtitle?: ReactNode;
  /** Ô thống kê góc trên-phải. Mảng rỗng ⇒ không render cụm nào. */
  stats?: HeroStat[];
  /** Nút hiện ngoài, ví dụ "Sửa". */
  actions?: ReactNode;
  /** <DropdownMenuItem> cho menu "…". Rỗng ⇒ ẩn luôn nút "…". */
  overflow?: ReactNode;
}

function StatCard({ icon: Icon, label, value }: HeroStat) {
  return (
    <div className="min-w-[5.5rem] rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-center">
      <Icon className="mx-auto h-4 w-4 text-muted-foreground" />
      <p className="mt-1 text-xl font-bold leading-none text-foreground tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function CrmDetailHero({
  status, code, badges, name, subtitle, stats = [], actions, overflow,
}: CrmDetailHeroProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-start gap-4">
        {/* Cột trái — LUẬT 1 */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {status}
            {badges}
          </div>

          {/* LUẬT 3 */}
          <h1 className="mt-3 max-w-4xl text-2xl font-bold text-foreground break-words">
            {name}
          </h1>

          {/* Mã bản ghi: chữ mono nhạt ngay dưới tên, KHÔNG phải badge. Badge
              dành cho thứ có trạng thái/phân loại; mã chỉ là định danh để đối
              chiếu, để badge sẽ tranh sự chú ý với trạng thái ở hàng trên. */}
          {code && (
            <p className="mt-0.5 font-mono text-sm text-muted-foreground">#{code}</p>
          )}

          {/* Hàng meta — mỗi trường bắt đầu bằng icon riêng. Icon vừa là dấu
              phân tách vừa nói trường đó là gì, nên không cần dấu câu ngăn giữa
              (bản trước phải dùng tới ba loại dấu │ - · trong cùng một dòng và
              không đọc ra được đâu là ranh giới trường). */}
          {subtitle && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {subtitle}
            </div>
          )}
        </div>

        {/* Cột phải — thống kê ở TRÊN, thao tác ở DƯỚI.
            `mt-auto` trên cụm nút đẩy nó xuống đáy cột, nên nó tự nằm ngang hàng
            với dòng cuối của cột trái (mã + hàng meta). Dùng `mt-auto` chứ KHÔNG
            `justify-between`: khi tổ chức không có số liệu thì cột chỉ còn một
            phần tử, và justify-between sẽ đẩy nút lên ĐẦU cột — cùng loại bẫy
            với LUẬT 2, chỉ khác trục. */}
        {(stats.length > 0 || actions || overflow) && (
          <div className="ml-auto flex shrink-0 flex-col items-end gap-4 self-stretch">
            {stats.length > 0 && (
              <div className="flex flex-wrap justify-end gap-2">
                {stats.map((s) => (
                  <StatCard key={s.label} {...s} />
                ))}
              </div>
            )}

            {(actions || overflow) && (
              <div className="mt-auto flex flex-wrap items-center justify-end gap-2">
                {actions}
                {overflow && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" size="icon" className="h-9 w-9">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">{overflow}</DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
