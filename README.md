# Skylark Drones — Monday.com Business Intelligence Agent

> Founder-level conversational BI across **Deals** and **Work Orders**, powered by live monday.com data and Gemini-assisted analysis.

![Status](https://img.shields.io/badge/status-prototype-success)
![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite-61DAFB)
![Backend](https://img.shields.io/badge/backend-Express-000000)
![Data](https://img.shields.io/badge/data-monday.com-FF3D57)
![AI](https://img.shields.io/badge/AI-Google%20Gemini-8E75B2)

## What this project does

This prototype turns messy operational and sales data in monday.com into an executive-friendly conversational interface. A founder can ask questions such as:

- **“How is the Mining pipeline looking this quarter?”**
- **“Which sectors have the strongest pipeline?”**
- **“What are our biggest operational and billing risks?”**
- **“Prepare a leadership update for the current quarter.”**

The agent dynamically reads the two monday.com boards, maps columns by their human-readable titles, passes the live records to Gemini, and uses Python code execution for deterministic calculations.

## Architecture

```text
                 Founder / Evaluator
                         |
                         v
               React + Vite frontend
                         |
                    HTTPS / JSON
                         |
                         v
                  Express backend
                    /          \
                   /            \
                  v              v
          monday.com API      Gemini API
          Deals + Work       Analysis + code
            Orders              execution
                  \              /
                   \            /
                    v          v
                  Executive answer
```

### Key design choices

**Dynamic monday.com reads**  
The backend queries board metadata and item data at runtime. Business records are not hardcoded into the application.

**Resilient data handling**  
The agent tolerates blank values, inconsistent dates, text variation, and numeric formatting issues instead of assuming clean source data.

**Deterministic analytics**  
The model is used for interpretation and orchestration, while calculations are performed programmatically so financial and operational metrics do not depend on mental arithmetic by the LLM.

**Leadership-ready output**  
The application includes an Executive Update workflow that summarizes pipeline, operations, billing, collections, risks, and material caveats in a format suitable for leadership communication.

## Monday.com boards used

The prototype is configured for the assignment boards:

- **Deals:** `5030969646`
- **Work Orders:** `5030970264`

These IDs are configuration values, not hardcoded business records. The app still reads the current data from monday.com.

## Setup

### 1. Requirements

- Node.js 18+
- npm 9+
- A monday.com account with access to the two boards
- A monday.com API token with read access
- A Google Gemini API key

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
MONDAY_API_TOKEN=your_monday_api_token
MONDAY_DEALS_BOARD_ID=5030969646
MONDAY_WORK_ORDERS_BOARD_ID=5030970264
GEMINI_API_KEY=your_gemini_api_key
```

> **Security:** Never commit `.env` or API keys to GitHub. The repository `.gitignore` already excludes environment files.

### 4. Run locally

Development:

```bash
npm run dev
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:3000`

Production:

```bash
npm run build
npm start
```

### 5. Windows quick start

Run:

```text
start.bat
```

This builds the frontend, starts the Express server, and opens a localhost.run HTTPS tunnel for temporary sharing.

## How the agent answers questions

1. The user asks a natural-language business question.
2. The backend retrieves current Deals and Work Orders records from monday.com.
3. Board columns are resolved dynamically from monday.com metadata.
4. The data is flattened and normalized for analysis.
5. Gemini interprets the intent and generates an analysis strategy.
6. Python code execution is used for aggregations and calculations.
7. The final answer is returned with business context and, where relevant, calculation/evidence information.

## Error handling

The prototype explicitly handles:

- Missing credentials
- Missing board IDs
- monday.com API errors
- Inaccessible boards
- Empty or partially populated columns
- Large payloads
- Invalid user requests
- Missing numeric/date values

The UI reports connection and analysis failures instead of silently returning invented metrics.

## Suggested evaluator demo

After configuring the credentials, try these in order:

1. **How is our pipeline looking for the Mining sector this quarter?**
2. **Which sectors have the strongest pipeline?**
3. **How much pipeline is open and what is the weighted pipeline?**
4. **What are the biggest operational and billing risks?**
5. **Prepare a leadership update for the current quarter.**

## Assignment alignment

| Requirement | Implementation |
|---|---|
| Conversational interface | React chat UI with presets |
| monday.com integration | GraphQL API, dynamic board/item reads |
| Read-only behavior | No write/mutation operations against monday.com |
| Data resilience | Normalization and null-safe analysis |
| Query understanding | Gemini natural-language interpretation |
| BI metrics | Pipeline, sectors, operations, billing, collections |
| Cross-board analysis | Deals + Work Orders in the same workflow |
| Error handling | API, validation, and UI error states |
| Leadership updates | Dedicated Executive Update flow |

## Repository contents

- `src/` — React frontend
- `server.js` — Express API and monday.com/Gemini integration
- `README.md` — setup and architecture guide
- `DECISION_LOG.md` — assumptions, trade-offs, and leadership-update interpretation
- `start.bat` — Windows convenience launcher

## Security note

The first development archive contained a test token in the client source. That secret has been removed before publication. Use a fresh token locally and keep it outside version control.

## Author

**K. Adithya**

Skylark Drones technical assignment prototype.
