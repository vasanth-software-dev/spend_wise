# SpendWise — Personal Expense Tracker & UPI Financial Intelligence

> *"Understand where your money goes."*

SpendWise is an enterprise-quality, privacy-first personal finance platform built with clean architecture, strong TypeScript typing, and native support for Indian UPI transactions and email synchronization.

---

## 🌟 Key Features

### 1. Manual Expense & Income Tracking
- **Expense, Income & Transfers**: Instant tracking with a custom mobile-first numeric amount keypad.
- **Categorization**: System-standard categories (Food, Groceries, Shopping, Transport, Fuel, Bills, Rent, Entertainment, Health, Education, Travel, Subscriptions, Salary, Investments) plus custom user-created categories with Lucide icons and color hex codes.
- **Payment Methods**: Dedicated options for UPI (Google Pay, PhonePe, Paytm, BHIM, CRED), Bank Transfer / IMPS / NEFT, Cards, Cash, and Wallets.

### 2. Multi-Account Email & UPI Sync (Zero-Password Architecture)
- **Email Provider Abstraction**: Built on an extensible `EmailProvider` interface decoupled from any single vendor:
  - **Dev Mock Provider**: Zero-cost, instantaneous local testing without paid APIs or external OAuth setups. Generates realistic Swiggy, Amazon, HDFC, and PhonePe payment notifications with one click.
  - **Gmail Provider**: Official Google OAuth 2.0 with targeted read-only Gmail API filters.
  - Ready for Outlook, Yahoo, and IMAP extensions.
- **Multi-Account Management**: Link personal, work, and secondary accounts independently with sync pausing, manual sync triggers, and sync history.
- **Bank-Grade Privacy & Security**:
  - **NEVER** asks for or stores Gmail passwords, UPI PINs, Bank passwords, ATM PINs, CVVs, or OTPs.
  - Third-party OAuth tokens encrypted at rest with **AES-256-GCM**.
  - Strict data minimization: Marketing emails and sensitive body text are never retained.

### 3. UPI Parser Framework & Confidence Scoring
- Provider-specific parsers: `GPayParser`, `PhonePeParser`, `PaytmParser`, `BankParser` (HDFC, ICICI, SBI, Axis alert emails), and `GenericUPIParser`.
- **Confidence Scoring**: Each parsed transaction receives a confidence score (e.g. 96% Very High, 88% Likely, 60% Review).
- **Composite Duplicate Detection**: Multi-layer identification using UPI UTR reference numbers, bank references, external IDs, and time/amount/merchant tolerance windows.

### 4. Transaction Review Center
- Dedicated inbox review workflow. Automatically detected transactions are placed in a staging queue for confirmation, editing, rejection, or marking as duplicate.
- Only confirmed items enter the primary financial ledger unless automatic confirmation is enabled.

### 5. Fintech Dashboard & Analytics
- **Live Summary**: Total Balance, Income This Month, Expenses This Month, Net Savings, and Savings Rate percentage.
- **Recharts Data Visualizations**:
  - Interactive Income vs Expense timeline (7D, 30D, 3M, 6M, 1Y).
  - Donut Category Breakdown with percentages and custom color swatches.
  - Top Merchants horizontal bar chart.
- **Recent Activity Ledger**: Quick visual distinction for income (+) and expenses (-), with a slide-out details drawer.

### 6. Proactive Budgeting System
- Create monthly overall or category-specific spending caps.
- Dynamic visual progress bars.
- Proactive warning triggers at 80% threshold and alerts when budget is exceeded.

### 7. Subscriptions & Recurring Bills
- Track recurring outflows (Rent, Netflix, Mutual Fund SIP, EMIs, Broadband) and recurring salary credits.
- Dashboard highlights upcoming obligations due "Tomorrow" or "in 5 days".

### 8. Financial Reports & CSV Import/Export
- Comprehensive statement generator with custom date ranges.
- Full CSV export of transactions or filtered query results.
- Drag-and-drop CSV importer with column mapping, preview table, validation, and duplicate detection.

### 9. Multi-Device Session Management
- Refresh token rotation stored exclusively in `HttpOnly`, `SameSite=Lax` cookies.
- Live active session inspector: tracks browser, operating system, IP address, and last-active timestamp.
- Revoke individual sessions or trigger "Logout All Other Devices".

### 10. Design System & Accessibility
- Clean fintech SaaS aesthetics with soft borders, subtle elevations, and dark/light/system theme modes.
- Fully responsive across desktop (1440px, 1024px), tablet (768px), and mobile (390px, 360px).
- Bottom navigation bar and center floating action button optimized for one-handed mobile usage.

---

## 🏗️ Architecture & Clean Layering

```text
spendwise/
├── client/                      # React 18 + Vite + TypeScript frontend
│   ├── src/
│   │   ├── app/                 # App routing & root providers
│   │   ├── components/ui/       # Design system (Button, Card, Modal, Input, Badge, etc.)
│   │   ├── features/            # Feature modules (transactions, dashboard, emailSync, etc.)
│   │   ├── layouts/             # MainLayout, Sidebar, Navbar, MobileNavigation
│   │   ├── pages/               # Top-level view routes
│   │   ├── services/            # Axios API client with token refresh queue
│   │   ├── store/               # Redux Toolkit store and feature slices
│   │   ├── types/               # Frontend TypeScript interfaces
│   │   └── utils/               # Indian number formatting (formatINR), dates, etc.
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── server/                      # Node.js + Express + TypeScript backend
│   ├── src/
│   │   ├── config/              # Zod env validation, MongoDB, Redis
│   │   ├── controllers/         # Thin HTTP request/response handlers
│   │   ├── services/            # Pure business logic & orchestration
│   │   ├── repositories/        # Mongoose data access & aggregation pipelines
│   │   ├── models/              # Mongoose schemas with indexed fields
│   │   ├── routes/              # Express API routers under /api/v1/
│   │   ├── middleware/          # JWT auth, centralized error, rate limiting
│   │   ├── validators/          # Zod validation schemas
│   │   ├── providers/
│   │   │   ├── email/           # EmailProvider interface & MockEmailProvider
│   │   │   ├── gmail/           # GmailProvider with Google OAuth2
│   │   │   └── parsers/         # GPay, PhonePe, Paytm, Bank, GenericUPI parsers
│   │   ├── utils/               # AES-256 encryption, decimal-safe math, JWT, logging
│   │   ├── app.ts               # Express configuration
│   │   ├── server.ts            # Server entry point
│   │   └── seed.ts              # 10 users, 120+ transactions, demo seeder
│   ├── tests/                   # Vitest unit & integration test suites
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml           # MongoDB, Redis, Mongo Express, Redis Commander
├── .env.example                 # Configuration template
└── package.json                 # Root script orchestration
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v20+ (Tested on v22)
- **npm**: v10+
- **Docker & Docker Compose** (Optional, for running MongoDB & Redis containers)

### 1. Clone & Install Dependencies

```bash
# Install root dependencies
npm install

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
cd ..
```

### 2. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Default local development values:
- `MONGO_URI=mongodb://localhost:27017/spendwise`
- `REDIS_URL=redis://localhost:6379` (Gracefully falls back to In-Memory cache if Redis is not running)
- `PORT=8080`
- `CLIENT_URL=http://localhost:5173`
- `ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`

### 3. Start Database (Docker)

```bash
docker compose up -d mongodb
```
*(Or use an existing MongoDB instance on port 27017).*

### 4. Seed Database with Realistic Indian Data

Populate the database with 10 users, 120+ multi-month transactions, budgets, subscriptions, and detected email transactions:

```bash
npm run seed
```

**Demo Account Credentials:**
- Email: `vasanth@spendwise.dev`
- Password: `SpendWise@123`
*(A "Fill Demo" button is also present on the login screen for instant access).*

### 5. Run Development Servers

```bash
# Start backend and frontend concurrently
npm run dev
```

- **Frontend Client**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:8080](http://localhost:8080)
- **API Health Check**: [http://localhost:8080/api/health](http://localhost:8080/api/health)

---

## 🧪 Testing & Verification

Run the automated test suite across parsing logic, decimal-safe financial calculations, and duplicate detection:

```bash
# Run server test suite
npm run test:server
```

---

## 🔒 Security Design

1. **HttpOnly Cookie Refresh Tokens**: Long-lived refresh tokens are stored in secure HttpOnly cookies, protecting them from XSS. Short-lived access tokens remain exclusively in memory.
2. **Token Rotation**: Every refresh token usage invalidates the previous session token and creates a new cryptographic hash.
3. **AES-256-GCM Encryption**: OAuth tokens are encrypted at rest with AES-256-GCM authenticated cipher before reaching MongoDB.
4. **Sensitive Data Redaction**: Passwords, tokens, OTPs, and card numbers are scrubbed from logs via `maskSensitiveData()`.
5. **Cascading Account Deletion**: Deleting an account revokes OAuth access and purges all transactions, categories, budgets, and sessions permanently.

---

## 📄 License
MIT License. Built for enterprise personal finance management.
