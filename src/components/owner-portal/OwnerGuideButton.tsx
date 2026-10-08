import { useLocation } from 'react-router-dom'
import { GuideButton } from '@/components/help/GuideButton'
import { ownerGuideUrl } from './owner-guide-links'

/** Nút "?" của Trạm Điều Hành — mở mục hướng dẫn của trang đang xem. */
export function OwnerGuideButton() {
  const { pathname } = useLocation()
  return <GuideButton href={ownerGuideUrl(pathname)} />
}
