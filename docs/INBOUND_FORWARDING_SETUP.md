# SpendWise Inbound Email Forwarding Setup Guide
Domain: **`myspendwise.dpdns.org`**

SpendWise features a zero-OAuth inbound email ingestion system. When users connect email forwarding in SpendWise, they receive a private, unique forwarding address:

```text
sync-<token>@myspendwise.dpdns.org
(e.g., sync-8f2a6b41@myspendwise.dpdns.org)
```

Whenever bank alerts, UPI receipts (Google Pay, PhonePe, Paytm), or shopping emails (Amazon, Swiggy, Zomato, Flipkart) are forwarded to this address, SpendWise automatically extracts the transaction details, categorizes them, checks for duplicates, and alerts the user in real time.

---

## 1. SpendWise Webhook Ingest Endpoint

SpendWise exposes a public webhook endpoint:

- **URL**: `https://myspendwise.dpdns.org/api/v1/email-accounts/forwarding/inbound`
- **Method**: `POST`
- **Content Types Supported**: `application/json`, `application/x-www-form-urlencoded`, `multipart/form-data`
- **Authentication**:
  - Optional in development
  - In production, secured via secret in `.env`:
    - Header: `x-webhook-secret: <INBOUND_WEBHOOK_SECRET>`
    - Or Query Param: `?secret=<INBOUND_WEBHOOK_SECRET>`
    - Or Header: `Authorization: Bearer <INBOUND_WEBHOOK_SECRET>`

---

## 2. Inbound Routing Setup Options

Depending on how DNS for `myspendwise.dpdns.org` is managed, here are the three recommended ways to route emails to your SpendWise webhook:

### Option A: Cloudflare Email Routing + Free Cloudflare Worker (Recommended & 100% Free)

If your domain DNS is managed with Cloudflare:
1. In Cloudflare Dashboard, go to **Email Routing** &rarr; Enable Email Routing.
2. Under **Email Workers**, click **Create Worker** and paste the code from [`server/src/scripts/cloudflare-inbound-worker.js`](../server/src/scripts/cloudflare-inbound-worker.js).
3. Set your environment variables in Cloudflare Worker settings:
   - `SPENDWISE_WEBHOOK_URL`: `https://myspendwise.dpdns.org/api/v1/email-accounts/forwarding/inbound`
   - `SPENDWISE_WEBHOOK_SECRET`: your secret configured in `.env` (`INBOUND_WEBHOOK_SECRET`)
4. In **Email Routing &rarr; Routing Rules**:
   - Add a Catch-all or Custom Address rule:
     - Match: `sync-*@myspendwise.dpdns.org` (or catch-all)
     - Action: **Send to Worker** &rarr; Select your SpendWise Email Worker.

---

### Option B: SendGrid Inbound Parse / Mailgun Routes

If using an email delivery provider:
1. **DNS MX Records**: Add the MX records provided by SendGrid (`mx.sendgrid.net`) or Mailgun for `myspendwise.dpdns.org`.
2. **SendGrid Inbound Parse**:
   - Go to **Settings &rarr; Inbound Parse**.
   - Add Host: `myspendwise.dpdns.org`
   - Destination URL: `https://myspendwise.dpdns.org/api/v1/email-accounts/forwarding/inbound?secret=YOUR_SECRET`
   - Check **Check incoming emails for spam** & **Send raw**.
3. **Mailgun Routes**:
   - Create Route: `match_recipient("sync-.*@myspendwise.dpdns.org")`
   - Action: `forward("https://myspendwise.dpdns.org/api/v1/email-accounts/forwarding/inbound?secret=YOUR_SECRET")`

---

### Option C: User Email Client Auto-Forwarding (Gmail / Outlook)

Once the inbound address is active:
1. In Gmail, go to **Settings (⚙️) &rarr; See all settings &rarr; Forwarding and POP/IMAP**.
2. Click **Add a forwarding address** &rarr; paste `sync-<token>@myspendwise.dpdns.org`.
3. Gmail sends a verification email. SpendWise **automatically captures the 9-digit confirmation code** and displays it on the user's dashboard!
4. Create a Gmail filter for payment alerts:
   ```text
   from:(alerts@hdfcbank.net OR noreply@swiggy.in OR no-reply@phonepe.com OR auto-confirm@amazon.in OR alerts@icicibank.com)
   ```
   Select **Forward it to: sync-<token>@myspendwise.dpdns.org** &rarr; Save!

---

## 3. Testing Inbound Ingestion

### A. Instant In-App Simulator
In SpendWise UI &rarr; **Email Sync** &rarr; **Connect Account** &rarr; **Auto-Forwarding**:
Select a template (e.g., *Swiggy ₹489 (Google Pay UPI)* or *HDFC Bank ₹1,250 Debit Alert*) and click **Send Test Forward**. The transaction will be processed and appear in Detected Transactions!

### B. Manual Webhook cURL Test
You can test the webhook endpoint directly:

```bash
curl -X POST https://myspendwise.dpdns.org/api/v1/email-accounts/forwarding/inbound \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: spendwise_inbound_sec_myspendwise2026" \
  -d '{
    "to": "sync-YOUR_TOKEN@myspendwise.dpdns.org",
    "from": "alerts@hdfcbank.net",
    "subject": "Alert: You have spent INR 850.00 at Starbucks",
    "text": "Dear Customer, INR 850.00 has been debited from your HDFC Bank A/c ending 1234 on 12-Oct-2026 via UPI reference 429182910391 to Starbucks Coffee."
  }'
```
