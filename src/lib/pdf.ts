import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { Citation, PlanRules } from '../types'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

type SourceMatch<T> = {
  value: T
  page: number
  excerpt: string
}

const moneyPattern = /\$\s*([\d,]+(?:\.\d{2})?)/

function normalize(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function safeExcerpt(text: string, minimumEnd: number) {
  const hardEnd = Math.min(text.length, 220)
  const punctuation = text.slice(minimumEnd, hardEnd).search(/[.;](?:\s|$)/)
  if (punctuation >= 0) return text.slice(0, minimumEnd + punctuation + 1).trim()
  if (text.length <= hardEnd) return text.trim()
  const boundary = text.lastIndexOf(' ', hardEnd)
  return `${text.slice(0, Math.max(boundary, minimumEnd)).trim()}…`
}

function findAfterLabel<T>(
  pages: string[],
  labels: RegExp[],
  valuePattern: RegExp,
  parse: (match: RegExpMatchArray) => T,
  maxDistance = 150,
): SourceMatch<T> | null {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = normalize(pages[pageIndex])
    for (const label of labels) {
      const labelMatch = page.match(label)
      if (!labelMatch || labelMatch.index === undefined) continue
      const window = page.slice(labelMatch.index, labelMatch.index + maxDistance)
      const valueMatch = window.match(valuePattern)
      if (!valueMatch || valueMatch.index === undefined) continue
      const valueEnd = valueMatch.index + valueMatch[0].length
      return {
        value: parse(valueMatch),
        page: pageIndex + 1,
        excerpt: safeExcerpt(window, valueEnd),
      }
    }
  }
  return null
}

function moneyAfter(pages: string[], labels: RegExp[], maxDistance = 150) {
  return findAfterLabel(pages, labels, moneyPattern, (match) => Number(match[1].replaceAll(',', '')), maxDistance)
}

function percentAfter(pages: string[], labels: RegExp[]) {
  return findAfterLabel(pages, labels, /(\d{1,3})\s*%/, (match) => Number(match[1]))
}

function familyMoney(pages: string[], labels: RegExp[]) {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = normalize(pages[pageIndex])
    for (const label of labels) {
      const labelMatch = page.match(label)
      if (!labelMatch || labelMatch.index === undefined) continue
      const window = page.slice(labelMatch.index, labelMatch.index + 240)
      const before = window.match(/family[^$]{0,45}\$\s*([\d,]+(?:\.\d{2})?)/i)
      const after = window.match(/\$\s*([\d,]+(?:\.\d{2})?)[^$]{0,30}family/i)
      const match = before ?? after
      if (!match || match.index === undefined) continue
      const valueEnd = match.index + match[0].length
      return {
        value: Number(match[1].replaceAll(',', '')),
        page: pageIndex + 1,
        excerpt: safeExcerpt(window, valueEnd),
      }
    }
  }
  return null
}

function referralMatch(pages: string[]): SourceMatch<boolean> | null {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = normalize(pages[pageIndex])
    const label = page.match(/referral/i)
    if (!label || label.index === undefined) continue
    const window = page.slice(label.index, label.index + 180)
    if (/referral.{0,60}(not required|do not need|isn['’]t required|no referral)/i.test(window)) {
      return { value: false, page: pageIndex + 1, excerpt: safeExcerpt(window, 80) }
    }
    if (/referral.{0,60}(required|need(?:ed)?)/i.test(window)) {
      return { value: true, page: pageIndex + 1, excerpt: safeExcerpt(window, 80) }
    }
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

function cite(field: string, displayValue: string, match: SourceMatch<unknown> | null): Citation | null {
  return match ? { field, value: displayValue, page: match.page, excerpt: match.excerpt } : null
}

function dollars(value: number) {
  return `$${value.toLocaleString('en-US')}`
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
  const pages = text.split('\n---PAGE_BREAK---\n')
  const flattened = normalize(pages.join(' '))
  if (!looksLikeInsurancePlan(flattened)) {
    throw new Error('This does not appear to be a health insurance SBC or Evidence of Coverage. Upload the correct plan document, or browse providers without it.')
  }

  const deductible = moneyAfter(pages, [/overall deductible/i, /annual deductible/i, /individual deductible/i])
  const familyDeductible = familyMoney(pages, [/overall deductible/i, /annual deductible/i, /deductible/i])
  const oop = moneyAfter(pages, [/out[- ]of[- ]pocket (?:limit|maximum)/i])
  const familyOop = familyMoney(pages, [/out[- ]of[- ]pocket (?:limit|maximum)/i])
  const primaryCare = moneyAfter(pages, [/primary care (?:visit|provider|physician)/i, /primary care to treat/i])
  const specialistCopay = moneyAfter(pages, [/specialist (?:visit|care|physician)/i])
  const specialistCoinsurance = specialistCopay ? null : percentAfter(pages, [/specialist (?:visit|care|physician)/i])
  const urgentCare = moneyAfter(pages, [/urgent care/i])
  const emergencyRoom = moneyAfter(pages, [/emergency room/i, /emergency care/i])
  const genericDrug = moneyAfter(pages, [/generic drugs?/i, /tier 1(?: drugs?)?/i])
  const preferredBrandDrug = moneyAfter(pages, [/preferred brand drugs?/i, /tier 2(?: drugs?)?/i])
  const referral = referralMatch(pages)

  const matches = [deductible, oop, primaryCare, specialistCopay, specialistCoinsurance, urgentCare, emergencyRoom, genericDrug, preferredBrandDrug, referral]
  if (matches.filter(Boolean).length < 2) {
    throw new Error('This may be an insurance document, but InNet could not verify enough plan details. Try the SBC or EOC, or browse providers without a PDF.')
  }

  const citations = [
    cite('Individual deductible', deductible ? dollars(deductible.value) : '', deductible),
    cite('Family deductible', familyDeductible ? dollars(familyDeductible.value) : '', familyDeductible),
    cite('Individual out-of-pocket maximum', oop ? dollars(oop.value) : '', oop),
    cite('Family out-of-pocket maximum', familyOop ? dollars(familyOop.value) : '', familyOop),
    cite('Primary care visit', primaryCare ? dollars(primaryCare.value) : '', primaryCare),
    cite('Specialist visit', specialistCopay ? dollars(specialistCopay.value) : specialistCoinsurance ? `${specialistCoinsurance.value}% coinsurance` : '', specialistCopay ?? specialistCoinsurance),
    cite('Urgent care', urgentCare ? dollars(urgentCare.value) : '', urgentCare),
    cite('Emergency room', emergencyRoom ? dollars(emergencyRoom.value) : '', emergencyRoom),
    cite('Generic prescription', genericDrug ? dollars(genericDrug.value) : '', genericDrug),
    cite('Preferred brand prescription', preferredBrandDrug ? dollars(preferredBrandDrug.value) : '', preferredBrandDrug),
    cite('Specialist referral', referral ? (referral.value ? 'Required' : 'Not required') : '', referral),
  ].filter((item): item is Citation => item !== null)

  return {
    planName: filename.replace(/\.pdf$/i, '').replaceAll(/[-_]/g, ' '),
    networkName: 'Network name not found',
    deductible: deductible?.value ?? null,
    familyDeductible: familyDeductible?.value ?? null,
    outOfPocketMax: oop?.value ?? null,
    familyOutOfPocketMax: familyOop?.value ?? null,
    primaryCareCopay: primaryCare?.value ?? null,
    specialistCopay: specialistCopay?.value ?? null,
    specialistCoinsurance: specialistCoinsurance?.value ?? null,
    urgentCareCopay: urgentCare?.value ?? null,
    emergencyRoomCopay: emergencyRoom?.value ?? null,
    genericDrugCopay: genericDrug?.value ?? null,
    preferredBrandDrugCopay: preferredBrandDrug?.value ?? null,
    referralRequired: referral?.value ?? null,
    citations,
  }
}
