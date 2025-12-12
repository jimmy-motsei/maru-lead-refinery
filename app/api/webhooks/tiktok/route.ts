import { NextRequest, NextResponse } from 'next/server';
import { TikTokWebhookPayload, NormalizedWebhookPayload } from '@/lib/types';

/**
 * TikTok Webhook Handler
 * Handles TikTok comment notifications and video mentions
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as TikTokWebhookPayload;

    console.log('[TikTok Webhook] Received event:', body.event);

    // Handle comment events
    if (body.event === 'comment.created' || body.event === 'video.comment') {
      const commentText = body.data.text;
      const userId = body.data.user_id;

      if (commentText && userId) {
        await forwardToUnifiedHandler({
          source: 'tiktok',
          user_id: userId,
          message_content: commentText,
          timestamp: new Date(body.timestamp * 1000).toISOString(),
          metadata: {
            post_id: body.data.video_id,
            comment_id: body.data.comment_id,
            platform_data: body.data,
          },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[TikTok Webhook Error]:', error);
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'tiktok-webhook',
  });
}

/**
 * Forward normalized payload to processing queue
 * Uses direct function call instead of HTTP
 */
async function forwardToUnifiedHandler(payload: NormalizedWebhookPayload) {
  try {
    const { queueLeadForProcessing } = await import('@/lib/process-lead');
    const { isDuplicateLead } = await import('@/lib/deduplication');

    // Check for duplicates
    const dedupHours = parseInt(process.env.DEDUPLICATION_HOURS || '2');
    const isDuplicate = await isDuplicateLead(
      payload.source,
      payload.user_id,
      payload.message_content,
      dedupHours
    );

    if (isDuplicate) {
      console.log(`[TikTok->Queue] Skipping duplicate from ${payload.user_id}`);
      return;
    }

    await queueLeadForProcessing(payload);
    console.log(`[TikTok->Queue] Lead queued successfully`);
  } catch (error) {
    console.error('[TikTok->Queue] Error:', error);
  }
}
