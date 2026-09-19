import type { ProviderSearchResponse } from '../types'

export const specialties = [
  'Dermatology',
  'Primary care',
  'Cardiology',
  'Pediatrics',
  'Orthopedic surgery',
  'Psychiatry',
  'Obstetrics & Gynecology',
  'Ophthalmology',
  'Dentistry',
  'Physical therapy',
]

export async function searchProviders(specialty: string, zip: string, radius: number, signal?: AbortSignal) {
  const params = new URLSearchParams({ specialty, zip, radius: String(radius) })
  const response = await fetch(`/api/providers?${params}`, {
    headers: { Accept: 'application/json' },
    signal,
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error || 'The provider directory is unavailable right now.')
  }
  return data as ProviderSearchResponse
}
