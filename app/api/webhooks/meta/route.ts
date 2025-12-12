import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { MetaWebhookPayload, NormalizedWebhookPayload } from '@/lib/types';

/**
 * Meta (Facebook/Instagram) Webhook Handler
 * Handles verification challenges and incoming messages/comments
 */

// Webhook verification (GET request from Meta)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.META_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[Meta Webhook] Verification successful');
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// Webhook events (POST request from Meta)
export async function POST(request: NextRequest) {
  try {
    // Verify signature
    const signature = request.headers.get('x-hub-signature-256');
    const rawBody = await request.text();
    
    if (!verifySignature(rawBody, signature)) {
      console.error('[Meta Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody) as MetaWebhookPayload;

    console.log('[Meta Webhook] Received event:', body.object);

    // Process each entry
    for (const entry of body.entry) {
      // Handle Facebook/Instagram messages
      if (entry.messaging) {
        for (const message of entry.messaging) {
          if (message.message?.text) {
            await forwardToUnifiedHandler({
              source: body.object === 'instagram' ? 'instagram' : 'facebook',
              user_id: message.sender.id,
              message_content: message.message.text,
              timestamp: new Date(message.timestamp).toISOString(),
              metadata: {
                platform_data: message,
              },
            });
          }
        }
      }

      // Handle Page comments/posts
      if (entry.changes) {
        for (const change of entry.changes) {
          if (change.field === 'feed' && change.value) {
            const value = change.value as any;
            
            // Check if it's a comment
            if (value.item === 'comment' && value.message) {
              await forwardToUnifiedHandler({
                source: 'facebook',
                user_id: value.from?.id || value.sender_id || 'unknown',
                message_content: value.message,
                timestamp: new Date().toISOString(),
                metadata: {
                  post_id: value.post_id,
                  comment_id: value.comment_id,
                  user_name: value.from?.name,
                  platform_data: value,
                },
              });
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Meta Webhook Error]:', error);
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Verify Meta webhook signature
 */
function verifySignature(payload: string, signature: string | null): boolean {
  if (!signature) return false;

  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    console.error('META_APP_SECRET not configured');
    return false;
  }

  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Forward normalized payload to unified handler
 * Uses direct function call instead of HTTP to avoid overhead
 */
async function forwardToUnifiedHandler(payload: NormalizedWebhookPayload) {
  try {
    // Import the queue function directly
    const { queueLeadForProcessing } = await import('@/lib/process-lead');
    const { isDuplicateLead } = await import('@/lib/deduplication');
    const { getSupabaseServiceClient } = await import('@/lib/supabase');
    
    const supabase = getSupabaseServiceClient();

    // Check for duplicates
    const dedupHours = parseInt(process.env.DEDUPLICATION_HOURS || '2');
    const isDuplicate = await isDuplicateLead(
      payload.source,
      payload.user_id,
      payload.message_content,
      dedupHours
    );

    if (isDuplicate) {
      console.log(`[Meta->Queue] Skipping duplicate from ${payload.user_id}`);
      return;
    }

    // Queue for processing
    await queueLeadForProcessing(payload);
    console.log(`[Meta->Queue] Lead queued successfully`);
  } catch (error) {
    console.error('[Meta->Queue] Error:', error);
  }
}
