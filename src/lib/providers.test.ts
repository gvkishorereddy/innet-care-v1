import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchProviders } from './providers'

describe('searchProviders', () => {
  afterEach(() => vi.restoreAllMocks())

  it('encodes the search and returns directory data', async () => {
    const payload = { providers: [], total: 0, location: 'Scottsdale, AZ', source: 'CMS NPI Registry', query: { specialty: 'Obstetrics & Gynecology', zip: '85254', radius: 25 } }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }))

    await expect(searchProviders('Obstetrics & Gynecology', '85254', 25)).resolves.toEqual(payload)
    expect(fetchMock).toHaveBeenCalledWith('/api/providers?specialty=Obstetrics+%26+Gynecology&zip=85254&radius=25', expect.any(Object))
  })

  it('surfaces the API error message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: 'Enter a valid 5-digit ZIP code.' }), { status: 400 }))

    await expect(searchProviders('Dermatology', '12', 25)).rejects.toThrow('Enter a valid 5-digit ZIP code.')
  })

  it('handles a non-JSON upstream failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Service unavailable', { status: 503 }))

    await expect(searchProviders('Dermatology', '85254', 25)).rejects.toThrow('The provider directory is unavailable right now.')
  })
})
