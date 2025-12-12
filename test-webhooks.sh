#!/bin/bash

# Test the Maru.ai Lead Engine locally
# Make sure to run `npm run dev` before running these tests

BASE_URL="http://localhost:3000"

echo "🧪 Testing Maru.ai Lead Engine"
echo "================================"
echo ""

# Test 1: High urgency lead (plumber scenario)
echo "Test 1: High Urgency Lead (Emergency Plumber)"
echo "----------------------------------------------"
curl -X POST "$BASE_URL/api/webhooks/social-inbound" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "facebook",
    "user_id": "test_user_001",
    "message_content": "Urgent! My geyser burst in Fourways! Need a plumber ASAP, water everywhere!",
    "timestamp": "2025-12-12T14:00:00Z",
    "metadata": {
      "user_name": "John Doe",
      "post_id": "fb_post_123"
    }
  }'

echo ""
echo ""

# Test 2: Medium urgency lead (quote request)
echo "Test 2: Medium Urgency Lead (Quote Request)"
echo "--------------------------------------------"
curl -X POST "$BASE_URL/api/webhooks/social-inbound" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "instagram",
    "user_id": "test_user_002",
    "message_content": "Hi, can I get a price for regular plumbing maintenance? I am in Sandton.",
    "timestamp": "2025-12-12T14:05:00Z",
    "metadata": {
      "user_name": "Jane Smith"
    }
  }'

echo ""
echo ""

# Test 3: Low intent (not a lead)
echo "Test 3: Low Intent (Not a Lead)"
echo "--------------------------------"
curl -X POST "$BASE_URL/api/webhooks/social-inbound" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "tiktok",
    "user_id": "test_user_003",
    "message_content": "Nice video! 😊👍",
    "timestamp": "2025-12-12T14:10:00Z"
  }'

echo ""
echo ""

# Test 4: Afrikaans message
echo "Test 4: Afrikaans Message"
echo "-------------------------"
curl -X POST "$BASE_URL/api/webhooks/social-inbound" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "facebook",
    "user_id": "test_user_004",
    "message_content": "Ek soek dringend n loodgieter in Pretoria. My toilet is gebars!",
    "timestamp": "2025-12-12T14:15:00Z",
    "metadata": {
      "user_name": "Pieter van der Merwe"
    }
  }'

echo ""
echo ""

# Test 5: LinkedIn search
echo "Test 5: LinkedIn Search (HR Managers in Johannesburg)"
echo "------------------------------------------------------"
curl -X POST "$BASE_URL/api/linkedin/search" \
  -H "Content-Type: application/json" \
  -d '{
    "job_title": "HR Manager",
    "location": "Johannesburg",
    "limit": 5
  }'

echo ""
echo ""
echo "✅ Tests complete!"
echo ""
echo "Next steps:"
echo "1. Check your Supabase dashboard → leads table"
echo "2. Check HubSpot for new contacts/deals"
echo "3. Check your phone for WhatsApp alerts (High urgency only)"
