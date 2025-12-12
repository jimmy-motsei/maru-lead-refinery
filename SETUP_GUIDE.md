# 🔧 Setup Guide: Maru.ai Lead Engine

This guide walks you through obtaining all necessary API credentials and configuring webhooks.

---

## 1️⃣ Supabase Setup

### Create a Project

1. Go to [supabase.com](https://supabase.com)
2. Click **"New Project"**
3. Choose a name: `maru-lead-engine`
4. Set a strong database password
5. Choose region: **South Africa (Cape Town)** or closest

### Run the Schema

1. Open your Supabase dashboard
2. Go to **SQL Editor**
3. Copy the contents of `supabase/schema.sql`
4. Paste and click **"Run"**
5. Verify tables were created in **Table Editor**

### Get API Credentials

1. Go to **Settings** → **API**
2. Copy these values to `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `anon` `public` key
   - `SUPABASE_SERVICE_ROLE_KEY` = `service_role` `secret` key

> ⚠️ **Never expose** the service role key in client-side code!

---

## 2️⃣ OpenAI API Setup

### Create an Account

1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Go to **API Keys** (top-right menu)
4. Click **"Create new secret key"**
5. Name it: `maru-lead-engine`
6. Copy the key (you'll only see it once!)

### Add to Environment

```bash
OPENAI_API_KEY=sk-proj-...your-key-here
```

### Set Up Billing

1. Go to **Settings** → **Billing**
2. Add a payment method
3. Set a usage limit (e.g., R500/month for testing)

> 💡 GPT-4o costs approximately $0.005 per lead (~R0.10)

---

## 3️⃣ HubSpot CRM Setup

### Create a Developer Account

1. Go to [developers.hubspot.com](https://developers.hubspot.com)
2. Click **"Get started free"**
3. Complete setup wizard

### Create a Private App

1. Go to **Settings** (gear icon)
2. Navigate to **Integrations** → **Private Apps**
3. Click **"Create a private app"**
4. Name: `Maru Lead Engine`
5. Description: `AI-powered lead ingestion from social media`

### Set Scopes

In the **Scopes** tab, enable:

**CRM Scopes:**
- `crm.objects.contacts.read`
- `crm.objects.contacts.write`
- `crm.objects.deals.read`
- `crm.objects.deals.write`
- `crm.schemas.contacts.read`
- `crm.schemas.deals.read`

**Notes:**
- `crm.objects.notes.write`

### Generate Access Token

1. Click **"Create app"**
2. Copy the **Access Token**
3. Add to `.env.local`:

```bash
HUBSPOT_ACCESS_TOKEN=pat-na1-...your-token-here
```

### Customize Properties (Optional)

Create custom contact properties:
- `lead_source_platform` (Single-line text)
- `lead_source_platform_id` (Single-line text)
- `lead_original_message` (Multi-line text)

Create custom deal properties:
- `lead_urgency` (Dropdown: High/Medium/Low)
- `lead_intent_score` (Number)

---

## 4️⃣ Twilio (WhatsApp) Setup

### Create a Twilio Account

1. Go to [twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Sign up (you get free credits!)
3. Complete verification

### Get Account Credentials

1. Go to **Console Dashboard**
2. Copy to `.env.local`:
   - `TWILIO_ACCOUNT_SID` = Account SID
   - `TWILIO_AUTH_TOKEN` = Auth Token

### Set Up WhatsApp Sandbox (Testing)

1. Go to **Messaging** → **Try it out** → **Send a WhatsApp message**
2. Follow instructions to connect your WhatsApp
3. Send the join code (e.g., `join example-word`)
4. Add to `.env.local`:

```bash
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_WHATSAPP_TO=whatsapp:+27XXXXXXXXX  # Your SA number
```

### Production WhatsApp (Later)

For production, you'll need:
1. **Meta Business Verification** (can take 2-4 weeks)
2. **WhatsApp Business API** access via Twilio
3. Pre-approved message templates

---

## 5️⃣ Meta (Facebook/Instagram) Setup

### Create a Meta App

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Click **"My Apps"** → **"Create App"**
3. Choose **"Business"** type
4. App name: `Maru Lead Listener`

### Add Webhooks Product

1. In your app dashboard, click **"Add Product"**
2. Find **"Webhooks"** → **"Set Up"**

### Configure Page Subscriptions

1. Click **"Create Subscription"** for **Page**
2. Callback URL: `https://your-domain.com/api/webhooks/meta`
3. Verify Token: Create a random string (e.g., `maru_secret_2025`)
   - Add to `.env.local` as `META_VERIFY_TOKEN`
4. Subscribe to fields:
   - `feed` (for comments)
   - `messages` (for DMs)
   - `mention` (for @mentions)

### Get App Secret

1. Go to **Settings** → **Basic**
2. Copy **App Secret**
3. Add to `.env.local`:

```bash
META_APP_SECRET=your-app-secret-here
META_VERIFY_TOKEN=maru_secret_2025
```

### Connect Your Facebook Page

1. Go to **Webhooks** → **Page** → **Subscribe to this object**
2. Select your business page
3. Test by commenting on a page post!

---

## 6️⃣ TikTok API Setup (Optional)

### Apply for TikTok Business API

1. Go to [developers.tiktok.com](https://developers.tiktok.com)
2. Apply for **TikTok for Business** access
3. This requires business verification (can take time)

### Once Approved

1. Create an app in TikTok Developer Portal
2. Get **Client Key** and **Client Secret**
3. Configure webhook: `https://your-domain.com/api/webhooks/tiktok`

```bash
TIKTOK_CLIENT_KEY=your-client-key
TIKTOK_CLIENT_SECRET=your-client-secret
```

> 💡 **For MVP**: Skip TikTok and focus on Facebook/Instagram first

---

## 7️⃣ Proxycurl (LinkedIn) Setup (Optional)

### Create Proxycurl Account

1. Go to [nubela.co/proxycurl](https://nubela.co/proxycurl)
2. Sign up for a free account (10 credits/month)
3. Go to **Dashboard** → **API Keys**
4. Copy your API key

```bash
PROXYCURL_API_KEY=your-proxycurl-api-key
```

### Test LinkedIn Search

```bash
curl -X POST http://localhost:3000/api/linkedin/search \
  -H "Content-Type: application/json" \
  -d '{"job_title": "CEO", "location": "Johannesburg", "limit": 5}'
```

> ⚠️ **Rate Limits**: Free tier = 10 credits/month. Each search ≈ 1 credit.

---

## 8️⃣ Deploy to Vercel

### Install Vercel CLI

```bash
npm install -g vercel
```

### Deploy

```bash
vercel
```

Follow prompts and deploy!

### Add Environment Variables in Vercel

1. Go to your project in [vercel.com](https://vercel.com)
2. **Settings** → **Environment Variables**
3. Add ALL variables from `.env.local`
4. Redeploy: `vercel --prod`

### Update Webhook URLs

After deployment, update:
- Meta webhook: `https://your-app.vercel.app/api/webhooks/meta`
- TikTok webhook: `https://your-app.vercel.app/api/webhooks/tiktok`

---

## 9️⃣ Testing End-to-End

### 1. Test Unified Handler Locally

```bash
curl -X POST http://localhost:3000/api/webhooks/social-inbound \
  -H "Content-Type: application/json" \
  -d '{
    "source": "facebook",
    "user_id": "test_123",
    "message_content": "Urgent! Need a plumber in Fourways, burst geyser!",
    "timestamp": "2025-12-12T14:00:00Z"
  }'
```

### 2. Check Supabase

1. Open Supabase dashboard
2. Go to **Table Editor** → **leads**
3. You should see a new row with:
   - `is_qualified: true`
   - `urgency: High`
   - `intent_score: 90+`

### 3. Check HubSpot

1. Open HubSpot CRM
2. Go to **Contacts**
3. You should see a new contact created
4. Click on it → **Deals** tab → New deal should exist

### 4. Check WhatsApp

If urgency was "High", you should receive a WhatsApp message on your phone!

---

## 🔟 POPIA Compliance (South Africa)

### Data You're Collecting

- Social media user IDs
- Messages/comments
- Names, emails, phone numbers (if shared)

### Requirements

1. **Privacy Policy**: Update your website with how you use data
2. **Consent**: Ensure your social media pages disclose data collection
3. **Data Security**: Supabase encrypts data at rest
4. **Retention**: Set up automated deletion of old leads (add a cron job)

### Recommended

Add to your Facebook page and website:

> "We use AI to process inquiries. By messaging us, you consent to data processing for service delivery. See our Privacy Policy."

---

## ✅ Launch Checklist

- [ ] Supabase project created and schema deployed
- [ ] OpenAI API key configured and billing set up
- [ ] HubSpot private app created with correct scopes
- [ ] Twilio WhatsApp sandbox connected
- [ ] Meta app created and webhook verified
- [ ] Vercel deployment successful
- [ ] Environment variables added to Vercel
- [ ] End-to-end test completed successfully
- [ ] Privacy policy updated for POPIA compliance

---

## 🆘 Troubleshooting

### "Supabase client not configured"

✅ Check `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and keys

### "OpenAI API error: 401 Unauthorized"

✅ Verify `OPENAI_API_KEY` starts with `sk-` and has billing enabled

### "HubSpot sync failed: 401"

✅ Check `HUBSPOT_ACCESS_TOKEN` is valid and scopes are correct

### "WhatsApp notification failed"

✅ Make sure you've joined the Twilio sandbox (`join example-word`)
✅ Verify `TWILIO_WHATSAPP_TO` has correct format: `whatsapp:+27...`

### "Meta webhook verification failed"

✅ Ensure `META_VERIFY_TOKEN` in `.env.local` matches what you set in Meta dashboard

---

**Ready to launch?** Start with Facebook → Instagram → then add LinkedIn/TikTok later! 🚀
