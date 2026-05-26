# Design Documentation — Marketing Impulso Reporting Dashboard

**Prepared for:** Google Ads API — Basic Access Application
**Applicant:** Marketing Impulso
**MCC ID:** 825-993-9796
**Date:** May 2026
**Permissible Use Requested:** Reporting (read-only)

---

## 1. Executive Summary

Marketing Impulso is a Brazilian digital marketing agency. We are building an **internal reporting dashboard** ("Plataforma Impulso") used exclusively by our own staff to monitor paid-media performance across the client accounts linked to our manager account (MCC `825-993-9796`).

The tool is **not** distributed to clients, **not** white-labeled, **not** resold, and performs **no write operations** on Google Ads accounts. All API calls are read-only reporting queries (`GoogleAdsService.SearchStream` and `account_budget` resource via GAQL).

This document describes the architecture, data flows, security posture, rate-limit strategy, and compliance controls of the application.

---

## 2. Business Context

| Item | Value |
|---|---|
| Company | Marketing Impulso |
| Country | Brazil |
| Business model | Digital marketing agency (paid media management) |
| Number of staff | Small team (< 10 internal users of the tool) |
| Number of client Google Ads accounts | ~10–30 (all linked to MCC `825-993-9796`) |
| Client authorization | Written authorization on file for every linked account |
| Public website | https://marketingimpulso.com |
| API contact email | wxdigitalbusiness@gmail.com |

---

## 3. System Architecture

### 3.1 High-level diagram

```
                        ┌─────────────────────────────────────────────┐
                        │           AGENCY STAFF (internal only)      │
                        │     Authenticated via internal login        │
                        └────────────────────┬────────────────────────┘
                                             │ HTTPS
                                             ▼
                       ┌──────────────────────────────────────────────┐
                       │      Next.js Web App (Plataforma Impulso)    │
                       │      - Multi-client dashboard UI             │
                       │      - Reads ONLY from local Postgres cache  │
                       │      - Never calls Google Ads API directly   │
                       └────────────────────┬─────────────────────────┘
                                            │ SQL (read)
                                            ▼
                       ┌──────────────────────────────────────────────┐
                       │       PostgreSQL (EasyPanel, managed)        │
                       │  Tables: clientes_ativos, alertas_saldo_log  │
                       │  Cached metrics with TTL                     │
                       └────────────────────▲─────────────────────────┘
                                            │ INSERT/UPDATE
                                            │
                       ┌────────────────────┴─────────────────────────┐
                       │            n8n Orchestration Layer           │
                       │   Scheduled workflows (cron, business hours) │
                       │   sync-google-ads.workflow.js                │
                       │   alerta-google-ads.workflow.js              │
                       └────────────────────┬─────────────────────────┘
                                            │ HTTPS (read-only GAQL)
                                            ▼
                       ┌──────────────────────────────────────────────┐
                       │         Google Ads API (v17)                 │
                       │   GoogleAdsService.SearchStream              │
                       │   account_budget resource                    │
                       └──────────────────────────────────────────────┘
```

### 3.2 Components

| Component | Technology | Purpose |
|---|---|---|
| Web frontend | Next.js 15 (App Router) + TypeScript | Renders the dashboard UI for internal staff |
| ORM | Prisma | Type-safe access to PostgreSQL |
| Database | PostgreSQL (managed on EasyPanel) | Stores client registry and cached metrics |
| Orchestration | n8n (self-hosted) | Schedules and executes API sync workflows |
| Auth (staff) | Internal email/password with session cookies | Restricts dashboard to agency employees |
| Hosting | EasyPanel VPS (Brazil region) | Single-tenant deployment |

**Important:** The Next.js application **never calls the Google Ads API directly**. All API access is funneled through n8n workflows, which makes rate-limit accounting and credential isolation straightforward.

---

## 4. Google Ads API Usage

### 4.1 Endpoints and resources used

| Endpoint / Resource | Operation | Frequency | Purpose |
|---|---|---|---|
| `customers/{customer_id}/googleAds:searchStream` | Read | Hourly, 08:00–19:00, Mon–Fri (BR time) | Fetch account budget and currency for each linked client |
| `account_budget` resource (via GAQL) | Read | (same as above) | Pull `approved_spending_limit_micros`, `amount_served_micros`, `status` |
| `customer.currency_code` | Read | (same as above) | Resolve currency for correct balance formatting |

### 4.2 Example GAQL query

```sql
SELECT
  customer.currency_code,
  account_budget.approved_spending_limit_micros,
  account_budget.amount_served_micros
FROM account_budget
WHERE account_budget.status = 'APPROVED'
```

### 4.3 Operations per day (estimate)

- **Linked clients:** 30 (upper bound)
- **Sync windows per day:** 12 (hourly, 08:00–19:00 BR)
- **Queries per sync per client:** 1
- **Estimated daily operations:** 30 × 12 = **360 ops/day**

This is well under the Basic Access daily quota of 15,000 operations.

### 4.4 Operations NOT performed

The following are **explicitly out of scope** for this application:

- No `MutateOperation` calls of any kind
- No campaign, ad group, ad, asset, or keyword creation
- No bid or budget modification
- No account creation, linking, or unlinking
- No conversion uploads
- No customer match / audience uploads
- No Smart Bidding / experiment operations

---

## 5. Authentication & Authorization

### 5.1 OAuth 2.0 flow (Google Ads API)

1. The MCC owner (`wxdigitalbusiness@gmail.com`) completes the OAuth 2.0 consent flow once, granting scope `https://www.googleapis.com/auth/adwords`.
2. The resulting **refresh token** is stored encrypted as a server-side secret (n8n credential vault / environment variable). It is **never** exposed to the browser or to client accounts.
3. Each scheduled sync exchanges the refresh token for a short-lived access token via `https://oauth2.googleapis.com/token`.
4. The access token is used only for the duration of that sync run (typically < 60 seconds) and discarded.

### 5.2 Internal staff authentication

- Agency staff authenticate to the dashboard via email/password.
- Sessions use HTTP-only, secure, SameSite=Lax cookies.
- The dashboard is reachable only by authenticated staff; there is no public/anonymous view.
- The application is **single-tenant** (Marketing Impulso only). External clients do not have accounts.

### 5.3 Authorization between staff and client data

- Every linked Google Ads account in our MCC has documented written authorization from the advertiser.
- All staff currently have full read access to all client metrics inside the dashboard, since they all work on these accounts in the normal course of business. Role-based access control may be added later.

---

## 6. Data Storage & Retention

### 6.1 What we cache locally

The PostgreSQL `clientes_ativos` table stores, **per client**:

- `google_ad_customer_id` — the linked Google Ads customer ID
- `ultimo_saldo_google` — last fetched account balance (numeric)
- `ultimo_tipo_conta_google` — account billing type label
- `saldo_google_atualizado_em` — timestamp of last sync
- `ultimo_erro_google` — last API error message, if any
- `limite_minimo_google` — internal alert threshold (not from Google)

We do **not** cache personally identifiable information (PII) about end-users of the advertiser, conversion data, audience lists, or any data subject to the Customer Match policy.

### 6.2 Retention

- Cached metrics are overwritten on every sync (1-hour cadence) — no historical aggregation is stored long-term in v1.
- Alert logs (`alertas_saldo_log`) are retained for operational audit purposes for 90 days, then pruned.

### 6.3 Data residency

All cached data resides in PostgreSQL hosted on EasyPanel infrastructure in Brazil.

---

## 7. Rate Limiting & Error Handling

### 7.1 Self-imposed limits

- Hard cap: 1 query per client per sync window (no fan-out).
- Sync windows are spaced 1 hour apart and limited to business hours (Mon–Fri, 08:00–19:00 BRT).
- Maximum daily operations remain at ~360 (≈ 2.4% of the Basic Access daily quota).

### 7.2 Error handling

- Transient errors (5xx, network timeouts): logged to `ultimo_erro_google`, no retry within the same hour. Next scheduled run retries naturally.
- `QuotaError` / `RESOURCE_EXHAUSTED`: workflow halts and emits an internal alert; we do not auto-retry to avoid amplifying quota pressure.
- `AuthenticationError` / `AuthorizationError`: workflow halts; staff is notified to re-consent.
- Errors are persisted per-client so the dashboard can surface "stale data" indicators to staff.

### 7.3 Backoff strategy

Because each client is queried at most once per hour, no in-loop retries or aggressive backoff are required. The hourly cron provides natural spacing.

---

## 8. Security

| Control | Implementation |
|---|---|
| Developer token storage | Server-side environment variable (n8n credentials vault). Never sent to browser. |
| OAuth refresh token storage | Server-side encrypted credential in n8n. Never logged. |
| Transport | All API traffic over HTTPS/TLS 1.2+ |
| Database access | Only the n8n service and the Next.js server can connect; no public ingress. |
| Staff login | HTTP-only secure cookies; passwords hashed with bcrypt (cost ≥ 10) |
| Audit logging | All scheduled API calls log a row with client ID, timestamp, status, and error (if any) |
| Source control | Private repository; secrets excluded via `.gitignore` |
| Secret rotation | OAuth refresh token and developer token are rotatable from the operator console without redeploy |

---

## 9. Compliance with Google Ads API Policies

We have reviewed and will comply with:

- **API Terms of Service** — accepted by MCC owner
- **Required Minimum Functionality (RMF)** — N/A for read-only Reporting use case, but acknowledged
- **System Name disclosure** — every request sets a stable `User-Agent` identifying "Plataforma Impulso / Marketing Impulso"
- **Permissible Use** — application is exclusively Reporting; no Ad Management or Keyword Research operations
- **Data handling** — we do not redistribute Google Ads data to third parties; data stays inside the agency
- **Customer Match / sensitive data** — not used

---

## 10. Roadmap (out of scope for current Basic Access request)

The following are *possible* future capabilities. If/when we add any of them, we will re-apply for the appropriate access level (e.g., Standard Access for unlimited operations or for any write-side functionality):

- Campaign performance time-series (would still be read-only)
- Multi-currency consolidated reporting
- Daily PDF reports emailed to internal account managers

We are **not** requesting access for these capabilities at this time.

---

## 11. Contact

| | |
|---|---|
| Company | Marketing Impulso |
| Website | https://marketingimpulso.com |
| API contact email | wxdigitalbusiness@gmail.com |
| MCC ID | 825-993-9796 |
| Country | Brazil |

---

*End of document.*
