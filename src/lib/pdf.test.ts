import { describe, expect, it, vi } from 'vitest'

vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {}, getDocument: vi.fn() }))
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: 'pdf-worker.js' }))

import { parsePlan } from './pdf'

describe('parsePlan', () => {
  it('rejects an unrelated PDF instead of using sample values', () => {
    const unrelated = 'Software engineer resume with experience in TypeScript, React, APIs, cloud infrastructure, and databases.'

    expect(() => parsePlan(unrelated, 'resume.pdf')).toThrow('does not appear to be a health insurance SBC')
  })

  it('rejects a document when too few plan values can be verified', () => {
    const vague = 'Summary of Benefits and Coverage. This health plan includes a deductible and covered services.'

    expect(() => parsePlan(vague, 'benefits.pdf')).toThrow('could not verify enough plan details')
  })

  it('extracts cited values and leaves missing benefits unknown', () => {
    const valid = [
      'Summary of Benefits and Coverage',
      'Overall deductible: $1,750 individual.',
      'Out-of-pocket limit: $6,900 individual.',
      'Covered services are available through the in-network health plan.',
    ].join('\n')

    const plan = parsePlan(valid, 'real-plan.pdf')

    expect(plan.deductible).toBe(1750)
    expect(plan.outOfPocketMax).toBe(6900)
    expect(plan.specialistCopay).toBeNull()
    expect(plan.specialistCoinsurance).toBeNull()
    expect(plan.citations).toHaveLength(2)
  })

  it('uses the amount following each label instead of reusing the first amount', () => {
    const valid = [
      'Summary of Benefits and Coverage',
      'Overall Deductible: $1,500 individual. Out-of-pocket maximum: $6,000 individual.',
      'Specialist visit: $50 copay. Covered services use the in-network health plan.',
    ].join(' ')

    const plan = parsePlan(valid, 'test-plan.pdf')

    expect(plan.deductible).toBe(1500)
    expect(plan.outOfPocketMax).toBe(6000)
    expect(plan.specialistCopay).toBe(50)
    expect(new Set(plan.citations.map((item) => item.excerpt)).size).toBe(3)
    expect(plan.citations.every((item) => !/\$[\d,]*…$/.test(item.excerpt))).toBe(true)
  })
})
