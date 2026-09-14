import { createClient } from '@supabase/supabase-js'
import type { PlanRules } from '../types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = url && key ? createClient(url, key) : null

export const storageMode = supabase ? 'Supabase' : 'This device'

export async function saveSearch(input: {
  plan: PlanRules
  specialty: string
  zip: string
  remainingDeductible: number
}) {
  const record = { ...input, created_at: new Date().toISOString() }
  if (supabase) {
    const { error } = await supabase.from('care_searches').insert({
      plan_name: input.plan.planName,
      specialty: input.specialty,
      zip_code: input.zip,
      remaining_deductible: input.remainingDeductible,
      plan_rules: input.plan,
    })
    if (error) throw error
    return
  }
  const previous = JSON.parse(localStorage.getItem('innet-searches') ?? '[]')
  localStorage.setItem('innet-searches', JSON.stringify([record, ...previous].slice(0, 10)))
}
