import { useMemo, useRef, useState } from 'react'
import {
  ArrowRight, BadgeCheck, CalendarDays, Check, ChevronDown, CircleDollarSign,
  Clock3, FileCheck2, FileText, Info, LoaderCircle, LocateFixed, MapPin,
  Navigation, Phone, Search, ShieldCheck, Sparkles, Star, Stethoscope, UploadCloud,
} from 'lucide-react'
import { providers, specialties } from './data/providers'
import { rankProviders } from './lib/cost'
import { extractPdfText, parsePlan, samplePlan } from './lib/pdf'
import { saveSearch, storageMode } from './lib/storage'
import type { CostEstimate, PlanRules } from './types'

type Step = 'plan' | 'search' | 'results'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

function Logo() {
  return <div className="logo"><span className="logo-mark"><Check size={16} strokeWidth={3} /></span><span>InNet</span></div>
}

function Progress({ step }: { step: Step }) {
  const active = step === 'plan' ? 1 : step === 'search' ? 2 : 3
  return (
    <div className="progress" aria-label={`Step ${active} of 3`}>
      {['Understand plan', 'Find care', 'Compare costs'].map((label, index) => (
        <div className={`progress-item ${index + 1 <= active ? 'active' : ''}`} key={label}>
          <span>{index + 1 < active ? <Check size={14} strokeWidth={3} /> : index + 1}</span>
          <p>{label}</p>
          {index < 2 && <i />}
        </div>
      ))}
    </div>
  )
}

function PlanSummary({ plan, onContinue }: { plan: PlanRules; onContinue: () => void }) {
  return (
    <section className="plan-summary animate-in">
      <div className="success-banner"><FileCheck2 size={20} /><div><strong>Plan understood</strong><span>We found {plan.citations.length} source-backed details</span></div></div>
      <div className="plan-heading">
        <div><span className="eyebrow">Your plan</span><h2>{plan.planName}</h2><p>{plan.networkName}</p></div>
        <button className="text-button" onClick={() => location.reload()}>Replace PDF</button>
      </div>
      <div className="benefit-grid">
        <article><CircleDollarSign /><span>Annual deductible</span><strong>{currency.format(plan.deductible)}</strong></article>
        <article><ShieldCheck /><span>Out-of-pocket max</span><strong>{currency.format(plan.outOfPocketMax)}</strong></article>
        <article><Stethoscope /><span>Specialist visit</span><strong>{plan.specialistCopay ? `${currency.format(plan.specialistCopay)} copay` : `${plan.specialistCoinsurance}% after deductible`}</strong></article>
        <article><Navigation /><span>Specialist referral</span><strong>{plan.referralRequired === null ? 'Verify with plan' : plan.referralRequired ? 'Required' : 'Not required'}</strong></article>
      </div>
      <div className="citation-block">
        <div className="section-label"><BadgeCheck size={17} /> Source-backed details</div>
        {plan.citations.slice(0, 3).map((item) => (
          <details key={`${item.field}-${item.page}`}>
            <summary><span>{item.field}</span><b>{item.value}</b><em>Page {item.page}</em><ChevronDown size={16} /></summary>
            <p>“{item.excerpt}”</p>
          </details>
        ))}
      </div>
      <button className="primary-button wide" onClick={onContinue}>Find care with this plan <ArrowRight size={18} /></button>
    </section>
  )
}

function EstimateCard({ estimate, best }: { estimate: CostEstimate; best: boolean }) {
  const { provider } = estimate
  return (
    <article className={`provider-card ${best ? 'best' : ''}`}>
      {best && <div className="best-badge"><Sparkles size={14} /> Lowest estimated cost</div>}
      <div className="provider-top">
        <div className="avatar">{provider.name.split(' ').slice(1).map((v) => v[0]).join('')}</div>
        <div className="provider-identity"><h3>{provider.name}</h3><p>{provider.practice}</p><span>{provider.specialty}</span></div>
        <div className="cost"><small>YOU MAY PAY</small><strong>{currency.format(estimate.low)}–{currency.format(estimate.high)}</strong><span>estimated</span></div>
      </div>
      <div className="provider-meta">
        <span><Star size={15} fill="currentColor" /> {provider.rating}</span>
        <span><MapPin size={15} /> {provider.distance} mi</span>
        <span><CalendarDays size={15} /> {provider.nextAvailable}</span>
      </div>
      <div className="network-row">
        <span className={provider.networkStatus === 'confirmed' ? 'confirmed' : 'verify'}>
          {provider.networkStatus === 'confirmed' ? <BadgeCheck size={16} /> : <Info size={16} />}
          {provider.networkStatus === 'confirmed' ? 'In-network match' : 'Likely in-network — verify'}
        </span>
        <span>{provider.acceptingNewPatients ? 'Accepting new patients' : 'Call for availability'}</span>
      </div>
      <div className="why"><strong>How we estimated this</strong><p>{estimate.explanation} Final billing depends on services received.</p></div>
      <div className="card-actions">
        <button className="outline-button"><Phone size={16} /> Call to verify</button>
        <button className="dark-button">View details <ArrowRight size={16} /></button>
      </div>
    </article>
  )
}

export default function App() {
  const [step, setStep] = useState<Step>('plan')
  const [plan, setPlan] = useState<PlanRules | null>(null)
  const [specialty, setSpecialty] = useState('Dermatology')
  const [zip, setZip] = useState('85254')
  const [remainingDeductible, setRemainingDeductible] = useState(900)
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const estimates = useMemo(() => {
    if (!plan) return []
    return rankProviders(providers.filter((item) => item.specialty === specialty), plan, remainingDeductible)
  }, [plan, specialty, remainingDeductible])

  async function processFile(file?: File) {
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a PDF plan document.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const text = await extractPdfText(file)
      if (text.trim().length < 30) throw new Error('This PDF may be scanned or contain no selectable text.')
      setPlan(parsePlan(text, file.name))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not read that PDF.')
    } finally {
      setLoading(false)
    }
  }

  function useDemo() {
    setLoading(true)
    window.setTimeout(() => { setPlan(samplePlan); setLoading(false) }, 550)
  }

  async function findCare() {
    if (!plan) return
    setLoading(true)
    try { await saveSearch({ plan, specialty, zip, remainingDeductible }) } catch { /* Search still works if persistence fails. */ }
    window.setTimeout(() => { setStep('results'); setLoading(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }, 650)
  }

  return (
    <div className="app-shell">
      <header>
        <Logo />
        <nav><a href="#how">How it works</a><a href="#privacy">Privacy</a><span><ShieldCheck size={15} /> Your document stays private</span></nav>
      </header>

      <main>
        <Progress step={step} />

        {step === 'plan' && !plan && (
          <section className="hero animate-in">
            <div className="hero-copy">
              <span className="eyebrow"><Sparkles size={15} /> Insurance, made useful</span>
              <h1>Find care that fits<br /><em>your</em> health plan.</h1>
              <p>Upload your plan document. We’ll explain your benefits, find matching providers, and estimate what you may pay.</p>
              <div className="trust-row"><span><Check /> Source citations</span><span><Check /> No surprise guesses</span><span><Check /> You stay in control</span></div>
            </div>
            <div className="upload-card">
              <div className={`dropzone ${dragging ? 'dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); processFile(e.dataTransfer.files[0]) }}>
                <input ref={inputRef} type="file" accept="application/pdf" onChange={(e) => processFile(e.target.files?.[0])} />
                {loading ? <LoaderCircle className="spinner" size={34} /> : <span className="upload-icon"><UploadCloud size={28} /></span>}
                <h2>{loading ? 'Reading your plan…' : 'Upload your insurance PDF'}</h2>
                <p>Summary of Benefits & Coverage (SBC)<br />or Evidence of Coverage (EOC)</p>
                <button className="primary-button" onClick={() => inputRef.current?.click()} disabled={loading}>Choose PDF</button>
                <small>PDF up to 25 MB · processed in your browser</small>
              </div>
              <div className="or"><span>or</span></div>
              <button className="demo-button" onClick={useDemo} disabled={loading}><FileText size={19} /><span><strong>Try with a sample plan</strong><small>No insurance document needed</small></span><ArrowRight size={18} /></button>
              {error && <p className="error"><Info size={16} /> {error}</p>}
            </div>
          </section>
        )}

        {step === 'plan' && plan && <PlanSummary plan={plan} onContinue={() => { setStep('search'); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />}

        {step === 'search' && plan && (
          <section className="search-step animate-in">
            <div className="center-heading"><span className="eyebrow">Tell us what you need</span><h1>What kind of care are you looking for?</h1><p>We’ll use your plan rules to estimate and compare your costs.</p></div>
            <div className="search-panel">
              <label className="field"><span>Specialty or care</span><div><Search size={19} /><select value={specialty} onChange={(e) => setSpecialty(e.target.value)}>{specialties.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={18} /></div></label>
              <div className="quick-picks">{specialties.map((item) => <button className={specialty === item ? 'selected' : ''} onClick={() => setSpecialty(item)} key={item}>{item}</button>)}</div>
              <div className="two-fields">
                <label className="field"><span>Your ZIP code</span><div><LocateFixed size={19} /><input value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))} inputMode="numeric" /></div></label>
                <label className="field"><span>Deductible remaining</span><div><span className="dollar">$</span><input type="number" min="0" value={remainingDeductible} onChange={(e) => setRemainingDeductible(Number(e.target.value))} /></div><small>Find this in your insurer portal. An estimate is okay.</small></label>
              </div>
              <div className="plan-pill"><ShieldCheck size={18} /><div><strong>Using {plan.planName}</strong><span>{plan.specialistCopay ? `$${plan.specialistCopay} specialist copay` : `${plan.specialistCoinsurance}% specialist coinsurance`} · {plan.referralRequired ? 'Referral required' : 'No referral found'}</span></div><button onClick={() => setStep('plan')}>Review</button></div>
              <button className="primary-button wide" onClick={findCare} disabled={loading || zip.length !== 5}>{loading ? <><LoaderCircle className="spinner" size={18} /> Comparing your options…</> : <>Compare care options <ArrowRight size={18} /></>}</button>
              <p className="storage-note"><ShieldCheck size={14} /> Search history saved to {storageMode.toLowerCase()}</p>
            </div>
          </section>
        )}

        {step === 'results' && plan && (
          <section className="results-step animate-in">
            <div className="results-heading"><div><span className="eyebrow">Your care options</span><h1>{specialty} near {zip}</h1><p>Ranked by your estimated cost—not the provider’s sticker price.</p></div><button className="outline-button" onClick={() => setStep('search')}><Search size={16} /> Edit search</button></div>
            <div className="estimate-note"><Info size={18} /><div><strong>These are estimates, not guarantees.</strong><p>Always confirm network status and price with both the provider and your insurer before receiving care.</p></div></div>
            <div className="results-layout">
              <div className="provider-list">
                {estimates.length ? estimates.map((estimate, index) => <EstimateCard estimate={estimate} best={index === 0} key={estimate.provider.id} />) : <div className="empty-state"><Stethoscope size={30} /><h3>No demo providers for this specialty</h3><p>Try Dermatology, Primary care, or Cardiology.</p></div>}
              </div>
              <aside>
                <span className="eyebrow">Your plan math</span><h3>Why costs differ</h3>
                <div className="math-row"><span>Specialist benefit</span><strong>{plan.specialistCopay ? `$${plan.specialistCopay} copay` : `${plan.specialistCoinsurance}%`}</strong></div>
                <div className="math-row"><span>Deductible left</span><strong>{currency.format(remainingDeductible)}</strong></div>
                <div className="math-row"><span>Referral</span><strong>{plan.referralRequired ? 'Required' : 'Not required'}</strong></div>
                <hr />
                <p>Facility fees can make hospital-based care cost more than an independent clinic, even when both are in-network.</p>
                <div className="citation-mini"><FileCheck2 size={17} /><span>Plan benefit backed by <strong>page {plan.citations.find((c) => c.field === 'Specialist visit')?.page ?? 2}</strong></span></div>
              </aside>
            </div>
            <div className="demo-disclosure"><strong>Version 1 demo data</strong><p>The provider directory and negotiated prices shown here are synthetic. Connect an insurer directory and Transparency in Coverage dataset before real-world use.</p></div>
          </section>
        )}
      </main>

      <footer id="privacy"><Logo /><p>InNet helps you understand options. It does not provide medical advice or guarantee coverage.</p><span><Clock3 size={15} /> Version 1.0</span></footer>
    </div>
  )
}
