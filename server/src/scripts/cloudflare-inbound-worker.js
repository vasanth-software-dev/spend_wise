/**
 * SpendWise Inbound Email Forwarding Worker for Cloudflare Email Routing
 *
 * This Cloudflare Worker receives inbound emails sent to sync-*@myspendwise.dpdns.org
 * and forwards the parsed message to SpendWise's inbound webhook API.
 *
 * Setup in Cloudflare:
 * 1. Cloudflare Dashboard -> Email Routing -> Email Workers -> Create Worker
 * 2. Paste this code.
 * 3. Add Environment Variables (Settings -> Variables):
 *    - SPENDWISE_WEBHOOK_URL: "https://myspendwise.dpdns.org/api/v1/email-accounts/forwarding/inbound"
 *    - SPENDWISE_WEBHOOK_SECRET: "spendwise_inbound_sec_myspendwise2026"
 * 4. Add Routing Rule:
 *    - Catch-all or custom rule for sync-*@myspendwise.dpdns.org -> Send to Worker
 */

export default {
  async email(message, env, ctx) {
    const webhookUrl = env.SPENDWISE_WEBHOOK_URL || 'https://myspendwise.dpdns.org/api/v1/email-accounts/forwarding/inbound';
    const secret = env.SPENDWISE_WEBHOOK_SECRET || '';

    const to = message.to;
    const from = message.from;
    const headers = message.headers;
    const subject = headers.get('subject') || '(No Subject)';
    const messageId = headers.get('message-id') || `cf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Read raw email body text
    const rawEmail = await new Response(message.raw).text();

    // Extract plain text / basic body from raw email
    const payload = {
      to,
      from,
      subject,
      text: rawEmail,
      messageId,
      envelope: JSON.stringify({ to: [to], from }),
    };

    const headersToSend = {
      'Content-Type': 'application/json',
    };

    if (secret) {
      headersToSend['x-webhook-secret'] = secret;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: headersToSend,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error(`SpendWise webhook rejected email with status ${response.status}`);
      }
    } catch (err) {
      console.error('Failed to forward email to SpendWise webhook:', err);
    }
  },
};
