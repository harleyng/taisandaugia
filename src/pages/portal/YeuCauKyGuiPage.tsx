import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, ShieldAlert } from 'lucide-react'
import { SelectItem } from '@/components/ui/select'
import { ASSET_CATEGORIES } from '@/constants/category.constants'
import { stripViDiacritics } from '@/lib/normalizeVi'
import { useOrgServiceRequests } from '@/hooks/useOrgServiceRequests'
import { OwnerTabBar } from '@/components/asset-owner-portal/ui/OwnerTabs'
import { OwnerSearchInput } from '@/components/asset-owner-portal/ui/OwnerSearchInput'
import { OwnerFilterSelect } from '@/components/asset-owner-portal/ui/OwnerFilterSelect'
import { ConsignmentCanvas } from '@/components/portal/consignment/ConsignmentCanvas'
import { RequestsTable } from '@/components/portal/consignment/list/RequestsTable'
import {
  REQUEST_TABS, compareRequests, matchesQuery, type RequestTab,
} from '@/components/portal/consignment/list/requestRows'
import type { OrgServiceRequest } from '@/types/consignment'

const STORAGE_KEY = 'ycg-list-v2'

interface ListState {
  tab: RequestTab
  cat: string
  q: string
}

const DEFAULT_STATE: ListState = { tab: 'tat-ca', cat: 'all', q: '' }

/** Tab/lọc/từ khoá nhớ theo trình duyệt — chỉ là tiện ích, đọc hỏng thì về mặc định. */
function loadState(): ListState {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<ListState>
    const tab = REQUEST_TABS.some((t) => t.key === saved.tab) ? saved.tab! : DEFAULT_STATE.tab
    return { tab, cat: saved.cat || 'all', q: typeof saved.q === 'string' ? saved.q : '' }
  } catch {
    return DEFAULT_STATE
  }
}

/** Hộp thư yêu cầu ký gửi tài sản gửi tới tổ chức đấu giá (design "Yeu Cau Ky Gui - Cong To Chuc v2"). */
export default function YeuCauKyGuiPage() {
  const navigate = useNavigate()
  const { requests, isLoading, hasOrg } = useOrgServiceRequests()

  const [state, setState] = useState<ListState>(loadState)

  const update = (patch: Partial<ListState>) =>
    setState((prev) => {
      const next = { ...prev, ...patch }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Bộ nhớ trình duyệt bị chặn — vẫn lọc được trong phiên này.
      }
      return next
    })

  const tabItems = useMemo(
    () =>
      REQUEST_TABS.map((t) => ({
        value: t.key,
        label: t.label,
        count: requests.filter(t.match).length,
        attention: t.key === 'can-xu-ly',
      })),
    [requests],
  )

  const folded = stripViDiacritics(state.q)
  const rows = useMemo(() => {
    const match = (REQUEST_TABS.find((t) => t.key === state.tab) ?? REQUEST_TABS[0]).match
    return requests
      .filter(match)
      .filter((r) => state.cat === 'all' || r.parent_slug === state.cat)
      .filter((r) => matchesQuery(r, folded))
      .sort(compareRequests)
  }, [requests, state.tab, state.cat, folded])

  // Trang chi tiết tự đánh dấu 'đã xem' khi mở.
  const openRequest = (r: OrgServiceRequest) => navigate(`/portal/yeu-cau-ky-gui/${r.id}`)

  if (isLoading) {
    return (
      <ConsignmentCanvas>
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-card p-10 text-sm text-muted-foreground shadow-card">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải yêu cầu ký gửi…
        </div>
      </ConsignmentCanvas>
    )
  }

  if (!hasOrg) {
    return (
      <ConsignmentCanvas>
        <div className="space-y-3 rounded-2xl bg-card p-10 text-center shadow-card">
          <ShieldAlert className="mx-auto h-9 w-9 text-muted-foreground" />
          <div>
            <p className="font-semibold text-foreground">Chưa liên kết tổ chức đấu giá</p>
            <p className="text-sm text-muted-foreground">
              Tài khoản của bạn chưa gắn với tổ chức nào trong danh bạ, nên chưa nhận được yêu cầu ký gửi.
            </p>
          </div>
        </div>
      </ConsignmentCanvas>
    )
  }

  return (
    <ConsignmentCanvas>
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-foreground">Yêu cầu ký gửi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Nhận tài sản từ chủ sở hữu, gửi báo giá và ký hợp đồng ký gửi.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3">
          <OwnerTabBar
            aria-label="Lọc yêu cầu ký gửi"
            value={state.tab}
            onValueChange={(tab) => update({ tab })}
            items={tabItems}
          />
          <div className="flex flex-wrap gap-2">
            <OwnerFilterSelect
              label="Loại tài sản"
              value={state.cat}
              onValueChange={(cat) => update({ cat })}
              className="sm:w-[13rem]"
            >
              <SelectItem value="all">Tất cả</SelectItem>
              {ASSET_CATEGORIES.map((c) => (
                <SelectItem key={c.slug} value={c.slug}>
                  {c.name}
                </SelectItem>
              ))}
            </OwnerFilterSelect>
            <OwnerSearchInput
              aria-label="Tìm yêu cầu"
              placeholder="Tìm theo tên, mã hồ sơ, khu vực"
              value={state.q}
              onValueChange={(q) => update({ q })}
              className="sm:w-auto sm:max-w-[22rem] sm:flex-[1_1_16rem]"
            />
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl bg-card shadow-card">
          {rows.length > 0 ? (
            <RequestsTable rows={rows} onOpen={openRequest} />
          ) : (
            <div className="p-10 text-center text-sm text-muted-foreground">
              <b className="mb-1 block text-[15px] font-semibold text-foreground">
                {state.tab === 'can-xu-ly' && !folded ? 'Không có yêu cầu nào chờ bạn' : 'Không có yêu cầu nào khớp'}
              </b>
              {folded && <span>Thử từ khoá khác.</span>}
            </div>
          )}
        </section>
      </div>
    </ConsignmentCanvas>
  )
}
