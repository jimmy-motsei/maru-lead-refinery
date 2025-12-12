import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { processInboundLead } from '@/lib/process-lead';

/**
 * Background Worker for Processing Queued Leads
 * This endpoint should be triggered by:
 * 1. Vercel Cron (recommended): every 1 minute
 * 2. External cron service: curl https://your-app.com/api/worker/process-queue
 * 3. Manual trigger for testing
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Add authentication to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.WEBHOOK_SECRET;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Fetch pending items from the queue (limit to avoid timeout)
    const { data: queueItems, error: fetchError } = await supabase
      .from('processing_queue')
      .select('*')
      .eq('status', 'pending')
      .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
      .lt('retry_count', supabase.rpc('max_retries'))
      .order('created_at', { ascending: true })
      .limit(10); // Process 10 at a time

    if (fetchError) {
      console.error('[Worker] Failed to fetch queue items:', fetchError);
      throw fetchError;
    }

    if (!queueItems || queueItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No items to process',
        processed: 0,
      });
    }

    console.log(`[Worker] Processing ${queueItems.length} queued items`);

    const results = {
      processed: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each item
    for (const item of queueItems) {
      try {
        // Mark as processing
        await supabase
          .from('processing_queue')
          .update({
            status: 'processing',
            started_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        // Process the lead
        const result = await processInboundLead(item.payload);

        // Mark as completed
        await supabase
          .from('processing_queue')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            result,
          })
          .eq('id', item.id);

        results.processed++;
        console.log(`[Worker] ✓ Processed queue item ${item.id}`);
      } catch (error) {
        console.error(`[Worker] ✗ Failed to process item ${item.id}:`, error);
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.failed++;
        results.errors.push(`Item ${item.id}: ${errorMessage}`);

        // Increment retry count
        const newRetryCount = item.retry_count + 1;
        const maxRetries = item.max_retries || 3;

        if (newRetryCount >= maxRetries) {
          // Max retries reached - mark as failed
          await supabase
            .from('processing_queue')
            .update({
              status: 'failed',
              error_message: errorMessage,
              retry_count: newRetryCount,
              completed_at: new Date().toISOString(),
            })
            .eq('id', item.id);
        } else {
          // Schedule for retry (exponential backoff)
          const retryDelayMinutes = Math.pow(2, newRetryCount) * 5; // 5min, 10min, 20min
          const nextRetryAt = new Date(Date.now() + retryDelayMinutes * 60 * 1000);

          await supabase
            .from('processing_queue')
            .update({
              status: 'pending',
              error_message: errorMessage,
              retry_count: newRetryCount,
              next_retry_at: nextRetryAt.toISOString(),
            })
            .eq('id', item.id);

          console.log(`[Worker] Scheduled retry for item ${item.id} at ${nextRetryAt.toISOString()}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('[Worker Error]:', error);
    
    return NextResponse.json(
      {
        error: 'Worker processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Allow GET for manual testing
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'process-queue',
    message: 'Use POST to trigger queue processing',
    timestamp: new Date().toISOString(),
  });
}
