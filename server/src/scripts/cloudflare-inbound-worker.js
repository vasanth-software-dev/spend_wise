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
  /**
   * HTTP Fetch Handler
   * Responds to browser visits (GET) and HTTP webhooks/tests with status information.
   */
  async fetch(request, env, ctx) {
    const webhookUrl = env.SPENDWISE_WEBHOOK_URL || 'https://myspendwise.dpdns.org/api/v1/email-accounts/forwarding/inbound';
    const secret = env.SPENDWISE_WEBHOOK_SECRET || 'spendwise_inbound_sec_myspendwise2026';
    const secretConfigured = !!env.SPENDWISE_WEBHOOK_SECRET;

    // Health check / browser view
    if (request.method === 'GET') {
      return new Response(
        JSON.stringify(
          {
            status: 'online',
            service: 'SpendWise Inbound Email Worker',
            message: 'Worker is active and listening for incoming email events via Cloudflare Email Routing.',
            webhookDestination: webhookUrl,
            secretConfigured,
            instructions: 'Emails sent to sync-*@myspendwise.dpdns.org trigger the email() handler and are forwarded to SpendWise.',
          },
          null,
          2
        ),
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Allow forwarding manual test HTTP POST payloads to SpendWise
    if (request.method === 'POST') {
      try {
        const body = await request.text();
        const headersToSend = {
          'Content-Type': 'application/json',
          'x-webhook-secret': secret,
        };

        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: headersToSend,
          body,
        });

        const resText = await res.text();
        return new Response(resText, {
          status: res.status,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response('Method Not Allowed', { status: 405 });
  },

  /**
   * Cloudflare Email Routing Handler
   * Triggered when an email arrives for sync-*@myspendwise.dpdns.org
   */
  async email(message, env, ctx) {
    const webhookUrl = env.SPENDWISE_WEBHOOK_URL || 'https://myspendwise.dpdns.org/api/v1/email-accounts/forwarding/inbound';
    const secret = env.SPENDWISE_WEBHOOK_SECRET || 'spendwise_inbound_sec_myspendwise2026';

    const to = message.to;
    const from = message.from;
    const headers = message.headers;
    const subject = headers.get('subject') || '(No Subject)';
    const messageId = headers.get('message-id') || `cf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Read raw email body text
    const rawEmail = await new Response(message.raw).text();

    const payload = {
      to,
      from,
      subject,
      text: rawEmail,
      raw: rawEmail,
      messageId,
      envelope: JSON.stringify({ to: [to], from }),
    };

    const headersToSend = {
      'Content-Type': 'application/json',
    };

    if (secret) {
      headersToSend['x-webhook-secret'] = secret;
    }

    // Include secret in query parameter as fallback in case proxies strip custom headers
    let targetUrl = webhookUrl;
    if (secret && !targetUrl.includes('secret=')) {
      const sep = targetUrl.includes('?') ? '&' : '?';
      targetUrl = `${targetUrl}${sep}secret=${encodeURIComponent(secret)}`;
    }

    try {
      const response = await fetch(targetUrl, {
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

