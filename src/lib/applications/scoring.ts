import { AuctionPlan, SectionVCriterion } from '@/types/application'

export function calcMucIII(plan: AuctionPlan): number {
  const score3_1 = plan.format.length >= 100 ? 8 : (plan.format.length / 100) * 8
  const score3_2 = plan.receptionPlan.length >= 50 ? 2 : (plan.receptionPlan.length / 50) * 2
  const score3_3 = plan.participantConditions.length >= 50 ? 3 : (plan.participantConditions.length / 50) * 3
  const score3_4 = plan.antiCollusionMeasures.length >= 100 ? 3 : (plan.antiCollusionMeasures.length / 100) * 3
  return Math.round(score3_1 + score3_2 + score3_3 + score3_4)
}

export function calcMucV(criteria: SectionVCriterion[]): number {
  return criteria.filter((c) => c.meets === true).reduce((sum, c) => sum + c.maxPoints, 0)
}

export function calcTotal(capScore: number, mucIII: number, mucV: number): number {
  return capScore + mucIII + mucV
}

// Score breakdown for display (capped per section for progress bar)
export function scoreBreakdown(capScore: number, mucIII: number, mucV: number) {
  return {
    capacity: { score: capScore, max: 76 },
    mucIII: { score: mucIII, max: 16 },
    mucV: { score: mucV, max: 8 },
    total: calcTotal(capScore, mucIII, mucV),
  }
}
