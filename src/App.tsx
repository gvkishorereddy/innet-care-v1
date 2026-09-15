import { useRef, useState } from 'react'
import {
  ArrowRight, BadgeCheck, Building2, Check, ChevronDown, CircleDollarSign,
  Clock3, ExternalLink, FileCheck2, FileText, Info, LoaderCircle, LocateFixed,
  MapPin, Navigation, Phone, RefreshCw, Search, ShieldCheck, Sparkles,
  Stethoscope, UploadCloud, UserRound,
} from 'lucide-react'
import { extractPdfText, parsePlan, samplePlan } from './lib/pdf'
import { searchProviders, specialties } from './lib/providers'
import { saveSearch, storageMode } from './lib/storage'
import type { DirectoryProvider, PlanRules } from './types'

type Step = 'plan' | 'search' | 'results'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

function Logo() {
  return <button className="logo logo-button" onClick={() => window.location.reload()} aria-label="Return to InNet home"><span className="logo-mark"><Check size={16} strokeWidth={3} /></span><span>InNet</span></button>
}

function Progress({ step }: { step: Step }) {
  const active = step === 'plan' ? 1 : step === 'search' ? 2 : 3
  return (
    <div className="progress" aria-label={`Step ${active} of 3`}>
      {['Choose coverage', 'Find providers', 'Verify details'].map((label, index) => (
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
        <button className="text-button" onClick={() => window.location.reload()}>Replace PDF</button>
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
      <button className="primary-button wide" onClick={onContinue}>Search live providers <ArrowRight size={18} /></button>
    </section>
  )
}

function ProviderCard({ provider }: { provider: DirectoryProvider }) {
  const fullAddress = [provider.address, provider.city, provider.state, provider.postalCode].filter(Boolean).join(', ')
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress || provider.name)}`
  const npiUrl = `https://npiregistry.cms.hhs.gov/provider-view/${provider.npi}`
  const initials = provider.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()

  return (
    <article className="provider-card">
      <div className="provider-top">
        <div className="avatar">{provider.providerType === 'organization' ? <Building2 size={20} /> : initials || <UserRound size={20} />}</div>
        <div className="provider-identity">
          <h3>{provider.name}{provider.credential ? `, ${provider.credential}` : ''}</h3>
          <p>{provider.specialty}</p>
          <span>NPI {provider.npi}</span>
        </div>
        <span className="registry-badge"><BadgeCheck size={15} /> CMS listed</span>
      </div>
      <div className="provider-details">
        <div><MapPin size={17} /><span>{fullAddress || 'Practice address not listed'}</span></div>
        <div><Phone size={17} /><span>{provider.phone || 'Phone not listed'}</span></div>
      </div>
      <div className="verification-row">
        <Info size={17} />
        <div><strong>Coverage and cost need verification</strong><p>The public registry does not show insurance network status, prices, appointment availability, or whether new patients are accepted.</p></div>
      </div>
      <div className="card-actions">
        {provider.phone && <a className="outline-button" href={`tel:${provider.phone.replace(/\D/g, '')}`}><Phone size={16} /> Call office</a>}
        <a className="outline-button" href={mapsUrl} target="_blank" rel="noreferrer"><Navigation size={16} /> Directions</a>
        <a className="dark-button" href={npiUrl} target="_blank" rel="noreferrer">View NPI <ExternalLink size={15} /></a>
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
  const [providers, setProviders] = useState<DirectoryProvider[]>([])
  const [resultCount, setResultCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function processFile(file?: File) {
    if (!file) return
    if (file.size > 25 * 1024 * 1024) {
      setError('That file is larger than 25 MB. Try a smaller PDF.')
      return
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a PDF plan document.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const text = await extractPdfText(file)
      if (text.trim().length < 30) throw new Error('This looks like a scanned PDF. You can still browse providers without uploading it.')
      setPlan(parsePlan(text, file.name))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not read that PDF. You can still browse providers.')
    } finally {
      setLoading(false)
    }
  }

  function useDemo() {
    setLoading(true)
    window.setTimeout(() => { setPlan(samplePlan); setLoading(false) }, 450)
  }

  function browseWithoutDocument() {
    setPlan(null)
    setError('')
    setStep('search')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function findCare() {
    if (!/^\d{5}$/.test(zip)) {
      setError('Enter a valid 5-digit ZIP code.')
      return
    }

    setLoading(true)
    setError('')
    setProviders([])
    setStep('results')
    window.scrollTo({ top: 0, behavior: 'smooth' })

    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    void saveSearch({ plan, specialty, zip, remainingDeductible }).catch(() => undefined)

    try {
      const result = await searchProviders(specialty, zip, controller.signal)
      setProviders(result.providers)
      setResultCount(result.total)
    } catch (caught) {
      const message = caught instanceof Error && caught.name === 'AbortError'
        ? 'The provider directory took too long to respond. Please try again.'
        : caught instanceof Error ? caught.message : 'We could not load providers right now.'
      setError(message)
    } finally {
      window.clearTimeout(timeout)
      setLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <header>
        <Logo />
        <nav><a href="#how">How it works</a><a href="#privacy">Privacy</a><span><ShieldCheck size={15} /> PDF stays in your browser</span></nav>
      </header>

      <main>
        <Progress step={step} />

        {step === 'plan' && !plan && (
          <section className="hero animate-in">
            <div className="hero-copy">
              <span className="eyebrow"><Sparkles size={15} /> Insurance, made useful</span>
              <h1>Find care that fits<br /><em>your</em> situation.</h1>
              <p>Understand your plan when you have it—or search the live national provider directory without insurance or a PDF.</p>
              <div className="trust-row"><span><Check /> Live CMS listings</span><span><Check /> Source citations</span><span><Check /> No fake prices</span></div>
            </div>
            <div className="upload-card">
              <div className={`dropzone ${dragging ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); processFile(event.dataTransfer.files[0]) }}>
                <input ref={inputRef} type="file" accept="application/pdf" onChange={(event) => processFile(event.target.files?.[0])} />
                {loading ? <LoaderCircle className="spinner" size={34} /> : <span className="upload-icon"><UploadCloud size={28} /></span>}
                <h2>{loading ? 'Reading your plan…' : 'Upload your insurance PDF'}</h2>
                <p>Summary of Benefits & Coverage (SBC)<br />or Evidence of Coverage (EOC)</p>
                <button className="primary-button" onClick={() => inputRef.current?.click()} disabled={loading}>Choose PDF</button>
                <small>PDF up to 25 MB · processed in your browser</small>
              </div>
              <div className="or"><span>or continue without a document</span></div>
              <button className="browse-button" onClick={browseWithoutDocument} disabled={loading}><Search size={20} /><span><strong>Browse providers now</strong><small>Works with no PDF or no insurance</small></span><ArrowRight size={18} /></button>
              <button className="demo-button compact" onClick={useDemo} disabled={loading}><FileText size={18} /><span><strong>Try a sample insurance plan</strong><small>See how document analysis works</small></span><ArrowRight size={17} /></button>
              {error && <p className="error"><Info size={16} /> {error}</p>}
            </div>
          </section>
        )}

        {step === 'plan' && plan && <PlanSummary plan={plan} onContinue={() => { setStep('search'); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />}

        {step === 'search' && (
          <section className="search-step animate-in">
            <div className="center-heading"><span className="eyebrow">Live provider directory</span><h1>What kind of care do you need?</h1><p>{plan ? 'We’ll keep your plan details beside the results so you know what to verify.' : 'No insurance document required. Search public CMS provider records near you.'}</p></div>
            <div className="search-panel">
              <label className="field"><span>Specialty or care</span><div><Search size={19} /><select value={specialty} onChange={(event) => setSpecialty(event.target.value)}>{specialties.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={18} /></div></label>
              <div className="quick-picks">{specialties.slice(0, 5).map((item) => <button type="button" className={specialty === item ? 'selected' : ''} onClick={() => setSpecialty(item)} key={item}>{item}</button>)}</div>
              <div className={plan ? 'two-fields' : ''}>
                <label className="field"><span>Your ZIP code</span><div><LocateFixed size={19} /><input aria-label="ZIP code" value={zip} onChange={(event) => setZip(event.target.value.replace(/\D/g, '').slice(0, 5))} inputMode="numeric" placeholder="5-digit ZIP" /></div></label>
                {plan && <label className="field"><span>Deductible remaining</span><div><span className="dollar">$</span><input type="number" min="0" value={remainingDeductible} onChange={(event) => setRemainingDeductible(Math.max(0, Number(event.target.value)))} /></div><small>Used only as context; CMS does not publish visit prices.</small></label>}
              </div>
              {plan ? (
                <div className="plan-pill"><ShieldCheck size={18} /><div><strong>Using {plan.planName}</strong><span>{plan.specialistCopay ? `$${plan.specialistCopay} specialist copay` : `${plan.specialistCoinsurance}% specialist coinsurance`} · Network still needs verification</span></div><button onClick={() => setStep('plan')}>Review</button></div>
              ) : (
                <div className="plan-pill neutral"><Search size={18} /><div><strong>Searching without a plan</strong><span>You can browse any provider, then call to ask about self-pay or insurance.</span></div><button onClick={() => { setStep('plan'); setError('') }}>Add PDF</button></div>
              )}
              {error && <p className="inline-error"><Info size={16} /> {error}</p>}
              <button className="primary-button wide" onClick={findCare} disabled={loading || zip.length !== 5}>{loading ? <><LoaderCircle className="spinner" size={18} /> Searching CMS…</> : <>Search live providers <ArrowRight size={18} /></>}</button>
              <p className="storage-note"><ShieldCheck size={14} /> Search history saved to {storageMode.toLowerCase()}</p>
            </div>
          </section>
        )}

        {step === 'results' && (
          <section className="results-step animate-in">
            <div className="results-heading"><div><span className="eyebrow">CMS NPI Registry</span><h1>{specialty} near {zip}</h1><p>{loading ? 'Searching the national provider registry…' : error ? 'The search could not be completed.' : `${providers.length} provider${providers.length === 1 ? '' : 's'} shown${resultCount > providers.length ? ` · ${resultCount} registry matches` : ''}`}</p></div><button className="outline-button" onClick={() => { setStep('search'); setError('') }}><Search size={16} /> Edit search</button></div>
            <div className="estimate-note"><Info size={18} /><div><strong>A directory listing is not proof of coverage.</strong><p>Call the provider and your insurer before care. Ask about network participation, referral rules, availability, and your expected price.</p></div></div>
            <div className="results-layout">
              <div className="provider-list" aria-live="polite">
                {loading && <div className="loading-state"><LoaderCircle className="spinner" size={32} /><h3>Finding providers near you</h3><p>Checking current public CMS registry records…</p></div>}
                {!loading && error && <div className="empty-state error-state"><Info size={30} /><h3>We couldn’t load the directory</h3><p>{error}</p><button className="primary-button" onClick={findCare}><RefreshCw size={16} /> Try again</button></div>}
                {!loading && !error && providers.map((provider) => <ProviderCard provider={provider} key={provider.npi} />)}
                {!loading && !error && providers.length === 0 && <div className="empty-state"><Stethoscope size={30} /><h3>No matching providers found</h3><p>Try a nearby ZIP code or a broader specialty such as Primary care.</p><button className="outline-button" onClick={() => setStep('search')}><Search size={16} /> Change search</button></div>}
              </div>
              <aside>
                {plan ? <>
                  <span className="eyebrow">Your plan context</span><h3>Questions to ask</h3>
                  <div className="math-row"><span>Specialist benefit</span><strong>{plan.specialistCopay ? `$${plan.specialistCopay} copay` : `${plan.specialistCoinsurance}% after deductible`}</strong></div>
                  <div className="math-row"><span>Deductible left</span><strong>{currency.format(remainingDeductible)}</strong></div>
                  <div className="math-row"><span>Referral</span><strong>{plan.referralRequired === null ? 'Verify' : plan.referralRequired ? 'Required' : 'Not required'}</strong></div>
                  <hr /><p>Give your insurer the provider’s NPI and address. Ask whether this exact location is in-network and request an estimate for your visit.</p>
                  <div className="citation-mini"><FileCheck2 size={17} /><span>Benefit found in your uploaded plan</span></div>
                </> : <>
                  <span className="eyebrow">No insurance needed</span><h3>Before you book</h3>
                  <ol className="checklist"><li>Ask if new patients are accepted.</li><li>Request the cash or self-pay price.</li><li>Ask about facility and lab fees.</li><li>Confirm the office address.</li></ol>
                  <hr /><p>If you have insurance but no PDF, give the office your member ID and ask them to verify your benefits.</p>
                </>}
              </aside>
            </div>
            <div className="source-disclosure"><BadgeCheck size={18} /><div><strong>Live public data from the CMS NPI Registry</strong><p>Records identify registered healthcare providers. CMS does not certify quality, coverage, pricing, or availability through this dataset.</p></div></div>
          </section>
        )}
      </main>

      <footer id="privacy"><Logo /><p>InNet helps you find and understand options. It does not provide medical advice or guarantee coverage.</p><span><Clock3 size={15} /> Version 2.0</span></footer>
    </div>
  )
}
