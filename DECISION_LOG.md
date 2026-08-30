# Decision Log — Skylark Drones BI Agent

**Developer:** K. Adithya  
**Assignment:** Monday.com Business Intelligence Agent

## 1. Key assumptions

- The supplied Deals and Work Orders spreadsheets are imported into separate monday.com boards.
- The application identifies fields from monday.com column titles rather than relying on account-specific column IDs.
- Missing values remain unknown; the system does not silently convert missing money, dates, or probabilities into zero.
- High / Medium / Low closure probability is interpreted as 75% / 50% / 25% for weighted-pipeline estimation.
- Read-only access is sufficient for the assignment; the prototype performs no monday.com write operations.

## 2. Technology choices

**React + Vite** provides a lightweight conversational UI that can be customized quickly within the six-hour assignment window.

**Express + Node.js** keeps the monday.com and Gemini calls behind a server boundary and avoids browser CORS limitations.

**Google Gemini with code execution** is used for intent interpretation and analysis orchestration, while programmatic/Python calculations handle aggregation so business metrics are reproducible.

## 3. Trade-offs

- **Real-time fetch vs. persistent database:** real-time reads were chosen because the assignment prioritizes current monday.com information and the supplied dataset is modest. A production system at much larger scale would benefit from cached incremental synchronization.
- **Human-readable column mapping vs. fixed column IDs:** title-based mapping makes the prototype portable across monday.com workspaces, at the cost of needing sensible column names.
- **Single-service prototype vs. separate frontend/backend deployment:** one Express service keeps deployment and evaluation simple.

## 4. Leadership-update interpretation

“Leadership updates” was interpreted as an executive synthesis rather than a raw data dump. The report should cover:

1. **Sales:** pipeline size, weighted pipeline, and sector concentration.
2. **Operations:** active/completed work orders and visible execution bottlenecks.
3. **Cash flow:** billing, collections, receivables, and outstanding value.
4. **Risks/caveats:** material missing fields and data-quality limitations.

The application exposes this as a dedicated Executive Update workflow so the result can be reused in leadership emails, reviews, or slides.

## 5. What I would do with more time

- Add incremental sync/webhooks and a cache for larger boards.
- Add richer visualizations such as pipeline funnels and sector trends.
- Add OAuth-based multi-tenant monday.com authentication.
- Add automated regression tests against anonymized snapshots of board schemas.
