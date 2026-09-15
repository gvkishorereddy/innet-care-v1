export type Citation = {
  field: string
  value: string
  page: number
  excerpt: string
}

export type PlanRules = {
  planName: string
  networkName: string
  deductible: number
  outOfPocketMax: number
  specialistCopay: number | null
  specialistCoinsurance: number
  referralRequired: boolean | null
  citations: Citation[]
}

export type DirectoryProvider = {
  npi: string
  name: string
  credential: string
  providerType: 'individual' | 'organization'
  specialty: string
  address: string
  city: string
  state: string
  postalCode: string
  phone: string | null
}

export type ProviderSearchResponse = {
  providers: DirectoryProvider[]
  total: number
  source: 'CMS NPI Registry'
  query: {
    specialty: string
    zip: string
  }
}
