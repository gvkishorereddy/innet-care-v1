# InNet — Version 2

InNet is an insurance-aware care finder that also works without insurance or a plan document. It can explain key benefits from an uploaded SBC/EOC and search current public provider records by specialty and ZIP code.

**Live website:** https://venkatabuilds.com/

## What works

- Live provider search through the official CMS NPI Registry
- Search without insurance or a PDF
- Search after uploading an insurance plan
- Client-side PDF text extraction (the document is not uploaded)
- Heuristic extraction of deductible, out-of-pocket maximum, specialist copay/coinsurance, and referral language
- Page-level citations for extracted plan details
- Real provider names, specialties, practice addresses, phone numbers, and NPIs
- Call, map directions, and official NPI-record actions
- Invalid ZIP, unsupported specialty, scanned PDF, timeout, API failure, and no-result states
- Optional Supabase search-history persistence with a local-storage fallback
- Responsive interface for phones, tablets, and desktops

## Data honesty

CMS NPI Registry data identifies registered providers. It does **not** show whether a provider:

- is in a particular insurance network;
- is accepting new patients;
- has an available appointment;
- charges a particular price; or
- has a particular rating or quality score.

InNet never invents those values. Users are prompted to verify the exact NPI and location with the provider and insurer before receiving care. InNet does not provide medical advice or guarantee coverage.

## Architecture

- React 19, TypeScript, and Vite frontend
- PDF.js for in-browser document reading
- `/api/providers` serverless function as a same-origin, cached proxy to the CMS NPI Registry API
- Supabase is optional; local storage is used when credentials are absent
- Vitest and ESLint for automated checks
- Vercel for the frontend and serverless API

The serverless proxy is necessary because the CMS registry does not allow browser requests directly from arbitrary origins.

## Run locally

```bash
pnpm install
pnpm dev
```

The Vite development server runs the frontend. To exercise the serverless route locally, use a Vercel-compatible development environment or deploy a preview.

## Optional Supabase setup

The application works without a database. When Supabase environment variables are absent, up to ten recent searches are stored on the user’s device.

1. Create a free Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in its SQL editor.
3. Add these values to `.env.local`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

The current policy allows anonymous inserts but not anonymous reads. Add authentication and user-owned row-level-security policies before storing production health or membership data.

## Production roadmap

- Add insurer directory APIs for verified member-specific network status
- Add payer Transparency in Coverage data for procedure-level negotiated rates
- Add member authentication and current deductible accumulators
- Add OCR for image-only insurance PDFs
- Add appointment availability integrations
- Complete legal, privacy, accessibility, and security reviews
