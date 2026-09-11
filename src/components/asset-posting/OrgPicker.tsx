import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Info, Loader2, Search, SearchX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_RFQ_ORGS } from "@/constants/asset-posting-rules";
import { usePager } from "@/hooks/usePager";
import type { MatchCriteria, OrgMatchResult } from "@/lib/orgMatching";
import { stripViDiacritics } from "@/lib/normalizeVi";
import { OrgMatchCard } from "./OrgMatchCard";

const PAGE_SIZE = 6;

interface OrgPickerProps {
  results: OrgMatchResult[];
  /** Tiêu chí đã chấm điểm — thẻ tổ chức cần để giải thích độ phù hợp. */
  criteria: MatchCriteria;
  isLoading: boolean;
  /** Các tổ chức đang được chọn để gửi yêu cầu báo giá. */
  selectedIds: string[];
  /** Bấm một thẻ = thêm/bỏ tổ chức đó khỏi danh sách gửi. */
  onToggle: (orgId: string) => void;
  /** Trần số tổ chức chọn được (mặc định MAX_RFQ_ORGS). */
  max?: number;
  /** Tổ chức ĐÃ nhận yêu cầu cho hồ sơ này — hiện mờ, không chọn lại được. */
  sentIds?: Set<string>;
  /** Gợi ý khi không có tổ chức nào — nút chuyển sang "Nhờ sàn chọn giúp". */
  onSwitchToPlatform?: () => void;
}

/** Bỏ dấu + thường hoá để tìm "cong ty dau gia" ra "Công ty Đấu giá". */
const norm = stripViDiacritics;

/**
 * Chọn tổ chức đấu giá — DÙNG CHUNG cho wizard (bước 4) và trang chi tiết hồ sơ.
 *
 * Đây là danh sách CHỌN NHIỀU: chủ tài sản gửi cùng một hồ sơ tới tối đa
 * MAX_RFQ_ORGS tổ chức rồi so sánh báo giá nhận về — cùng cơ chế fan-out mà sàn
 * dùng ở DispatchOrgsDialog, chỉ khác là chủ tài sản tự bấm.
 *
 * Ba luật quan trọng:
 *  1. Tổ chức ĐÃ CHỌN không được biến mất khỏi tầm mắt. Tiêu chí chấm điểm (hình
 *     thức, giá, thù lao) nằm cùng bước, sửa xong là thứ hạng đổi và tổ chức đã
 *     chọn rơi sang trang khác. Bản chọn-một trước đây xử lý bằng cách NHẢY TRANG
 *     theo tổ chức đang chọn; chọn nhiều thì không còn "một trang" nào nhảy tới
 *     được (5 tổ chức có thể nằm ở 5 trang), nên thay bằng hàng chip cố định bên
 *     trên — luôn thấy mình đang gửi cho ai, bỏ chọn được ngay tại đó.
 *  2. Danh sách phân trang PAGE_SIZE thẻ/trang, kèm ô tìm theo tên để người đã
 *     biết mình muốn ký gửi ở đâu không phải phụ thuộc vào thứ hạng gợi ý.
 *  3. Đủ trần thì các thẻ CHƯA chọn khoá lại (không im lặng bỏ qua cú bấm) — bỏ
 *     một tổ chức ra là chọn được tiếp.
 */
export function OrgPicker({
  results,
  criteria,
  isLoading,
  selectedIds,
  onToggle,
  max = MAX_RFQ_ORGS,
  sentIds,
  onSwitchToPlatform,
}: OrgPickerProps) {
  const [q, setQ] = useState("");

  const searching = q.trim().length > 0;

  const filtered = useMemo(() => {
    if (!searching) return results;
    const nq = norm(q);
    return results.filter((r) => norm(r.org.name).includes(nq) || norm(r.org.province ?? "").includes(nq));
  }, [results, q, searching]);

  const { paged, pager } = usePager(filtered, PAGE_SIZE);
  const { setPage } = pager;

  // Đổi từ khoá tìm kiếm: kết quả khác hẳn, luôn về trang đầu.
  useEffect(() => {
    setPage(1);
  }, [q, setPage]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  // Chip dựng từ `results` (toàn bộ) chứ không phải `filtered`: đang tìm kiếm
  // hay đang ở trang khác vẫn phải thấy đủ tổ chức mình đã chọn.
  const selectedResults = useMemo(
    () => selectedIds.map((id) => results.find((r) => r.org.id === id)).filter((r): r is OrgMatchResult => !!r),
    [selectedIds, results],
  );
  const atMax = selectedIds.length >= max;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <SearchX className="h-8 w-8 text-muted-foreground" />
        <p className="max-w-xs text-sm text-muted-foreground">
          Chưa có tổ chức nào trên sàn khớp tiêu chí này.
        </p>
        {onSwitchToPlatform && (
          <button
            type="button"
            onClick={onSwitchToPlatform}
            className="rounded-[10px] bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Nhờ sàn chọn giúp
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Hàng chip: ai đang nhận yêu cầu + còn chọn được mấy chỗ (luật 1 & 3). */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 p-2.5">
        <span className="text-[13px] font-semibold text-foreground">
          Đã chọn {selectedIds.length}/{max} tổ chức
        </span>
        {selectedResults.length === 0 ? (
          <span className="text-[13px] text-muted-foreground">
            — chọn các tổ chức bạn muốn nhận báo giá từ danh sách dưới.
          </span>
        ) : (
          selectedResults.map((r) => (
            <span
              key={r.org.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 py-1 pl-2.5 pr-1 text-xs font-medium text-foreground"
            >
              <span className="max-w-[220px] truncate">{r.org.name}</span>
              <button
                type="button"
                onClick={() => onToggle(r.org.id)}
                aria-label={`Bỏ chọn ${r.org.name}`}
                className="grid h-5 w-5 place-items-center rounded-full text-muted-foreground transition hover:bg-primary/10 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))
        )}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Tìm trong ${results.length} tổ chức theo tên hoặc tỉnh/thành...`}
          className="pl-9"
          aria-label="Tìm tổ chức đấu giá"
        />
      </div>

      {paged.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Không có tổ chức nào khớp “{q.trim()}”.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {paged.map((r) => {
              const selected = selectedSet.has(r.org.id);
              const sent = !!sentIds?.has(r.org.id);
              return (
                <OrgMatchCard
                  key={r.org.id}
                  result={r}
                  criteria={criteria}
                  selected={selected}
                  sent={sent}
                  disabled={sent || (atMax && !selected)}
                  onToggle={() => onToggle(r.org.id)}
                />
              );
            })}
          </div>

          {atMax && (
            <p className="text-xs text-muted-foreground">
              Đã đủ {max} tổ chức. Bỏ một tổ chức ở trên nếu muốn đổi sang tổ chức khác.
            </p>
          )}

          {pager.pageCount > 1 && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">{pager.total} tổ chức</p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={pager.page <= 1}
                  onClick={() => setPage(pager.page - 1)}
                  aria-label="Trang trước"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  Trang {pager.page}/{pager.pageCount}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={pager.page >= pager.pageCount}
                  onClick={() => setPage(pager.page + 1)}
                  aria-label="Trang sau"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Số liệu năng lực hiện do sàn tổng hợp (deriveOrgAttributes), chưa phải số
          liệu do tổ chức công bố — nói rõ để người dùng không hiểu là cam kết. */}
      <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <Info className="mt-px h-3 w-3 shrink-0" />
        <span>
          Số liệu kinh nghiệm, uy tín và thù lao do sàn tổng hợp, mang tính tham khảo. Mức thù lao và điều kiện
          cuối cùng do bạn và tổ chức thỏa thuận.
          <a
            href="/cach-cham-diem-to-chuc"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 whitespace-nowrap font-medium text-primary underline underline-offset-2 hover:text-primary-hover"
          >
            Cách sàn chấm điểm phù hợp ↗
          </a>
        </span>
      </p>
    </div>
  );
}
