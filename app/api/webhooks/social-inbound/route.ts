import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { isDuplicateLead } from '@/lib/deduplication';
import { queueLeadForProcessing } from '@/lib/process-lead';
import { NormalizedWebhookPayload } from '@/lib/types';

/**
 * Unified Social Media Inbound Webhook Handler (Async Version)
 * Accepts normalized payloads, validates, checks for duplicates, then queues for processing
 * Returns immediately (< 300ms) without waiting for AI/HubSpot/WhatsApp
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as NormalizedWebhookPayload;

    // Validate required fields
    if (!body.source || !body.user_id || !body.message_content) {
      return NextResponse.json(
        { error: 'Missing required fields: source, user_id, message_content' },
        { status: 400 }
      );
    }

    console.log(`[Webhook] Received ${body.source} message from user ${body.user_id}`);

    // Step 1: Store raw webhook event
    const supabase = getSupabaseServiceClient();
    const { data: webhookEvent, error: webhookError } = await supabase
      .from('webhook_events')
      .insert({
        source: body.source,
        event_type: 'inbound_message',
        raw_payload: body,
        processed: false,
      })
      .select()
      .single();

    if (webhookError) {
      console.error('Failed to log webhook event:', webhookError);
    }

    // Step 2: Check for duplicates (now checks message content similarity)
    const dedupHours = parseInt(process.env.DEDUPLICATION_HOURS || '2');
    const isDuplicate = await isDuplicateLead(
      body.source,
      body.user_id,
      body.message_content,
      dedupHours
    );
    
    if (isDuplicate) {
      console.log(`[Dedup] Skipping duplicate message from ${body.source} user ${body.user_id}`);
      
      // Mark webhook as processed
      if (webhookEvent) {
        await supabase
          .from('webhook_events')
          .update({ processed: true, processing_error: 'Duplicate message' })
          .eq('id', webhookEvent.id);
      }

      return NextResponse.json({
        success: true,
        message: 'Duplicate message skipped',
        duplicate: true,
      });
    }

    // Step 3: Queue for async processing
    const queueResult = await queueLeadForProcessing(body);

    // Mark webhook event with queue ID
    if (webhookEvent) {
      await supabase
        .from('webhook_events')
        .update({ 
          processed: true, 
          processing_error: `Queued: ${queueResult.queue_id}` 
        })
        .eq('id', webhookEvent.id);
    }

    // Return immediately - processing happens in background
    return NextResponse.json({
      success: true,
      queued: true,
      queue_id: queueResult.queue_id,
      message: 'Lead queued for processing',
    });
  } catch (error) {
    console.error('[Webhook Error]:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'social-inbound',
    version: '2.0-async',
    timestamp: new Date().toISOString(),
  });
}
