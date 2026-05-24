import { differenceInYears, differenceInMonths, parseISO, isValid } from 'date-fns'
import type { OrgGeneralInfo } from '@/types/general-info'

export interface YearsOfOperation {
  years: number
  months: number
  displayText: string
}

export function calcYearsOfOperation(foundedDate: string): YearsOfOperation {
  try {
    const founded = parseISO(foundedDate)
    if (!isValid(founded)) return { years: 0, months: 0, displayText: 'Chưa xác định' }
    const now = new Date()
    const years = differenceInYears(now, founded)
    const months = differenceInMonths(now, founded) % 12
    return {
      years,
      months,
      displayText: months > 0 ? `${years} năm ${months} tháng` : `${years} năm`,
    }
  } catch {
    return { years: 0, months: 0, displayText: 'Chưa xác định' }
  }
}

export function calcMucIV5(years: number): number {
  if (years >= 15) return 4
  if (years >= 10) return 3
  if (years >= 5) return 2
  if (years >= 1) return 1
  return 0
}

export function mucIV5NextThreshold(years: number): string | null {
  if (years >= 15) return null
  if (years >= 10) return `Còn ${15 - years} năm để đạt mức tối đa (4đ)`
  if (years >= 5) return `Còn ${10 - years} năm để lên mức 3đ`
  if (years >= 1) return `Còn ${5 - years} năm để lên mức 2đ`
  return `Cần ít nhất 1 năm hoạt động để được tính điểm`
}

export function calcCompletionPercentage(info: OrgGeneralInfo): number {
  const required = [
    info.name,
    info.orgType,
    info.taxCode,
    info.address,
    info.province,
    info.phone,
    info.email,
    info.legalRepName,
    info.foundedDate,
  ]
  const optional = [
    info.shortName,
    info.registrationCode,
    info.logoUrl,
    info.ward,
    info.district,
    info.alternativePhone,
    info.fax,
    info.alternativeEmail,
    info.website,
    info.legalRepPosition,
    info.legalRepIdNumber,
    info.establishmentDecisionNumber,
    info.businessLicenseNumber,
  ]

  const reqFilled = required.filter(Boolean).length
  const optFilled = optional.filter(Boolean).length

  // Required fields count for 70%, optional for 30%
  const reqScore = (reqFilled / required.length) * 70
  const optScore = (optFilled / optional.length) * 30
  return Math.round(reqScore + optScore)
}
