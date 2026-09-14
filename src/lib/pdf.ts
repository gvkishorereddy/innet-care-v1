import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { Citation, PlanRules } from '../types'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export const samplePlan: PlanRules = {
  planName: 'Desert Choice Silver 2500',
  networkName: 'Desert Choice PPO',
  deductible: 2500,
  outOfPocketMax: 7800,
  specialistCopay: 45,
  specialistCoinsurance: 20,
  referralRequired: false,
  citations: [
    { field: 'Specialist visit', value: '$45 copay', page: 2, excerpt: 'Specialist visit — $45 copay per visit; deductible does not apply.' },
    { field: 'Deductible', value: '$2,500', page: 1, excerpt: 'Overall deductible: $2,500 individual / $5,000 family.' },
    { field: 'Referral', value: 'Not required', page: 3, excerpt: 'You do not need a referral to see an in-network specialist.' },
  ],
}

function moneyNear(text: string, terms: string[]): number | null {
  const lines = text.split(/\n| {2,}/).filter(Boolean)
  const line = lines.find((value) => terms.some((term) => value.toLowerCase().includes(term)))
  const match = line?.match(/\$\s?([\d,]+)/)
  return match ? Number(match[1].replaceAll(',', '')) : null
}

function citation(text: string, field: string, value: string, terms: string[]): Citation | null {
  const pages = text.split('\n---PAGE_BREAK---\n')
  for (let page = 0; page < pages.length; page += 1) {
    const segments = pages[page].split(/\n| {2,}/).filter(Boolean)
    const excerpt = segments.find((line) => terms.some((term) => line.toLowerCase().includes(term)))
    if (excerpt) return { field, value, page: page + 1, excerpt: excerpt.slice(0, 240) }
  }
  return null
}

export async function extractPdfText(file: File): Promise<string> {
  const bytes = await file.arrayBuffer()
  const document = await pdfjs.getDocument({ data: bytes }).promise
  const pages: string[] = []
  for (let index = 1; index <= document.numPages; index += 1) {
    const page = await document.getPage(index)
    const content = await page.getTextContent()
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
  }
  return pages.join('\n---PAGE_BREAK---\n')
}

export function parsePlan(text: string, filename: string): PlanRules {
  const flattened = text.replaceAll('\n---PAGE_BREAK---\n', '\n')
  const deductible = moneyNear(flattened, ['overall deductible', 'deductible']) ?? samplePlan.deductible
  const oop = moneyNear(flattened, ['out-of-pocket limit', 'out of pocket maximum', 'out-of-pocket maximum']) ?? samplePlan.outOfPocketMax
  const specialistCopay = moneyNear(flattened, ['specialist visit', 'specialist'])
  const coinsuranceMatch = flattened.match(/specialist[^\n]{0,100}?(\d{1,2})%/i)
  const specialistCoinsurance = coinsuranceMatch ? Number(coinsuranceMatch[1]) : samplePlan.specialistCoinsurance
  const referralRequired = /referral.{0,30}(required|need)/i.test(flattened)
    ? !/referral.{0,30}(not required|do not need|isn['’]t required)/i.test(flattened)
    : null
  const planName = filename.replace(/\.pdf$/i, '').replaceAll(/[-_]/g, ' ')
  const citations = [
    citation(text, 'Deductible', `$${deductible.toLocaleString()}`, ['overall deductible', 'deductible']),
    citation(text, 'Out-of-pocket maximum', `$${oop.toLocaleString()}`, ['out-of-pocket limit', 'out of pocket maximum']),
    specialistCopay !== null ? citation(text, 'Specialist visit', `$${specialistCopay}`, ['specialist visit', 'specialist']) : null,
    citation(text, 'Referral', referralRequired === true ? 'Required' : referralRequired === false ? 'Not required' : 'Not found', ['referral']),
  ].filter((item): item is Citation => item !== null)

  return {
    planName, networkName: 'Network name not found', deductible, outOfPocketMax: oop,
    specialistCopay, specialistCoinsurance, referralRequired, citations,
  }
}
