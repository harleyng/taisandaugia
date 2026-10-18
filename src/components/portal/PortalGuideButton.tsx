import { useLocation } from 'react-router-dom'
import { GuideButton } from '@/components/help/GuideButton'
import { portalGuideUrl } from './portal-guide-links'

/** Nút "?" của Cổng tổ chức — mở mục hướng dẫn của trang đang xem. */
export function PortalGuideButton() {
  const { pathname } = useLocation()
  return <GuideButton href={portalGuideUrl(pathname)} />
}
