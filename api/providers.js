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
  if (record.enumeration_type === 'NPI-2') {
    return displayName(basic.organization_name) || 'Healthcare organization'
  }
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
    state: clean(address.state),
    postalCode: clean(address.postal_code).slice(0, 5),
    phone: clean(address.telephone_number) || null,
  }
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed.' })
  }

  const specialty = clean(first(req.query?.specialty))
  const zip = clean(first(req.query?.zip))
  const taxonomy = taxonomyBySpecialty[specialty]

  if (!taxonomy) return res.status(400).json({ error: 'Choose a supported specialty.' })
  if (!/^\d{5}$/.test(zip)) return res.status(400).json({ error: 'Enter a valid 5-digit ZIP code.' })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  try {
    const params = new URLSearchParams({
      version: '2.1',
      taxonomy_description: taxonomy,
      postal_code: zip,
      limit: '30',
    })
    const response = await fetch(`https://npiregistry.cms.hhs.gov/api/?${params}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'InNet-Care-Provider-Finder/2.0' },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`CMS returned ${response.status}`)

    const payload = await response.json()
    const providers = (Array.isArray(payload.results) ? payload.results : [])
      .filter((record) => record?.basic?.status !== 'D')
      .map(transformProvider)
      .filter((record) => record.npi && record.name && record.city)

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
    return res.status(200).json({
      providers,
      total: Number(payload.result_count) || providers.length,
      source: 'CMS NPI Registry',
      query: { specialty, zip },
    })
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError'
    return res.status(502).json({
      error: timedOut
        ? 'The CMS provider directory took too long to respond. Please try again.'
        : 'The CMS provider directory is temporarily unavailable. Please try again.',
    })
  } finally {
    clearTimeout(timeout)
  }
}
