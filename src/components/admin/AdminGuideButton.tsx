import { useLocation } from 'react-router-dom'
import { GuideButton } from '@/components/help/GuideButton'
import { adminGuideUrl } from './admin-guide-links'

/** Nút "?" của cổng Admin — mở mục hướng dẫn của trang đang xem. */
export function AdminGuideButton() {
  const { pathname, search } = useLocation()
  return <GuideButton href={adminGuideUrl(pathname, search)} />
}
