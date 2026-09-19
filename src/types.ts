export type Citation = {
  field: string
  value: string
  page: number
  excerpt: string
}

export type PlanRules = {
  planName: string
  networkName: string
  deductible: number | null
  familyDeductible: number | null
  outOfPocketMax: number | null
  familyOutOfPocketMax: number | null
  primaryCareCopay: number | null
  specialistCopay: number | null
  specialistCoinsurance: number | null
  urgentCareCopay: number | null
  emergencyRoomCopay: number | null
  genericDrugCopay: number | null
  preferredBrandDrugCopay: number | null
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
  distanceMiles: number | null
}

export type ProviderSearchResponse = {
  providers: DirectoryProvider[]
  total: number
  location: string
  source: 'CMS NPI Registry'
  query: {
    specialty: string
    zip: string
    radius: number
  }
}
