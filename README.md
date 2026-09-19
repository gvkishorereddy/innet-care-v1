# InNet — Version 2.1

InNet is an insurance-aware care finder that also works without insurance or a plan document. It can explain key benefits from an uploaded SBC/EOC and search current public provider records by specialty and ZIP code.

**Live website:** https://venkatabuilds.com/

## What works

- Live provider search through the official CMS NPI Registry
- Search without insurance or a PDF
- Search after uploading an insurance plan
- Client-side PDF text extraction (the document is not uploaded)
- Label-specific extraction of individual/family deductible, individual/family out-of-pocket maximum, PCP, specialist, urgent care, emergency room, common prescription tiers, and referral language
- Exact page citations for every extracted value; unverified fields stay explicitly unknown
- Real provider names, specialties, practice addresses, phone numbers, and NPIs
- Verified US ZIP lookup, 5–100 mile radius filtering, ZIP-centroid distance estimates, provider-type filters, sorting, and pagination
- Call, map directions, and official NPI-record actions
- Invalid ZIP, unsupported specialty, scanned PDF, timeout, API failure, and no-result states
- Privacy and terms pages, working navigation, and an application footer
- Minimal search-history settings stored only in the browser; PDFs and extracted benefits are never sent to InNet
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
- Zippopotam.us postal data for US ZIP validation and ZIP-centroid distance estimates
- Browser local storage for up to ten recent non-medical search settings
- Vitest and ESLint for automated checks
- Vercel for the frontend and serverless API

The serverless proxy is necessary because the CMS registry does not allow browser requests directly from arbitrary origins.

## Run locally

```bash
pnpm install
pnpm dev
```

The Vite development server runs the frontend. To exercise the serverless route locally, use a Vercel-compatible development environment or deploy a preview.

## Production roadmap

- Add insurer directory APIs for verified member-specific network status
- Add payer Transparency in Coverage data for procedure-level negotiated rates
- Add member authentication and current deductible accumulators
- Add OCR for image-only insurance PDFs
- Add appointment availability integrations
- Complete third-party legal, accessibility, security, and clinical-safety reviews
