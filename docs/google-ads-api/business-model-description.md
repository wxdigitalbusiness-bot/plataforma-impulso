# Business Model Description — Google Ads API Basic Access Application

**Applicant:** Marketing Impulso (Brazil)
**MCC ID:** 825-993-9796
**Permissible Use:** Reporting

---

## Form field: "Business Model Description"

> Marketing Impulso is a Brazilian digital marketing agency that manages paid media campaigns on behalf of small and mid-sized advertisers across Search, Performance Max, Display, Shopping, and Video. We are building an internal multi-client reporting dashboard, used exclusively by our own agency staff, that consolidates campaign performance, account budgets, and spend pacing across all client accounts linked to our MCC (825-993-9796). The Google Ads API is used in read-only mode: we issue `GoogleAdsService.SearchStream` and `customer.account_budgets` queries on a scheduled basis (hourly during business hours) to cache metrics in our own PostgreSQL database, which then powers the dashboard UI and triggers internal balance-low alerts to our account managers via WhatsApp. No campaign editing, account creation, or bulk write operations are performed through the API. All client accounts are formally linked to our MCC and we hold written authorization from each advertiser to access their data.

---

**Word count:** ~155 words

**Why this text works:**

- Identifies company, country, and client profile clearly
- States permissible use category explicitly (reporting / read-only)
- Names the specific endpoints used (signals the reviewer that you know the API)
- Mentions the MCC ID and that accounts are linked (one of the eligibility checks)
- States who uses the tool (internal staff only — matches "Internal users only" radio button)
- Closes by explicitly excluding write operations (reinforces low-risk profile)
- Mentions client authorization (compliance signal)
