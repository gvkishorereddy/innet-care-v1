import { useMemo, useRef, useState } from 'react'
import {
  ArrowRight, BadgeCheck, Building2, Check, ChevronDown, CircleDollarSign,
  Clock3, ExternalLink, FileCheck2, Info, LoaderCircle, LocateFixed,
  MapPin, Navigation, Phone, RefreshCw, Search, ShieldCheck, Sparkles,
  Stethoscope, UploadCloud, UserRound,
} from 'lucide-react'
import { extractPdfText, parsePlan } from './lib/pdf'
import { searchProviders, specialties } from './lib/providers'
import { saveSearch, storageMode } from './lib/storage'
import type { DirectoryProvider, PlanRules } from './types'

type Step = 'plan' | 'search' | 'results'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

function moneyOrUnknown(value: number | null) {
  return value === null ? 'Not found in document' : currency.format(value)
}

function specialistBenefit(plan: PlanRules) {
  if (plan.specialistCopay !== null) return `${currency.format(plan.specialistCopay)} copay`
  if (plan.specialistCoinsurance !== null) return `${plan.specialistCoinsurance}% after deductible`
  return 'Not found in document'
}

function Logo() {
  return <a className="logo logo-button" href="/" aria-label="Return to InNet home"><span className="logo-mark"><Check size={16} strokeWidth={3} /></span><span>InNet</span></a>
}

function SiteFooter() {
  return (
    <footer>
      <div className="footer-brand"><Logo /><small>A Venkat Builds project</small></div>
      <p>InNet helps you find and understand options. It does not provide medical advice or guarantee coverage.</p>
      <div className="footer-links"><a href="/#how">About</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="https://github.com/gvkishorereddy/innet-care-v1/issues" target="_blank" rel="noreferrer">Contact</a></div>
      <span><Clock3 size={15} /> Version 2.1</span>
    </footer>
  )
}

function HowItWorks() {
  return (
    <section className="how-section" id="how">
      <span className="eyebrow">How it works</span>
      <h2>Evidence first, then provider search.</h2>
      <div className="how-grid">
        <article><b>1</b><h3>Choose your path</h3><p>Upload an SBC or EOC, or skip insurance and search the provider directory directly.</p></article>
        <article><b>2</b><h3>Verify the source</h3><p>InNet shows a benefit only when it finds a label-specific value and an exact page citation.</p></article>
        <article><b>3</b><h3>Confirm before care</h3><p>Use the NPI and address to confirm network participation, price, and availability with the provider and insurer.</p></article>
      </div>
    </section>
  )
}

function LegalPage({ page }: { page: 'privacy' | 'terms' }) {
  const privacy = page === 'privacy'
  return (
    <div className="app-shell legal-shell">
      <header><Logo /><nav><a href="/#how">How it works</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav></header>
      <main className="legal-page">
        <a className="back-link" href="/"><ArrowRight size={15} /> Back to InNet</a>
        <span className="eyebrow">{privacy ? 'Privacy' : 'Terms of use'}</span>
        <h1>{privacy ? 'Your document stays on your device.' : 'Use InNet as a starting point—not a guarantee.'}</h1>
        <p className="legal-updated">Last updated September 19, 2026</p>
        {privacy ? <>
          <section><h2>Insurance documents</h2><p>PDF text is read in your browser. InNet does not upload or store the PDF, its full text, or the benefit values extracted from it on our servers.</p></section>
          <section><h2>Provider searches</h2><p>To run a search, your specialty, ZIP code, and radius are sent to InNet’s server. The server queries the CMS NPI Registry and uses Zippopotam.us postal data to validate the ZIP and estimate distance. Do not enter a member ID, diagnosis, or other sensitive medical information.</p></section>
          <section><h2>Data stored on your device</h2><p>Recent search settings may be saved in your browser’s local storage so the interface can work without an account. You can remove them through your browser’s site-data controls.</p></section>
          <section><h2>Hosting and public data services</h2><p>Vercel hosts the site and may process ordinary request metadata such as IP address and browser information for security and operations. CMS and Zippopotam.us process directory and ZIP lookups under their own policies. InNet does not sell personal data or use advertising trackers.</p></section>
          <section><h2>Questions</h2><p>Report a privacy concern through the project’s <a href="https://github.com/gvkishorereddy/innet-care-v1/issues" target="_blank" rel="noreferrer">public issue tracker</a>. Do not include medical or insurance identifiers.</p></section>
        </> : <>
          <section><h2>Informational service</h2><p>InNet is an informational prototype, not an insurer, provider directory maintained by an insurer, medical service, or substitute for professional advice.</p></section>
          <section><h2>No coverage or price guarantee</h2><p>A CMS NPI record confirms that a provider has a registry entry. It does not prove network participation, quality, availability, or price. Confirm the exact NPI and practice location with both the provider and your insurer before receiving care.</p></section>
          <section><h2>Document extraction</h2><p>PDF extraction can be incomplete, especially for scanned, unusual, or complex documents. Review every source citation against your original plan. “Not found in document” does not mean a benefit is absent.</p></section>
          <section><h2>Acceptable use and availability</h2><p>Do not misuse the service, attempt to disrupt it, or rely on it for emergencies. Features and public data sources may change or become unavailable.</p></section>
          <section><h2>Emergency care</h2><p>Do not use InNet to decide whether to seek emergency treatment. In the United States, call 911 or go to the nearest emergency department when immediate help is needed.</p></section>
        </>}
      </main>
      <SiteFooter />
    </div>
  )
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
      <div className="success-banner"><FileCheck2 size={20} /><div><strong>Verified plan details</strong><span>We found {plan.citations.length} source-backed details</span></div></div>
      <div className="plan-heading">
        <div><span className="eyebrow">Your plan</span><h2>{plan.planName}</h2><p>{plan.networkName}</p></div>
        <button className="text-button" onClick={() => window.location.reload()}>Replace PDF</button>
      </div>
      <div className="benefit-grid">
        <article><CircleDollarSign /><span>Individual deductible</span><strong>{moneyOrUnknown(plan.deductible)}</strong></article>
        <article><CircleDollarSign /><span>Family deductible</span><strong>{moneyOrUnknown(plan.familyDeductible)}</strong></article>
        <article><ShieldCheck /><span>Individual OOP max</span><strong>{moneyOrUnknown(plan.outOfPocketMax)}</strong></article>
        <article><ShieldCheck /><span>Family OOP max</span><strong>{moneyOrUnknown(plan.familyOutOfPocketMax)}</strong></article>
        <article><Stethoscope /><span>Primary care visit</span><strong>{moneyOrUnknown(plan.primaryCareCopay)}</strong></article>
        <article><Stethoscope /><span>Specialist visit</span><strong>{specialistBenefit(plan)}</strong></article>
        <article><Navigation /><span>Urgent care</span><strong>{moneyOrUnknown(plan.urgentCareCopay)}</strong></article>
        <article><Navigation /><span>Emergency room</span><strong>{moneyOrUnknown(plan.emergencyRoomCopay)}</strong></article>
        <article><CircleDollarSign /><span>Generic prescription</span><strong>{moneyOrUnknown(plan.genericDrugCopay)}</strong></article>
        <article><CircleDollarSign /><span>Preferred brand Rx</span><strong>{moneyOrUnknown(plan.preferredBrandDrugCopay)}</strong></article>
        <article><Navigation /><span>Specialist referral</span><strong>{plan.referralRequired === null ? 'Not found in document' : plan.referralRequired ? 'Required' : 'Not required'}</strong></article>
      </div>
      <div className="citation-block">
        <div className="section-label"><BadgeCheck size={17} /> Source-backed details</div>
        {plan.citations.map((item) => (
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
        {provider.distanceMiles !== null && <div><LocateFixed size={17} /><span>{provider.distanceMiles.toFixed(1)} miles from the ZIP-code center</span></div>}
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

function CareApp() {
  const [step, setStep] = useState<Step>('plan')
  const [plan, setPlan] = useState<PlanRules | null>(null)
  const [specialty, setSpecialty] = useState('Dermatology')
  const [zip, setZip] = useState('85254')
  const [remainingDeductible, setRemainingDeductible] = useState(900)
  const [radius, setRadius] = useState(25)
  const [location, setLocation] = useState('')
  const [providerType, setProviderType] = useState<'all' | DirectoryProvider['providerType']>('all')
  const [sortBy, setSortBy] = useState<'distance' | 'name'>('distance')
  const [page, setPage] = useState(1)
  const [providers, setProviders] = useState<DirectoryProvider[]>([])
  const [resultCount, setResultCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const pageSize = 10
  const visibleProviders = useMemo(() => {
    const filtered = providerType === 'all' ? providers : providers.filter((provider) => provider.providerType === providerType)
    return [...filtered].sort((left, right) => sortBy === 'name'
      ? left.name.localeCompare(right.name)
      : (left.distanceMiles ?? Number.POSITIVE_INFINITY) - (right.distanceMiles ?? Number.POSITIVE_INFINITY))
  }, [providers, providerType, sortBy])
  const pageCount = Math.max(1, Math.ceil(visibleProviders.length / pageSize))
  const pagedProviders = visibleProviders.slice((page - 1) * pageSize, page * pageSize)

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
    setPage(1)
    setStep('results')
    window.scrollTo({ top: 0, behavior: 'smooth' })

    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    void saveSearch({ plan, specialty, zip, radius, remainingDeductible }).catch(() => undefined)

    try {
      const result = await searchProviders(specialty, zip, radius, controller.signal)
      setProviders(result.providers)
      setResultCount(result.total)
      setLocation(result.location)
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
        <nav><a href="/#how">How it works</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><span><ShieldCheck size={15} /> PDF stays in your browser</span></nav>
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
              <div className="two-fields">
                <label className="field"><span>Your ZIP code</span><div><LocateFixed size={19} /><input aria-label="ZIP code" value={zip} onChange={(event) => setZip(event.target.value.replace(/\D/g, '').slice(0, 5))} inputMode="numeric" placeholder="5-digit ZIP" /></div></label>
                <label className="field"><span>Search radius</span><div><LocateFixed size={19} /><select aria-label="Search radius" value={radius} onChange={(event) => setRadius(Number(event.target.value))}>{[5, 10, 25, 50, 100].map((miles) => <option value={miles} key={miles}>{miles} miles</option>)}</select><ChevronDown size={18} /></div><small>Distance is estimated from ZIP-code centers.</small></label>
              </div>
              {plan && <label className="field deductible-field"><span>Deductible remaining</span><div><span className="dollar">$</span><input type="number" min="0" value={remainingDeductible} onChange={(event) => setRemainingDeductible(Math.max(0, Number(event.target.value)))} /></div><small>Used only as context; CMS does not publish visit prices.</small></label>}
              {plan ? (
                <div className="plan-pill"><ShieldCheck size={18} /><div><strong>Using {plan.planName}</strong><span>{specialistBenefit(plan)} · Network still needs verification</span></div><button onClick={() => setStep('plan')}>Review</button></div>
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
            <div className="results-heading"><div><span className="eyebrow">CMS NPI Registry</span><h1>{specialty} near {location || zip}</h1><p>{loading ? 'Searching the national provider registry…' : error ? 'The search could not be completed.' : `${resultCount} provider${resultCount === 1 ? '' : 's'} within ${radius} miles`}</p></div><button className="outline-button" onClick={() => { setStep('search'); setError('') }}><Search size={16} /> Edit search</button></div>
            <div className="estimate-note"><Info size={18} /><div><strong>A directory listing is not proof of coverage.</strong><p>Call the provider and your insurer before care. Ask about network participation, referral rules, availability, and your expected price.</p></div></div>
            {!loading && !error && providers.length > 0 && <div className="result-controls">
              <span>Showing {visibleProviders.length} of {providers.length}</span>
              <label>Provider type <select value={providerType} onChange={(event) => { setProviderType(event.target.value as typeof providerType); setPage(1) }}><option value="all">All</option><option value="individual">Individual</option><option value="organization">Organization</option></select></label>
              <label>Sort <select value={sortBy} onChange={(event) => { setSortBy(event.target.value as typeof sortBy); setPage(1) }}><option value="distance">Nearest</option><option value="name">Name A–Z</option></select></label>
            </div>}
            <div className="results-layout">
              <div className="provider-list" aria-live="polite">
                {loading && <div className="loading-state"><LoaderCircle className="spinner" size={32} /><h3>Finding providers near you</h3><p>Checking current public CMS registry records…</p></div>}
                {!loading && error && <div className="empty-state error-state"><Info size={30} /><h3>We couldn’t load the directory</h3><p>{error}</p><button className="primary-button" onClick={findCare}><RefreshCw size={16} /> Try again</button></div>}
                {!loading && !error && pagedProviders.map((provider) => <ProviderCard provider={provider} key={provider.npi} />)}
                {!loading && !error && providers.length === 0 && <div className="empty-state"><Stethoscope size={30} /><h3>No matching providers found</h3><p>Try a nearby ZIP code or a broader specialty such as Primary care.</p><button className="outline-button" onClick={() => setStep('search')}><Search size={16} /> Change search</button></div>}
                {!loading && !error && providers.length > 0 && visibleProviders.length === 0 && <div className="empty-state"><Stethoscope size={30} /><h3>No providers match this filter</h3><p>Choose “All” provider types to see every nearby record.</p><button className="outline-button" onClick={() => setProviderType('all')}>Clear filter</button></div>}
                {!loading && !error && visibleProviders.length > pageSize && <div className="pagination"><button className="outline-button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button><span>Page {page} of {pageCount}</span><button className="outline-button" disabled={page === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next</button></div>}
              </div>
              <aside>
                {plan ? <>
                  <span className="eyebrow">Your plan context</span><h3>Questions to ask</h3>
                  <div className="math-row"><span>Specialist benefit</span><strong>{specialistBenefit(plan)}</strong></div>
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
        <HowItWorks />
      </main>

      <SiteFooter />
    </div>
  )
}

export default function App() {
  if (window.location.pathname === '/privacy' || window.location.hash === '#privacy') return <LegalPage page="privacy" />
  if (window.location.pathname === '/terms' || window.location.hash === '#terms') return <LegalPage page="terms" />
  return <CareApp />
}
