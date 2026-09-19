import type { PlanRules } from '../types'

export const storageMode = 'This device'

export async function saveSearch(input: {
  plan: PlanRules | null
  specialty: string
  zip: string
  radius: number
  remainingDeductible: number
}) {
  const record = {
    specialty: input.specialty,
    zip: input.zip,
    radius: input.radius,
    usedPlan: Boolean(input.plan),
    createdAt: new Date().toISOString(),
  }
  const previous = JSON.parse(localStorage.getItem('innet-searches') ?? '[]')
  localStorage.setItem('innet-searches', JSON.stringify([record, ...previous].slice(0, 10)))
}
