import { Building2, Check, ChevronsUpDown, UserRound } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useOwnerWorkspace } from '@/hooks/useOwnerWorkspace'
import { useProfile } from '@/hooks/useProfile'
import { cn } from '@/lib/utils'
import { ownerWsAccessLabel } from '@/lib/ownerWorkspace/roles'
import { PERSONAL_TENANT } from '@/lib/ownerWorkspace/selection'

type TenantKind = 'org' | 'personal'

const KIND_LABEL: Record<TenantKind, string> = { org: 'Tổ chức', personal: 'Cá nhân' }

interface Props {
  /** Lớp cho khối bọc — nằm trong component để khi switcher tự ẩn thì khoảng
   *  đệm / đường kẻ ngăn cách ở sidebar cũng biến mất theo. */
  className?: string
}

/**
 * Chuyển tenant của cổng chủ tài sản — cùng kiểu với OrgSwitcher của cổng tổ chức.
 * Chỉ hiện khi có từ 2 tenant trở lên (vd. Trưởng đơn vị ở chi nhánh mình, Người
 * xem ở nơi khác, và hồ sơ Cá nhân). Mỗi tenant hiện TÊN THẬT kèm huy hiệu loại:
 * không gian ⇒ tên tổ chức + "Tổ chức" (kể cả nơi được mời); tenant Cá nhân ⇒ họ
 * tên KYC + "Cá nhân". Trạm chi nhánh đã liên kết hiện nhãn "Trụ sở · chỉ xem" và
 * xếp cuối. Không có mục "đăng ký mới": mỗi tài khoản chỉ có một hồ sơ KYC tổ chức
 * chủ tài sản.
 */
export function OwnerWorkspaceSwitcher({ className }: Props) {
  const { userId, memberships, hasPersonalTenant, personalName, tenantKey, workspace, isPersonal, selectWorkspace } =
    useOwnerWorkspace()
  const { data: profile } = useProfile(userId)

  if (memberships.length + (hasPersonalTenant ? 1 : 0) < 2) return null

  // Tenant Cá nhân có thể chỉ tồn tại vì còn hồ sơ cá nhân (chưa KYC) ⇒ lùi về tên hồ sơ.
  const personalLabel = personalName || profile?.name?.trim() || 'Tài khoản của bạn'
  const TriggerIcon = isPersonal ? UserRound : Building2

  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex w-full items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/60 px-2.5 py-1.5 text-sm transition-colors hover:bg-sidebar-accent">
            <TriggerIcon className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/70" />
            <span className="min-w-0 flex-1 truncate text-left font-medium text-sidebar-foreground">
              {isPersonal ? personalLabel : workspace?.primary_name ?? 'Chọn không gian'}
            </span>
            {(isPersonal || workspace) && (
              <span className="shrink-0 rounded-full bg-sidebar-foreground/10 px-1.5 py-px text-[10px] font-medium text-sidebar-foreground/80">
                {KIND_LABEL[isPersonal ? 'personal' : 'org']}
              </span>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[14rem]"
        >
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Không gian của bạn
          </DropdownMenuLabel>
          {memberships.map((m) => (
            <TenantItem
              key={m.workspaceId}
              kind="org"
              name={m.workspace.primary_name}
              subtitle={ownerWsAccessLabel(m.role, m.accessVia)}
              selected={m.workspaceId === tenantKey}
              onSelect={() => selectWorkspace(m.workspaceId)}
            />
          ))}
          {hasPersonalTenant && (
            <TenantItem
              kind="personal"
              name={personalLabel}
              subtitle="Tài sản của riêng bạn"
              selected={tenantKey === PERSONAL_TENANT}
              onSelect={() => selectWorkspace(PERSONAL_TENANT)}
            />
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function TenantItem({
  kind,
  name,
  subtitle,
  selected,
  onSelect,
}: {
  kind: TenantKind
  name: string
  subtitle: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <DropdownMenuItem onClick={onSelect} className="gap-2">
      <Check
        className={[
          'h-4 w-4 shrink-0',
          selected ? 'opacity-100 text-primary' : 'opacity-0',
        ].join(' ')}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="min-w-0 truncate text-sm">{name}</span>
          <span
            className={cn(
              'shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium',
              kind === 'org' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
            )}
          >
            {KIND_LABEL[kind]}
          </span>
        </span>
        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
    </DropdownMenuItem>
  )
}
