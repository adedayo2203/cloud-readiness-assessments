# ActivEdge Cloud Assessment Portal

> **A production-grade, token-gated cloud readiness assessment platform built for ActivEdge Technologies.**  
> Deployed on Microsoft Azure · Serverless backend · No framework required

-----

## Table of Contents

1. [Project Overview](#1-project-overview)
1. [Architecture](#2-architecture)
1. [Repository Structure](#3-repository-structure)
1. [Assessment Tools](#4-assessment-tools)
1. [Scoring Methodology](#5-scoring-methodology)
1. [Report System](#6-report-system)
1. [Admin Portal](#7-admin-portal)
1. [Azure Backend — Function App](#8-azure-backend--function-app)
1. [Azure Infrastructure Setup](#9-azure-infrastructure-setup)
1. [Local Development](#10-local-development)
1. [Deployment Guide](#11-deployment-guide)
1. [Environment Variables & Configuration](#12-environment-variables--configuration)
1. [Security Considerations](#13-security-considerations)
1. [Known Issues & Lessons Learned](#14-known-issues--lessons-learned)
1. [Future Improvements](#15-future-improvements)
1. [Contributing](#16-contributing)
1. [Contact](#17-contact)

-----

## 1. Project Overview

The **ActivEdge Cloud Assessment Portal** is a full-stack web application that allows ActivEdge Technologies to deliver structured, data-driven cloud readiness assessments to enterprise clients across Africa. It was designed and built to support ActivEdge’s cloud engineering sales and delivery workflow.

### What It Does

- Generates **unique, time-limited, single-use assessment links** for each client from a secure admin portal
- Presents clients with a professional **intake form** (company name, phone, email) before starting
- Delivers two distinct **assessment tools** — one for on-premise migration readiness and one for cloud cost optimisation
- Calculates a **Cloud Readiness Index (CRI)** score based on weighted domain scoring
- Presents a **client-facing report** with strengths, gaps, strategic observations, and recommendations
- Stores an **admin-only implementation guide** alongside each submission with detailed technical steps, tools, phases, and timelines
- Saves all submissions to **Azure Blob Storage** and surfaces them in the admin portal in real time
- Supports **export** of all submissions as JSON or CSV

### Business Context

This tool was built to:

1. Standardise and scale how ActivEdge delivers pre-sales cloud readiness assessments
1. Generate credible, data-backed CRI scores that support the business case for cloud migration
1. Gate the assessment behind unique links so only invited clients can access it
1. Give the ActivEdge team instant visibility into client results from anywhere

-----

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT BROWSER                          │
│   index.html → assessment-onprem.html / assessment-cloud.html   │
└───────────────────────┬─────────────────────────────────────────┘
                        │ HTTPS
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│              AZURE BLOB STORAGE — Static Website                │
│   https://activedgeassess.z1.web.core.windows.net               │
│   Container: $web                                               │
│   Files: index.html, assessment-onprem.html,                    │
│           assessment-cloud.html, admin.html                     │
└───────────────────────┬─────────────────────────────────────────┘
                        │ fetch() API calls
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│              AZURE FUNCTION APP — ae-assessment-fn              │
│   Runtime: Node.js 20 · Functions v4 · Linux Consumption Plan   │
│                                                                 │
│   /api/validate-token    GET  — Check token validity            │
│   /api/create-token      POST — Admin creates new link          │
│   /api/submit-assessment POST — Save completed assessment       │
│   /api/list-submissions  GET  — Admin fetches all submissions   │
│   /api/delete-submission POST — Admin deletes a submission      │
│   /api/delete-token      POST — Admin deletes a generated link  │
└───────────────────────┬─────────────────────────────────────────┘
                        │ Azure Storage SDK
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│              AZURE BLOB STORAGE — Data Containers               │
│   Account: activedgeassess                                      │
│   Container: tokens      — Token JSON files (one per link)      │
│   Container: submissions — Submission JSON files (one per sub)  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Architecture Decisions

|Decision                                              |Rationale                                                                         |
|------------------------------------------------------|----------------------------------------------------------------------------------|
|Azure Blob Storage for static hosting                 |No web server to manage; global CDN-ready; near-zero cost                         |
|Azure Functions Consumption Plan                      |Scales to zero when idle; first 1M executions/month free                          |
|Functions v4 programming model (single `src/index.js`)|Required for Node 20 compatibility on Linux Consumption Plan                      |
|No database — JSON blobs in storage                   |Simplifies architecture; submissions are read infrequently; zero schema management|
|Token-gated links                                     |Prevents public access; enables per-client tracking and expiry enforcement        |
|Password-protected admin portal                       |Simple client-side gate; admin.html is not linked from public pages               |

-----

## 3. Repository Structure

```
activedge-assessment/
│
├── index.html                  # Landing page + client intake modal + token validation
├── assessment-onprem.html      # On-Premise to Cloud Migration assessment (40 questions, 7 domains)
├── assessment-cloud.html       # Cloud Cost & Optimisation assessment (30 questions, 6 domains)
├── admin.html                  # Admin portal — link generation, submissions, export
├── azure-hosting-guide.html    # Interactive step-by-step Azure deployment guide
│
├── ae-functions/               # Azure Function App backend
│   ├── src/
│   │   └── index.js            # All 6 API functions (v4 programming model)
│   ├── host.json               # Functions host configuration
│   ├── package.json            # Dependencies (@azure/functions, @azure/storage-blob)
│   └── local.settings.json     # Local dev environment variables (not committed)
│
└── README.md                   # This file
```

-----

## 4. Assessment Tools

### 4.1 On-Premise to Cloud Migration Assessment

**File:** `assessment-onprem.html`  
**Purpose:** Evaluates an organisation’s readiness to migrate from on-premise infrastructure to cloud  
**Questions:** 40 questions across 7 domains  
**Output:** Cloud Readiness Index (CRI) as a percentage

|Domain                                  |Weight|Questions|
|----------------------------------------|------|---------|
|Infrastructure & Server Environment     |20%   |6        |
|Network & Connectivity                  |12%   |5        |
|Security & Compliance                   |18%   |7        |
|Data Management & Storage               |15%   |6        |
|Application Portfolio & Modernisation   |15%   |6        |
|IT Governance & Operations              |12%   |5        |
|Business Alignment & Financial Readiness|8%    |5        |

### 4.2 Cloud Cost & Value Optimisation Assessment

**File:** `assessment-cloud.html`  
**Purpose:** Evaluates how well an organisation already on cloud is managing cost, performance, and governance  
**Questions:** 30 questions across 6 domains  
**Output:** Cloud Optimisation Score as a percentage

|Domain                                |Weight|Questions|
|--------------------------------------|------|---------|
|Cloud Cost Structure & FinOps Maturity|22%   |5        |
|Cloud Architecture & Modernisation    |20%   |5        |
|Cloud Security & Governance           |18%   |5        |
|Cloud Operations & Reliability        |18%   |5        |
|Data Platform & Analytics             |12%   |5        |
|Organisational Cloud Maturity         |10%   |5        |

-----

## 5. Scoring Methodology

Each question has 4 answer options scored 0, 1, 2, or 3 (0 = lowest maturity, 3 = highest).

**Domain Score Calculation:**

```
Domain Score (%) = (Sum of question scores in domain / Maximum possible score for domain) × 100
```

**CRI Calculation:**

```
CRI (%) = Sum of (Domain Score × Domain Weight) across all domains
```

**Maturity Classification:**

|CRI Range|Maturity Level|Description                                      |
|---------|--------------|-------------------------------------------------|
|0 – 25%  |Initial       |No meaningful cloud readiness foundation         |
|26 – 50% |Foundational  |Basic awareness; significant gaps to address     |
|51 – 70% |Emerging      |Partial readiness; structured programme needed   |
|71 – 85% |Advanced      |Strong foundation; ready for structured migration|
|86 – 100%|Optimised     |Cloud-native maturity; focus on optimisation     |

-----

## 6. Report System

The assessment generates two separate reports for each submission:

### Client-Facing Report (visible to client after submission)

- CRI score with animated ring visualisation
- Domain score grid with colour-coded status indicators
- Maturity level classification with explanation
- 3–5 key strengths based on high-scoring domains
- 3–5 key gaps with business impact framing
- Strategic observation paragraph
- 4–6 high-level directional recommendations (no implementation specifics — “what”, not “how”)
- Call to action to engage ActivEdge Technologies
- **Intentionally excludes:** specific cloud product names, architecture diagrams, implementation steps, configuration details

### Admin Implementation Guide (admin portal only — never shown to client)

- 4-phase implementation roadmap with specific tools, commands, timelines, and team roles
- Per-phase objectives, key deliverables, and recommended Azure/AWS services
- Full tool reference list by category (IaC, Migration, Security, Monitoring, DevOps, FinOps)
- Total programme timeline estimate
- This data is stored in the submission JSON and surfaced only in the admin portal’s “View Report” modal

-----

## 7. Admin Portal

**File:** `admin.html`  
**URL:** `https://[your-storage-url]/admin.html`  
**Access:** Password-protected (in-page gate; not indexed or linked from public pages)  
**Default password:** `ActivEdge@Admin2025` ← change before production use

### Features

|Feature      |Description                                                                                 |
|-------------|--------------------------------------------------------------------------------------------|
|Dashboard    |Submission count, link count, recent activity summary                                       |
|Generate Link|Create a unique, time-limited assessment link for a named client                            |
|Manage Links |View all generated links, copy URLs, delete expired or unused links                         |
|Submissions  |View all submitted assessments fetched live from Azure Blob Storage                         |
|View Report  |Full submission detail including CRI score, domain breakdown, and admin implementation guide|
|Export Data  |Download all submissions as JSON or CSV                                                     |
|Delete       |🗑 buttons on submissions and links for permanent Azure Blob deletion                        |

### Link Generation

When a link is generated from the admin portal:

1. A unique token is created: `ae_[timestamp_base36]_[6char_random]`
1. A JSON blob is written to the `tokens` container in Azure Blob Storage with metadata (company, email, assessment type, expiry, status: `pending`)
1. A shareable URL is produced: `https://[portal-url]/index.html?token=[token]`
1. When the client opens the link, the token is validated via the `validate-token` function
1. On submission, the token status is updated to `submitted` — preventing reuse

-----

## 8. Azure Backend — Function App

**App name:** `ae-assessment-fn`  
**Runtime:** Node.js 20  
**Functions version:** v4 (single entry point: `src/index.js`)  
**Plan:** Linux Consumption (serverless)  
**Entry file:** `ae-functions/src/index.js`

### Why v4 Programming Model

> ⚠️ **Critical:** Azure Functions on Linux Consumption Plan with Node 20 requires the **v4 programming model** using `app.http()` syntax in a single entry file. The v3 model (`module.exports` + `function.json` files) causes silent `RpcException` / 500 failures on Node 20 with no useful error body returned. This was a significant issue during deployment and the root cause of several 500 errors encountered.

### API Endpoints

|Endpoint                |Method|Auth                |Description                                                             |
|------------------------|------|--------------------|------------------------------------------------------------------------|
|`/api/validate-token`   |GET   |Anonymous           |Validates token: checks existence, expiry, and submission status        |
|`/api/create-token`     |POST  |Anonymous           |Creates a new token blob in storage (called by admin portal)            |
|`/api/submit-assessment`|POST  |Anonymous           |Saves assessment JSON to submissions container; marks token as submitted|
|`/api/list-submissions` |GET   |`x-admin-key` header|Returns all submissions from blob storage sorted by date                |
|`/api/delete-submission`|POST  |`x-admin-key` header|Permanently deletes a submission blob by filename                       |
|`/api/delete-token`     |POST  |`x-admin-key` header|Permanently deletes a token blob by token ID                            |

### Required App Settings

|Setting                       |Value                                           |Description                           |
|------------------------------|------------------------------------------------|--------------------------------------|
|`STORAGE_CONNECTION`          |`DefaultEndpointsProtocol=https;AccountName=...`|Full storage account connection string|
|`AE_ADMIN_KEY`                |`ActivEdge@Admin2025`                           |Admin API authentication key          |
|`FUNCTIONS_WORKER_RUNTIME`    |`node`                                          |Runtime identifier                    |
|`WEBSITE_NODE_DEFAULT_VERSION`|`~20`                                           |Node version pin                      |


> ⚠️ **Known issue with Git Bash (MINGW64):** The connection string contains `=` and `;` characters that Git Bash misinterprets when passed via `az functionapp config appsettings set`. Values appear as `null` in CLI output even when the command reports success. **Always set `STORAGE_CONNECTION` and `AE_ADMIN_KEY` through the Azure Portal UI** under Function App → Environment Variables, not via CLI on Git Bash.

-----

## 9. Azure Infrastructure Setup

### Resources Created

|Resource         |Name                     |Type                                   |
|-----------------|-------------------------|---------------------------------------|
|Resource Group   |`activedge-assessment-rg`|Azure Resource Group                   |
|Storage Account  |`activedgeassess`        |Azure Storage (StorageV2, Standard LRS)|
|Static Website   |`$web` container         |Azure Blob Storage static website      |
|Submissions Store|`submissions` container  |Private blob container                 |
|Token Store      |`tokens` container       |Private blob container                 |
|Function App     |`ae-assessment-fn`       |Azure Function App (Linux, Consumption)|
|Function Storage |`activedgefnstorage`     |Azure Storage (internal Functions use) |

### Portal URL

```
https://activedgeassess.z1.web.core.windows.net
```

### Admin URL

```
https://activedgeassess.z1.web.core.windows.net/admin.html
```

### CORS Configuration

The Function App must allow requests from the storage website origin. Current allowed origins:

```
https://activedgeassess.z1.web.core.windows.net   ← primary portal URL
https://activedgeassess.z6.web.core.windows.net   ← legacy entry (safe to keep)
http://localhost:3000                              ← local development
https://assessment.activedgetechnologies.com       ← custom domain (future)
*                                                  ← wildcard (can be removed once stable)
```

> ⚠️ Do not include trailing slashes in CORS origins. Azure rejects them silently — requests still fail with CORS errors despite the origin appearing in the list.

-----

## 10. Local Development

### Prerequisites

- Node.js 20+
- Azure Functions Core Tools v4: `npm install -g azure-functions-core-tools@4`
- Azure CLI: `az login`
- A storage account with `tokens` and `submissions` containers

### Running Locally

```bash
# Clone the repo
git clone https://github.com/activedge/cloud-assessment-portal.git
cd cloud-assessment-portal

# Install function dependencies
cd ae-functions
npm install

# Configure local settings
# Edit local.settings.json:
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "STORAGE_CONNECTION": "YOUR_CONNECTION_STRING",
    "AE_ADMIN_KEY": "ActivEdge@Admin2025",
    "WEBSITE_NODE_DEFAULT_VERSION": "~20"
  }
}

# Start the function app locally
func start

# In a separate terminal, serve the HTML files
# Any static file server works, e.g.:
npx serve .. --port 3000
```

The portal will be available at `http://localhost:3000`.

> **Note:** When running locally, set `FUNCTION_BASE` in each HTML file to `http://localhost:7071` (the default local Functions port) or use the `window.FUNCTION_BASE` override.

-----

## 11. Deployment Guide

### Step 1 — Deploy Static Files to Azure

```bash
cd /path/to/activedge-assessment

# Upload all HTML files to the $web container
for file in index.html assessment-onprem.html assessment-cloud.html admin.html; do
  az storage blob upload \
    --account-name activedgeassess \
    --container-name '$web' \
    --name "$file" \
    --file "$file" \
    --content-type text/html \
    --overwrite
done
```

### Step 2 — Deploy Azure Functions

```bash
cd ae-functions
npm install
func azure functionapp publish ae-assessment-fn --build remote
```

### Step 3 — Set App Settings (Use Azure Portal — not CLI on Git Bash)

Navigate to: **portal.azure.com → ae-assessment-fn → Environment Variables → App Settings**

Add or verify these settings:

|Name                          |Value                                      |
|------------------------------|-------------------------------------------|
|`STORAGE_CONNECTION`          |Full connection string from storage account|
|`AE_ADMIN_KEY`                |`ActivEdge@Admin2025`                      |
|`FUNCTIONS_WORKER_RUNTIME`    |`node`                                     |
|`WEBSITE_NODE_DEFAULT_VERSION`|`~20`                                      |

Click **Save** after adding all settings.

### Step 4 — Configure CORS

```bash
az functionapp cors add \
  --name ae-assessment-fn \
  --resource-group activedge-assessment-rg \
  --allowed-origins "https://activedgeassess.z1.web.core.windows.net"
```

### Step 5 — Verify Deployment

```bash
# Check all functions are registered
az functionapp function list \
  --name ae-assessment-fn \
  --resource-group activedge-assessment-rg \
  --output table

# Test submit-assessment endpoint
curl -X POST https://ae-assessment-fn.azurewebsites.net/api/submit-assessment \
  -H "Content-Type: application/json" \
  -d '{"clientCompany":"Test","type":"onprem","cri":50}'

# Expected: {"success":true,"filename":"..."}
```

-----

## 12. Environment Variables & Configuration

### HTML Files — FUNCTION_BASE

Each HTML file contains a `FUNCTION_BASE` variable that must point to your deployed Function App URL:

```javascript
// In index.html and admin.html:
const FUNCTION_BASE = window.FUNCTION_BASE || 'https://ae-assessment-fn.azurewebsites.net';

// In assessment-onprem.html and assessment-cloud.html:
const fnUrl = 'https://ae-assessment-fn.azurewebsites.net/api/submit-assessment';
```

### Admin Portal — Password

```javascript
// In admin.html — change before deploying to production:
const ADMIN_PASSWORD = "";
```

### Admin API Key

The `AE_ADMIN_KEY` in the Function App must match the key sent in the `x-admin-key` request header from `admin.html`. Both must be identical for the `list-submissions`, `delete-submission`, and `delete-token` endpoints to work.

-----

## 13. Security Considerations

### Current Security Model

|Layer             |Mechanism                                                                 |
|------------------|--------------------------------------------------------------------------|
|Client portal     |Token-gated: unique URL required to access assessments                    |
|Token expiry      |Configurable (24h, 48h, 7d, 14d); enforced server-side by `validate-token`|
|Single-use tokens |Token status updated to `submitted` on first successful submission        |
|Admin portal      |Client-side password gate; URL not published or linked publicly           |
|Admin API         |`x-admin-key` header required for all admin function endpoints            |
|Submission storage|Private blob containers — no public access                                |
|Token storage     |Private blob containers — no public access                                |

### Security Limitations & Recommendations

> The following are known limitations of the current implementation that should be addressed for enterprise-scale production use:

1. **Admin password is stored in client-side JavaScript.** Anyone with access to `admin.html` source code can read it. Upgrade path: implement Azure Active Directory authentication on the admin portal using Azure Static Web Apps Auth or Azure AD B2C.
1. **`AE_ADMIN_KEY` provides no rate limiting.** A brute-force attack against admin endpoints is theoretically possible. Upgrade path: implement Azure API Management with rate limiting in front of the Function App.
1. **Tokens are stored as plain JSON blobs.** If the storage account were compromised, all token metadata would be readable. Upgrade path: encrypt token payloads at rest using Azure Key Vault managed keys.
1. **No audit log for admin actions.** Deletions performed through the admin portal are not logged. Upgrade path: add Azure Application Insights custom events for all admin operations.
1. **Custom domain not yet configured.** The portal currently runs on the Azure storage URL. For production client-facing use, map `assessment.activedgetechnologies.com` via Azure CDN as described in `azure-hosting-guide.html` Step 9.

-----

## 14. Known Issues & Lessons Learned

These are real issues encountered during deployment that future contributors should be aware of:

### 1. Git Bash Cannot Pass Connection Strings via Azure CLI

**Problem:** Git Bash (MINGW64) on Windows misinterprets `=` and `;` characters in connection strings passed as CLI arguments. Settings appear as `null` in output even when the command succeeds.

**Solution:** Always set `STORAGE_CONNECTION` and sensitive values through the **Azure Portal UI** under Function App → Environment Variables. Never rely on Git Bash CLI for these values.

### 2. Node 20 Requires Functions v4 Programming Model

**Problem:** Using the v3 programming model (`module.exports` + `function.json` files) on Node 20 with Linux Consumption Plan produces silent `RpcException` errors. The function returns HTTP 500 with an empty body — no stack trace, no error message.

**Solution:** Use the v4 programming model with a single `src/index.js` entry point using `app.http()` syntax. Remove all `function.json` files and individual function subfolders.

### 3. CORS Trailing Slash

**Problem:** Azure Functions CORS rejects origins with trailing slashes. The storage website URL returned by Azure CLI (`az storage account show`) includes a trailing slash (`https://activedgeassess.z1.web.core.windows.net/`). Adding this directly to CORS causes all API calls to fail with CORS errors.

**Solution:** Always trim the trailing slash before adding to CORS allowed origins.

### 4. Function App Returns 503 After Creation

**Problem:** Newly created Function Apps on Linux Consumption Plan return 503 for 2–5 minutes after provisioning, even after the CLI reports success.

**Solution:** Wait 90 seconds after `az functionapp create` completes before attempting deployment. Verify with `curl -s -o /dev/null -w "%{http_code}" https://[app].scm.azurewebsites.net` — deploy only when `200` or `401` is returned.

### 5. Node Version Defaulting to Node 24

**Problem:** `az functionapp create` with `--runtime-version 18` still defaults to Node 24 on Linux Consumption Plan due to Azure CLI behaviour.

**Solution:** Explicitly set the runtime version after creation:

```bash
az functionapp config set \
  --name ae-assessment-fn \
  --resource-group activedge-assessment-rg \
  --linux-fx-version "NODE|20"
```

-----

## 15. Future Improvements

### High Priority

|Feature                             |Description                                                                                                 |Complexity|
|------------------------------------|------------------------------------------------------------------------------------------------------------|----------|
|**Custom domain**                   |Map `assessment.activedgetechnologies.com` via Azure CDN with free SSL                                      |Low       |
|**Email notification on submission**|Azure Logic App trigger on blob creation → send email to ActivEdge team                                     |Low       |
|**Azure AD admin authentication**   |Replace client-side password with proper Azure AD login for admin portal                                    |Medium    |
|**Email client report to client**   |After submission, automatically email the client their report using SendGrid or Azure Communication Services|Medium    |

### Medium Priority

|Feature                        |Description                                                                              |Complexity|
|-------------------------------|-----------------------------------------------------------------------------------------|----------|
|**PDF report generation**      |Generate a branded PDF version of the client report using a PDF library or Azure Function|Medium    |
|**list-submissions pagination**|Current implementation loads all submissions at once — add pagination for large datasets |Medium    |
|**Token resend / regeneration**|Allow admin to resend or regenerate an expired link without creating a new entry         |Low       |
|**Assessment progress save**   |Allow clients to save progress and resume the assessment later using a session token     |High      |
|**Multi-language support**     |French and Portuguese versions for Francophone and Lusophone African markets             |High      |

### Low Priority / Future Vision

|Feature                             |Description                                                                 |Complexity|
|------------------------------------|----------------------------------------------------------------------------|----------|
|**Sector-specific question sets**   |Customise questions by industry (banking, insurance, telecoms, oil & gas)   |High      |
|**Benchmarking dashboard**          |Compare a client’s CRI against anonymised industry averages                 |High      |
|**Client-facing portal login**      |Allow clients to return and view their own report after submission          |High      |
|**Azure DevOps CI/CD pipeline**     |Automate deployment on push to main branch                                  |Medium    |
|**API versioning**                  |Version the function endpoints for backward compatibility as the API evolves|Medium    |
|**Rate limiting via API Management**|Protect function endpoints from abuse                                       |Medium    |

-----

## 16. Contributing

This project is maintained by the ActivEdge Technologies Cloud Engineering team.

### Development Workflow

```bash
# 1. Create a feature branch
git checkout -b feature/your-feature-name

# 2. Make your changes

# 3. Test locally
func start          # in ae-functions/
npx serve . --port 3000   # in root

# 4. Commit with a clear message
git add .
git commit -m "feat: add email notification on submission"

# 5. Push and open a pull request
git push origin feature/your-feature-name
```

### Commit Message Convention

|Prefix     |Use                                      |
|-----------|-----------------------------------------|
|`feat:`    |New feature                              |
|`fix:`     |Bug fix                                  |
|`docs:`    |Documentation changes                    |
|`refactor:`|Code restructure without behaviour change|
|`deploy:`  |Deployment configuration changes         |
|`style:`   |UI/CSS changes                           |

### What Not to Commit

- `local.settings.json` — contains connection strings
- Any file containing `AccountKey=` or storage credentials
- The `node_modules/` directory

Add these to `.gitignore`:

```
ae-functions/local.settings.json
ae-functions/node_modules/
*.env
.env.local
```

-----

## 17. Contact

**ActivEdge Technologies — Cloud Engineering**

|         |                                                                       |
|---------|-----------------------------------------------------------------------|
|📧 Email  |[info@activedgetechnologies.com](mailto:info@activedgetechnologies.com)|
|📞 Phone  |+234 906 844 4440                                                      |
|🌐 Website|activedgetechnologies.com                                              |
|📍 Address|No. 4b, Utomi Airie Avenue, Lekki Phase 1, Lagos                       |

**Cloud Partners:** Microsoft Azure · Amazon Web Services · Oracle Cloud · Huawei Cloud

-----

## Uploading This README to GitHub

### Step 1 — Create a GitHub Repository

1. Go to [github.com](https://github.com) and sign in
1. Click the **+** icon (top right) → **New repository**
1. Name it: `activedge-cloud-assessment-portal`
1. Set visibility to **Private** (recommended — contains business logic)
1. Do **not** initialise with a README (you already have one)
1. Click **Create repository**

### Step 2 — Initialise Git Locally

Open Git Bash in your project folder and run:

```bash
cd ~/Downloads/LATEST-CLOUD\ OPT/files

# Initialise git repository
git init

# Create .gitignore to protect sensitive files
cat > .gitignore << 'EOF'
ae-functions/local.settings.json
ae-functions/node_modules/
*.env
.env.local
*.log
EOF

# Stage all files including the README
git add .

# Make the first commit
git commit -m "feat: initial commit — ActivEdge Cloud Assessment Portal"
```

### Step 3 — Connect to GitHub and Push

Copy the repository URL from GitHub (it will look like `https://github.com/your-username/activedge-cloud-assessment-portal.git`) then run:

```bash
# Add GitHub as the remote origin
git remote add origin https://github.com/YOUR-USERNAME/activedge-cloud-assessment-portal.git

# Rename branch to main (GitHub default)
git branch -M main

# Push everything to GitHub
git push -u origin main
```

GitHub will prompt for your username and password. For the password, use a **Personal Access Token** (not your account password):

1. Go to GitHub → Settings → Developer Settings → Personal Access Tokens → Tokens (classic)
1. Click **Generate new token**
1. Select scope: `repo` (full repository access)
1. Copy the token and use it as your password when prompted

### Step 4 — Verify on GitHub

Go to `https://github.com/YOUR-USERNAME/activedge-cloud-assessment-portal` — you should see all your files with the README rendered on the repository homepage.

### Step 5 — Future Updates

Whenever you make changes and want to update GitHub:

```bash
git add .
git commit -m "fix: description of what you changed"
git push
```

### Optional — Push Only the README First

If you want to push just the README without the full codebase yet:

```bash
git add README.md
git commit -m "docs: add project README"
git push -u origin main
```

-----

*README last updated: May 2026 · ActivEdge Technologies · activedgetechnologies.com*
