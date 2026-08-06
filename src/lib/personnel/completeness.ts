import type { Auctioneer } from '@/types/auctioneer'
import type { DossierCompleteness, DossierEvent, PersonnelDocument } from '@/types/personnel'
import { aggregateCpd, evaluateCpd, type CpdEvaluation, type CpdExemptInfo } from './cpd'
import type { CpdRuleResolver } from './cpd-catalog'

/**
 * Mức hoàn thiện hồ sơ, tính đều theo 4 mảng nội dung.
 * Mục đích là dẫn dắt người nhập, không phải chấm điểm năng lực — nên chỉ đòi
 * những trường thật sự cần cho một bộ hồ sơ nộp được.
 */
export function calcCompleteness(
  a: Auctioneer | undefined,
  docs: PersonnelDocument[],
  events: DossierEvent[],
): DossierCompleteness {
  const missing: string[] = []

  const identityFields: Array<[boolean, string]> = [
    [!!a?.idNumber, 'Số CCCD/hộ chiếu'],
    [!!a?.dateOfBirth, 'Ngày sinh'],
    [!!a?.gender, 'Giới tính'],
    [!!a?.hometown, 'Quê quán'],
    [!!a?.permanentAddress, 'Địa chỉ thường trú'],
    [!!a?.educationLevel, 'Trình độ học vấn'],
    [!!(a?.practiceStartDate ?? a?.licenseIssuedDate), 'Ngày bắt đầu hành nghề'],
  ]
  identityFields.forEach(([ok, label]) => { if (!ok) missing.push(label) })
  const identityDone = identityFields.every(([ok]) => ok)

  const hasDoc = (t: string) => docs.some((d) => d.docType === t && d.filePaths.length > 0)
  const documentsDone = hasDoc('DGV_CARD') && hasDoc('CCHN')
  if (!hasDoc('DGV_CARD')) missing.push('Ảnh thẻ đấu giá viên')
  if (!hasDoc('CCHN')) missing.push('Chứng chỉ hành nghề')

  // Cuộc đấu giá KHÔNG tính vào đây: chúng thuộc module Lịch sử đấu giá, không
  // phải việc người dùng khai ở hồ sơ. Chỉ đo phần hồ sơ thật sự phải nhập.
  const careerDone = events.some((e) => e.eventType === 'WORK')
  if (!careerDone) missing.push('Quá trình công tác')

  const trainingDone = events.some((e) => e.eventType === 'TRAINING')
  if (!trainingDone) missing.push('Bồi dưỡng nghiệp vụ')

  const done = [identityDone, documentsDone, careerDone, trainingDone].filter(Boolean).length

  return {
    ratio: done / 4,
    identityDone,
    documentsDone,
    careerDone,
    trainingDone,
    missing,
  }
}

/**
 * Đối chiếu nghĩa vụ bồi dưỡng của MỘT người trong MỘT năm.
 *
 * Quy tắc thật nằm ở `src/lib/personnel/cpd.ts` — đây chỉ là lớp mỏng thêm cờ
 * `ok` cho ba nơi đã tiêu thụ (TrainingSection, dossier-content,
 * export-dossier-pdf). Đủ giờ KHÔNG phải điều kiện duy nhất: hoạt động cho hoàn
 * thành cả năm (Điều 26.2) và diện miễn (Điều 26.3) đều dẫn tới đạt.
 *
 * `resolve` PHẢI được truyền từ danh mục — không có nó thì không biết bản ghi
 * nào tính giờ, nào cho đạt cả năm.
 */
export type TrainingCompliance = CpdEvaluation & { ok: boolean }

export function trainingCompliance(
  events: DossierEvent[],
  year = new Date().getFullYear(),
  resolve: CpdRuleResolver = () => undefined,
  exempt?: CpdExemptInfo,
  labelOf: (e: DossierEvent) => string = () => '',
): TrainingCompliance {
  const ev = evaluateCpd(aggregateCpd(events, year, resolve, exempt, labelOf), year)
  return { ...ev, ok: ev.status === 'DAT' || ev.status === 'MIEN' }
}

export { MIN_CPD_HOURS_PER_YEAR as MIN_TRAINING_HOURS_PER_YEAR } from './cpd'
