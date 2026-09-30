# First live voice setup

This is the one account-level setup needed before the first real InMotion phone call.

## 1. Deploy the sideband worker

Deploy this repository as an always-on Node service using:

- Start command: `npm run voice-worker`
- Health check: `/health`
- Node: 20+

Required worker environment:

```
OPENAI_API_KEY=<same OpenAI project key used by InMotion>
INMOTION_APP_URL=<public InMotion Next.js URL>
INTERNAL_WORKER_SECRET=<same random secret configured on the Next.js app>
VOICE_WORKER_SECRET=<a separate long random secret>
PORT=8787
```

After deployment confirm:

```
GET https://<worker-host>/health
```

returns:

```json
{"ok":true,"sessions":0}
```

Then add to the Next.js deployment:

```
VOICE_WORKER_URL=https://<worker-host>
VOICE_WORKER_SECRET=<same worker secret>
INTERNAL_WORKER_SECRET=<same internal secret>
INMOTION_APP_URL=<public InMotion app URL>
```

## 2. Configure the OpenAI project webhook

In the OpenAI Platform project used by InMotion:

1. Confirm GPT-Live SIP access is enabled.
2. Open Project settings -> Webhooks.
3. Create a webhook pointing to:
   `https://<public-inmotion-domain>/api/voice/openai/webhook`
4. Subscribe to the current incoming Live/SIP event (`live.transport.incoming`).
5. Store the webhook signing secret in the Next.js deployment as:
   `OPENAI_WEBHOOK_SECRET=<secret>`
6. Note the OpenAI Project ID (`proj_...`).

Keep these existing Next.js values:

```
OPENAI_LIVE_MODEL=gpt-live-1
OPENAI_LIVE_BACKEND_MODEL=gpt-6-luna
OPENAI_LIVE_VOICE=marin
VOICE_DEMO_BUSINESS_SLUG=northstar-dental
```

Redeploy the Next.js app after environment changes.

## 3. Configure Twilio Elastic SIP Trunking

Create an Elastic SIP Trunk in Twilio.

For inbound calls:

1. Enable Secure Trunking (TLS signaling + SRTP media).
2. Configure the Origination SIP URI to the OpenAI project:
   `sip:<OPENAI_PROJECT_ID>@sip.api.openai.com;transport=tls`
3. Associate the desired Twilio phone number with the trunk.
4. Keep the number in E.164 format in InMotion (for example `+27...`).

Twilio sends calls received on the associated number to the trunk's origination URI. OpenAI routes the project-specific SIP request to GPT-Live and sends the incoming webhook to InMotion.

## 4. Connect the number inside InMotion

In Connections -> Phone / Voice:

- Provider: Voice
- Provider name: Twilio
- Phone number: exact E.164 number
- Status: Connected

The phone number must match the number arriving in the SIP To header so InMotion can route the call to the correct tenant.

## 5. First test

Call the Twilio number from another phone.

Expected:

1. OpenAI sends the incoming webhook.
2. InMotion creates/locates the caller.
3. InMotion creates a voice conversation and call row.
4. GPT-Live answers.
5. The sideband worker attaches.
6. Ask for opening hours.
7. Ask for availability.
8. Make a test booking.
9. Verify the booking appears under Bookings and the call under Calls.

Do not send API keys, webhook secrets, or worker secrets through chat. Only report public URLs, non-secret project/phone identifiers, and error messages.
