import { describe, expect, it } from 'vitest'
import { estimateCost, rankProviders } from './cost'
import { providers } from '../data/providers'
import type { PlanRules } from '../types'

const samplePlan: PlanRules = {
  planName: 'Test plan', networkName: 'Test PPO', deductible: 2500,
  outOfPocketMax: 7800, specialistCopay: 45, specialistCoinsurance: 20,
  referralRequired: false, citations: [],
}

describe('cost estimator', () => {
  it('uses the specialist copay and adds facility fees', () => {
    const estimate = estimateCost(providers[3], samplePlan, 900)
    expect(estimate.low).toBe(123)
    expect(estimate.high).toBe(157)
  })

  it('ranks lower-cost providers first', () => {
    const ranked = rankProviders(providers.filter((p) => p.specialty === 'Dermatology'), samplePlan, 900)
    expect(ranked[0].provider.id).toBe('desert-skin')
    expect(ranked.at(-1)?.provider.id).toBe('city-hospital')
  })
})
