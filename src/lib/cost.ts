import type { CostEstimate, PlanRules, Provider } from '../types'

export function estimateCost(
  provider: Provider,
  plan: PlanRules,
  remainingDeductible: number,
): CostEstimate {
  if (provider.networkStatus === 'out-of-network') {
    return {
      provider, low: provider.negotiatedRate, high: Math.round(provider.negotiatedRate * 1.8),
      explanation: 'Out-of-network pricing is not protected by the plan’s negotiated rate.', confidence: 'low',
    }
  }

  let expected: number
  let explanation: string
  if (plan.specialistCopay !== null && plan.specialistCopay > 0) {
    expected = plan.specialistCopay + provider.facilityFee
    explanation = `$${plan.specialistCopay} specialist copay${provider.facilityFee ? ` + possible $${provider.facilityFee} facility fee` : ''}.`
  } else {
    const deductiblePortion = Math.min(remainingDeductible, provider.negotiatedRate)
    const afterDeductible = Math.max(0, provider.negotiatedRate - deductiblePortion)
    expected = deductiblePortion + afterDeductible * (plan.specialistCoinsurance / 100) + provider.facilityFee
    explanation = `$${deductiblePortion} toward your remaining deductible + ${plan.specialistCoinsurance}% coinsurance${provider.facilityFee ? ` + possible $${provider.facilityFee} facility fee` : ''}.`
  }

  const uncertainty = provider.networkStatus === 'confirmed' ? 0.12 : 0.25
  return {
    provider,
    low: Math.max(0, Math.round(expected * (1 - uncertainty))),
    high: Math.round(expected * (1 + uncertainty)),
    explanation,
    confidence: provider.networkStatus === 'confirmed' ? 'high' : 'medium',
  }
}

export function rankProviders(
  list: Provider[],
  plan: PlanRules,
  remainingDeductible: number,
): CostEstimate[] {
  return list
    .map((provider) => estimateCost(provider, plan, remainingDeductible))
    .sort((a, b) => a.low - b.low || a.provider.distance - b.provider.distance)
}
