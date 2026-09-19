import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { Citation, PlanRules } from '../types'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

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

function looksLikeInsurancePlan(text: string) {
  const strongDocumentMarker = /(summary of benefits(?: and coverage)?|evidence of coverage|schedule of benefits|certificate of coverage)/i.test(text)
  const insuranceSignals = [
    /\bdeductible\b/i,
    /out[- ]of[- ]pocket/i,
    /\bcoinsurance\b/i,
    /\bcopay(?:ment)?\b/i,
    /\bin[- ]network\b/i,
    /\bcovered services\b/i,
    /\bhealth plan\b/i,
  ].filter((pattern) => pattern.test(text)).length

  return strongDocumentMarker ? insuranceSignals >= 2 : insuranceSignals >= 4
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
  if (!looksLikeInsurancePlan(flattened)) {
    throw new Error('This does not appear to be a health insurance SBC or Evidence of Coverage. Upload the correct plan document, or browse providers without it.')
  }

  const deductible = moneyNear(flattened, ['overall deductible', 'deductible'])
  const oop = moneyNear(flattened, ['out-of-pocket limit', 'out of pocket maximum', 'out-of-pocket maximum'])
  const specialistCopay = moneyNear(flattened, ['specialist visit', 'specialist'])
  const coinsuranceMatch = flattened.match(/specialist[^\n]{0,100}?(\d{1,2})%/i)
  const specialistCoinsurance = coinsuranceMatch ? Number(coinsuranceMatch[1]) : null
  const referralRequired = /referral.{0,30}(required|need)/i.test(flattened)
    ? !/referral.{0,30}(not required|do not need|isn['’]t required)/i.test(flattened)
    : null

  const extractedValues = [deductible, oop, specialistCopay, specialistCoinsurance, referralRequired]
    .filter((value) => value !== null).length
  if (extractedValues < 2) {
    throw new Error('This may be an insurance document, but InNet could not verify enough plan details. Try the SBC or EOC, or browse providers without a PDF.')
  }

  const planName = filename.replace(/\.pdf$/i, '').replaceAll(/[-_]/g, ' ')
  const citations = [
    deductible !== null ? citation(text, 'Deductible', `$${deductible.toLocaleString()}`, ['overall deductible', 'deductible']) : null,
    oop !== null ? citation(text, 'Out-of-pocket maximum', `$${oop.toLocaleString()}`, ['out-of-pocket limit', 'out of pocket maximum']) : null,
    specialistCopay !== null ? citation(text, 'Specialist visit', `$${specialistCopay}`, ['specialist visit', 'specialist']) : null,
    specialistCopay === null && specialistCoinsurance !== null
      ? citation(text, 'Specialist visit', `${specialistCoinsurance}% coinsurance`, ['specialist visit', 'specialist'])
      : null,
    referralRequired !== null
      ? citation(text, 'Referral', referralRequired ? 'Required' : 'Not required', ['referral'])
      : null,
  ].filter((item): item is Citation => item !== null)

  return {
    planName, networkName: 'Network name not found', deductible, outOfPocketMax: oop,
    specialistCopay, specialistCoinsurance, referralRequired, citations,
  }
}
