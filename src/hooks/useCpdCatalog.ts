import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCatalog } from '@/lib/personnel/cpd-catalog-repo'
import { indexCatalog, makeCpdResolver } from '@/lib/personnel/cpd-catalog'
import { EMPTY_CPD_CATALOG } from '@/types/cpd-catalog'
import { qk } from '@/lib/queryKeys'

/**
 * Danh mục bồi dưỡng — đọc-nhiều-ghi-hiếm nên cache dài. Ba bảng nhỏ, nạp một
 * lượt rồi dùng lại cho form khai báo, bảng tuân thủ và hồ sơ kết xuất.
 *
 * `isLoading` phải được chỗ gọi tôn trọng: chấm tuân thủ khi danh mục chưa về
 * sẽ ra "chưa đủ giờ" cho tất cả mọi người rồi tự sửa lại sau một nhịp — nhấp
 * nháy một kết luận pháp lý sai là thứ không được phép hiện ra.
 */
export function useCpdCatalog() {
  const query = useQuery({
    queryKey: qk.cpdCatalog,
    queryFn: fetchCatalog,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })

  const catalog = query.data ?? EMPTY_CPD_CATALOG
  const index = useMemo(() => indexCatalog(catalog), [catalog])
  const resolve = useMemo(() => makeCpdResolver(catalog), [catalog])

  return {
    catalog,
    index,
    resolve,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
