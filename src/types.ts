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

export type Provider = {
  id: string
  name: string
  practice: string
  specialty: string
  address: string
  distance: number
  rating: number
  nextAvailable: string
  negotiatedRate: number
  facilityFee: number
  networkStatus: 'confirmed' | 'likely' | 'out-of-network'
  acceptingNewPatients: boolean
  languages: string[]
}

export type CostEstimate = {
  provider: Provider
  low: number
  high: number
  explanation: string
  confidence: 'high' | 'medium' | 'low'
}
