const taxonomyBySpecialty = {
  'Dermatology': 'Dermatology',
  'Primary care': 'Family Medicine',
  'Cardiology': 'Cardiovascular Disease',
  'Pediatrics': 'Pediatrics',
  'Orthopedic surgery': 'Orthopaedic Surgery',
  'Psychiatry': 'Psychiatry & Neurology',
  'Obstetrics & Gynecology': 'Obstetrics & Gynecology',
  'Ophthalmology': 'Ophthalmology',
  'Dentistry': 'Dentist',
  'Physical therapy': 'Physical Therapist',
}

const usStates = new Set(['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC','PR','VI','GU','AS','MP'])
const allowedRadii = new Set([5, 10, 25, 50, 100])

function first(value) {
  return Array.isArray(value) ? value[0] : value
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function displayName(value) {
  return clean(value).toLocaleLowerCase('en-US').replace(/(^|[\s\-'’])([a-z])/g, (_, boundary, letter) => `${boundary}${letter.toUpperCase()}`)
}

function locationAddress(record) {
  const addresses = Array.isArray(record.addresses) ? record.addresses : []
  return addresses.find((item) => item.address_purpose === 'LOCATION') || addresses[0] || {}
}

function providerName(record) {
  const basic = record.basic || {}
  if (record.enumeration_type === 'NPI-2') return displayName(basic.organization_name) || 'Healthcare organization'
  return displayName([clean(basic.first_name), clean(basic.middle_name), clean(basic.last_name)].filter(Boolean).join(' ')) || 'Healthcare provider'
}

function transformProvider(record) {
  const basic = record.basic || {}
  const address = locationAddress(record)
  const taxonomies = Array.isArray(record.taxonomies) ? record.taxonomies : []
  const taxonomy = taxonomies.find((item) => item.primary) || taxonomies[0] || {}
  const addressParts = [clean(address.address_1), clean(address.address_2)].filter(Boolean)

  return {
    npi: String(record.number || ''),
    name: providerName(record),
    credential: record.enumeration_type === 'NPI-1' ? clean(basic.credential) : '',
    providerType: record.enumeration_type === 'NPI-2' ? 'organization' : 'individual',
    specialty: clean(taxonomy.desc) || 'Healthcare provider',
    address: addressParts.join(', '),
    city: clean(address.city),
    state: clean(address.state).toUpperCase(),
    postalCode: clean(address.postal_code).slice(0, 5),
    phone: clean(address.telephone_number) || null,
    distanceMiles: null,
  }
}

async function geocodeZip(zip, signal) {
  const response = await fetch(`https://api.zippopotam.us/us/${encodeURIComponent(zip)}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'InNet-Care-Provider-Finder/2.1' },
    signal,
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`ZIP service returned ${response.status}`)
  const payload = await response.json()
  const places = Array.isArray(payload.places) ? payload.places : []
  const points = places.map((place) => ({ latitude: Number(place.latitude), longitude: Number(place.longitude) }))
    .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude))
  if (!points.length) return null
  return {
    latitude: points.reduce((sum, point) => sum + point.latitude, 0) / points.length,
    longitude: points.reduce((sum, point) => sum + point.longitude, 0) / points.length,
    label: `${clean(places[0]['place name'])}, ${clean(places[0]['state abbreviation'])}`,
  }
}

function milesBetween(origin, destination) {
  const radians = (degrees) => degrees * Math.PI / 180
  const latitudeDelta = radians(destination.latitude - origin.latitude)
  const longitudeDelta = radians(destination.longitude - origin.longitude)
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(origin.latitude)) * Math.cos(radians(destination.latitude)) * Math.sin(longitudeDelta / 2) ** 2
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed.' })
  }

  const specialty = clean(first(req.query?.specialty))
  const zip = clean(first(req.query?.zip))
  const radius = Number(first(req.query?.radius) || 25)
  const taxonomy = taxonomyBySpecialty[specialty]

  if (!taxonomy) return res.status(400).json({ error: 'Choose a supported specialty.' })
  if (!/^\d{5}$/.test(zip)) return res.status(400).json({ error: 'Enter a valid 5-digit US ZIP code.' })
  if (!allowedRadii.has(radius)) return res.status(400).json({ error: 'Choose a supported search radius.' })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)

  try {
    const origin = await geocodeZip(zip, controller.signal)
    if (!origin) return res.status(400).json({ error: 'That ZIP code was not found in the United States.' })

    const params = new URLSearchParams({ version: '2.1', taxonomy_description: taxonomy, postal_code: zip, limit: '50' })
    const response = await fetch(`https://npiregistry.cms.hhs.gov/api/?${params}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'InNet-Care-Provider-Finder/2.1' },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`CMS returned ${response.status}`)

    const payload = await response.json()
    const rawProviders = (Array.isArray(payload.results) ? payload.results : [])
      .filter((record) => record?.basic?.status !== 'D')
      .map(transformProvider)
      .filter((record) => record.npi && record.name && record.city && usStates.has(record.state) && /^\d{5}$/.test(record.postalCode))

    const uniqueZips = [...new Set(rawProviders.map((provider) => provider.postalCode).filter((providerZip) => providerZip !== zip))]
    const geocoded = await Promise.allSettled(uniqueZips.map(async (providerZip) => [providerZip, await geocodeZip(providerZip, controller.signal)]))
    const coordinates = new Map([[zip, origin]])
    for (const result of geocoded) {
      if (result.status === 'fulfilled' && result.value[1]) coordinates.set(result.value[0], result.value[1])
    }

    const providers = rawProviders.map((provider) => {
      const point = coordinates.get(provider.postalCode)
      const distanceMiles = point ? Number(milesBetween(origin, point).toFixed(1)) : null
      return { ...provider, distanceMiles }
    }).filter((provider) => provider.distanceMiles !== null && provider.distanceMiles <= radius)
      .sort((left, right) => left.distanceMiles - right.distanceMiles || left.name.localeCompare(right.name))

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
    return res.status(200).json({
      providers,
      total: providers.length,
      location: origin.label,
      source: 'CMS NPI Registry',
      query: { specialty, zip, radius },
    })
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError'
    return res.status(502).json({
      error: timedOut
        ? 'The provider search took too long to respond. Please try again.'
        : 'The provider directory is temporarily unavailable. Please try again.',
    })
  } finally {
    clearTimeout(timeout)
  }
}
