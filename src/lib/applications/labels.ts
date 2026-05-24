import { AssetCategory } from '@/types/application'

export const ASSET_CATEGORY_LABELS: Record<string, string> = {
  LAND_USE_RIGHT: 'Quyền sử dụng đất (QSDĐ)',
  ADMIN_VIOLATION: 'Tang vật vi phạm hành chính',
  ENFORCEMENT: 'Tài sản thi hành án',
  MACHINERY: 'Máy móc, thiết bị',
  VEHICLE: 'Phương tiện vận tải',
  OTHER: 'Loại tài sản khác',
}

export const ASSET_CATEGORY_OPTIONS: { value: AssetCategory; label: string }[] = [
  { value: 'LAND_USE_RIGHT', label: 'Quyền sử dụng đất (QSDĐ)' },
  { value: 'ADMIN_VIOLATION', label: 'Tang vật vi phạm hành chính' },
  { value: 'ENFORCEMENT', label: 'Tài sản thi hành án' },
  { value: 'MACHINERY', label: 'Máy móc, thiết bị' },
  { value: 'VEHICLE', label: 'Phương tiện vận tải' },
  { value: 'OTHER', label: 'Loại tài sản khác' },
]
