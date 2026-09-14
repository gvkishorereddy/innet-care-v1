# InNet — Version 1

InNet is an insurance-aware care finder. It reads a Summary of Benefits and Coverage (SBC) or Evidence of Coverage (EOC), extracts key plan rules, and ranks provider options by estimated out-of-pocket cost.

**Live website:** https://venkatabuilds.com/

## Version 1 features

- Client-side PDF text extraction
- Heuristic extraction of deductible, out-of-pocket maximum, specialist copay/coinsurance, and referral language
- Page-level citations for extracted plan details
- Specialty and ZIP-code search flow
- Deterministic out-of-pocket cost estimates
- Cost-ranked provider cards with network confidence and facility-fee warnings
- Responsive, accessible interface
- Built-in synthetic sample plan and provider data for a reliable demo
- Optional Supabase persistence, with a local-storage fallback

## Important scope

The bundled provider directory and negotiated rates are **synthetic demo data**. InNet does not provide medical advice or guarantee coverage. A real deployment must connect to current insurer provider directories and Transparency in Coverage rate data, authenticate members, protect health information, and require users to confirm network status and prices.

## Run locally

```bash
pnpm install
pnpm dev
```

Then open the URL printed by Vite.

## Optional Supabase setup

The application works without a database. When Supabase environment variables are absent, recent searches are stored locally in the browser.

1. Create a free Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in its SQL editor.
3. Copy `.env.example` to `.env.local`.
4. Add your project URL and anon key:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

The Version 1 policy allows anonymous inserts but does not allow anonymous reads. Add authentication and user-owned row-level-security policies before storing real data.

## Cost model

When a fixed specialist copay exists:

```text
estimated payment = specialist copay + possible facility fee
```

Otherwise:

```text
deductible portion = min(remaining deductible, negotiated rate)
post-deductible amount = negotiated rate - deductible portion
estimated payment = deductible portion + post-deductible amount × coinsurance + facility fee
```

The UI displays a range around the estimate to communicate uncertainty.

## Next production steps

- Replace demo providers with insurer directories or CMS provider APIs
- Ingest Transparency in Coverage machine-readable rate files
- Add member authentication and deductible accumulators
- Add OCR for scanned PDFs
- Resolve procedure codes before comparing costs
- Add appointment availability integrations
- Conduct legal, privacy, accessibility, and security reviews

## Tech stack

React 19, TypeScript, Vite, PDF.js, Supabase, Vitest, and Lucide icons.
