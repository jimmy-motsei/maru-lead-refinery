# 🧠 Maru.ai Lead Engine

**An AI-powered omni-channel lead orchestration system for South African SMEs**

Transform social media noise into qualified leads. The Maru Lead Engine funnels everything through an AI brain before delivering high-intent prospects directly to your HubSpot CRM.

---

## 🎯 The Problem We Solve

For a Johannesburg plumber, **500 TikTok likes are useless**. But one person in the "I Love Fourways" Facebook group asking "Who knows a guy for a burst geyser?" is worth **R5,000**.

Our system **finds that one person**.

---

## 🏗️ Architecture

### The 3-Step "Refinery" Process

```
┌─────────────────┐      ┌──────────────┐      ┌─────────────────┐
│   INGEST        │ ───▶ │  AI FILTER   │ ───▶ │    DELIVER      │
│ (Wide Net)      │      │ (The Brain)  │      │  (HubSpot)      │
└─────────────────┘      └──────────────┘      └─────────────────┘
   • LinkedIn               • Enrichment           • Create Deal
   • Facebook               • Scoring 1-100        • WhatsApp Alert
   • Instagram              • Language: EN/ZU/AF   • Auto-reply
   • TikTok
   • Web Forms
```

---

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <your-repo>
cd maru-lead-refinery
npm install
```

### 2. Set Up Environment Variables

Copy `.env.example` to `.env.local` and fill in your API credentials:

```bash
cp .env.example .env.local
```

See **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** for detailed instructions on obtaining API keys.

### 3. Set Up Supabase Database

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run the SQL schema from `supabase/schema.sql` in the SQL Editor
3. Copy your project URL and keys to `.env.local`

### 4. Run Development Server

```bash
npm run dev
```

Your Lead Engine is now running at [http://localhost:3000](http://localhost:3000)

---

## 📡 API Endpoints

### Unified Webhook Handler

**POST** `/api/webhooks/social-inbound`

Accepts normalized payloads from any social platform:

```json
{
  "source": "facebook",
  "user_id": "123456789",
  "message_content": "Hi, I need a plumber urgently in Fourways!",
  "timestamp": "2025-12-12T12:00:00Z",
  "metadata": {
    "post_id": "post_123",
    "user_name": "John Doe"
  }
}
```

### Platform-Specific Webhooks

- **POST** `/api/webhooks/meta` - Facebook/Instagram (with signature verification)
- **POST** `/api/webhooks/tiktok` - TikTok comments/mentions
- **GET** `/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=...` - Meta verification

### LinkedIn Prospecting

**POST** `/api/linkedin/search`

```json
{
  "job_title": "HR Manager",
  "location": "Sandton",
  "limit": 10
}
```

---

## 🧪 Testing

### Test with cURL

```bash
# Test unified handler
curl -X POST http://localhost:3000/api/webhooks/social-inbound \
  -H "Content-Type: application/json" \
  -d '{
    "source": "facebook",
    "user_id": "test_user_123",
    "message_content": "I need a quote for emergency plumbing in Fourways ASAP!",
    "timestamp": "2025-12-12T12:00:00Z"
  }'
```

### Expected Response

```json
{
  "success": true,
  "lead_id": "uuid-here",
  "qualified": true,
  "urgency": "High",
  "score": 92,
  "suggested_reply": "Thank you for reaching out! We can help with your emergency plumbing need..."
}
```

---

## 🔐 Security

### Webhook Signature Verification

The Meta webhook endpoint verifies signatures using your `META_APP_SECRET`:

```typescript
const expectedSignature = crypto
  .createHmac('sha256', META_APP_SECRET)
  .update(payload)
  .digest('hex');
```

### Environment Variables

**NEVER** commit `.env.local` to version control. All secrets are in `.gitignore`.

---

## 🌍 South African Context

### Multi-Language Support

The AI Brain automatically detects and handles:
- **English** (en)
- **Afrikaans** (af) - e.g., "Ek soek 'n loodgieter"
- **isiZulu** (zu) - e.g., "Ngicela usizo"

### Location Detection

Keywords like **Fourways**, **Sandton**, **Johannesburg**, **Cape Town**, etc., are extracted and stored.

### High-Intent Keywords

The AI is trained to recognize SA-specific urgency:
- "Emergency" / "Urgent" / "ASAP"
- "Quote" / "Price" / "How much"
- "Burst geyser" / "Blocked drain" (plumbing)

---

## 📊 Database Schema

Three main tables in Supabase:

1. **`leads`** - Qualified leads with AI scores
2. **`lead_logs`** - Audit trail for deduplication
3. **`webhook_events`** - Raw webhook payloads

See `supabase/schema.sql` for full schema.

---

## 🤖 AI Qualification Logic

Powered by **OpenAI GPT-4o**, the AI analyzes every message:

```typescript
const result = await qualifyLead(message, source);
// Returns:
{
  is_lead: true,
  urgency: "High",
  intent_score: 92,
  suggested_reply: "...",
  extracted_data: {
    name: "John Doe",
    phone: "+27...",
    service_requested: "Emergency plumbing"
  }
}
```

### Scoring System

- **High (80-100)**: Emergency needs, specific problems, "urgent"/"ASAP"
- **Medium (40-79)**: General inquiries, quote requests
- **Low (0-39)**: Compliments, complaints without service request

---

## 🔗 Integrations

### HubSpot CRM

- Creates contacts (or updates existing)
- Creates deals in "New Lead" stage
- Maps urgency to priority
- Adds AI context as notes

### WhatsApp Notifications (Twilio)

Only triggers for **High urgency** leads:

```
🔥 Maru Alert: High Priority Lead

📱 Source: FACEBOOK
👤 From: John Doe

💬 Message:
"I need emergency plumbing in Fourways..."

🔗 View in HubSpot: [link]
```

---

## 📁 Project Structure

```
maru-lead-refinery/
├── app/
│   └── api/
│       ├── webhooks/
│       │   ├── social-inbound/    # Unified handler
│       │   ├── meta/              # Facebook/Instagram
│       │   └── tiktok/            # TikTok
│       └── linkedin/
│           └── search/            # Proxycurl integration
├── lib/
│   ├── ai-qualifier.ts           # OpenAI GPT-4 logic
│   ├── hubspot-connector.ts      # CRM sync
│   ├── whatsapp-notifier.ts      # Twilio WhatsApp
│   ├── deduplication.ts          # Anti-spam
│   ├── supabase.ts               # DB client
│   └── types.ts                  # TypeScript types
├── supabase/
│   └── schema.sql                # Database schema
└── .env.example                  # Template for secrets
```

---

## 🚀 Deployment

### Vercel (Recommended)

```bash
npm install -g vercel
vercel
```

Add environment variables in Vercel dashboard.

### Railway / Render

Deploy as a Node.js app. Set environment variables in their dashboards.

### Webhook URLs

After deployment, configure these URLs in your platforms:

- Meta: `https://your-domain.com/api/webhooks/meta`
- TikTok: `https://your-domain.com/api/webhooks/tiktok`

---

## 📝 Next Steps

1. **Get API Credentials** - See [SETUP_GUIDE.md](./SETUP_GUIDE.md)
2. **Configure Webhooks** - Set up in Meta Business Suite
3. **Test with Real Data** - Send a test comment on Facebook
4. **Monitor Supabase** - Check the `leads` table
5. **Optimize AI Prompts** - Tune for your specific industry

---

## 🆘 Support

Built with ❤️ for South African SMEs.

For issues, check the logs in:
- Vercel deployment logs
- Supabase dashboard
- HubSpot activity timeline

---

## 📄 License

Private licensed system for Maru Online clients.
