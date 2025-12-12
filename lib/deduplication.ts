import { getSupabaseServiceClient } from './supabase';
import { NormalizedWebhookPayload, LeadSource } from './types';

/**
 * Check if a lead with the same message content from the same user exists recently
 * This prevents duplicate processing but allows follow-up messages
 */
export async function isDuplicateLead(
  source: LeadSource,
  sourceUserId: string,
  messageContent: string,
  withinHours: number = 2
): Promise<boolean> {
  try {
    const supabase = getSupabaseServiceClient();
    
    const cutoffTime = new Date(Date.now() - withinHours * 60 * 60 * 1000).toISOString();
    
    // Check for exact same message from same user
    const { data, error } = await supabase
      .from('leads')
      .select('id, message_content')
      .eq('source', source)
      .eq('source_user_id', sourceUserId)
      .gte('created_at', cutoffTime)
      .limit(5); // Check last 5 messages

    if (error) {
      console.error('Deduplication check error:', error);
      return false; // If check fails, allow processing (fail open)
    }

    if (!data || data.length === 0) {
      return false;
    }

    // Check if any recent message has similar content (fuzzy match)
    const normalizedNewMessage = normalizeMessage(messageContent);
    
    for (const lead of data) {
      const normalizedExisting = normalizeMessage(lead.message_content);
      
      // If messages are very similar, consider it a duplicate
      if (calculateSimilarity(normalizedNewMessage, normalizedExisting) > 0.85) {
        console.log(`[Dedup] Found similar message from ${source} user ${sourceUserId}`);
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Deduplication error:', error);
    return false; // Fail open
  }
}

/**
 * Normalize message for comparison (remove punctuation, lowercase, trim)
 */
function normalizeMessage(message: string): string {
  return message
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Calculate similarity between two strings (simple Jaccard similarity)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const set1 = new Set(str1.split(' '));
  const set2 = new Set(str2.split(' '));
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

/**
 * Check if a webhook event has already been processed
 * Prevents duplicate processing from webhook retries
 */
export async function isProcessedWebhookEvent(
  source: LeadSource,
  eventId: string
): Promise<boolean> {
  try {
    const supabase = getSupabaseServiceClient();
    
    const { data, error } = await supabase
      .from('webhook_events')
      .select('id, processed')
      .eq('source', source)
      .eq('id', eventId)
      .eq('processed', true)
      .limit(1);

    if (error) {
      console.error('Webhook deduplication check error:', error);
      return false;
    }

    return (data && data.length > 0);
  } catch (error) {
    console.error('Webhook deduplication error:', error);
    return false;
  }
}

/**
 * Get recent leads from a specific source user to avoid spam
 * Returns the count of leads from this user in the last timeframe
 */
export async function getRecentLeadCount(
  source: LeadSource,
  sourceUserId: string,
  withinHours: number = 24
): Promise<number> {
  try {
    const supabase = getSupabaseServiceClient();
    
    const cutoffTime = new Date(Date.now() - withinHours * 60 * 60 * 1000).toISOString();
    
    const { count, error } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('source', source)
      .eq('source_user_id', sourceUserId)
      .gte('created_at', cutoffTime);

    if (error) {
      console.error('Recent lead count error:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Recent lead count error:', error);
    return 0;
  }
}

/**
 * Mark a lead as processed in the logs
 */
export async function logLeadProcessing(
  leadId: string,
  source: LeadSource,
  sourceUserId: string,
  action: string,
  details?: Record<string, any>
): Promise<void> {
  try {
    const supabase = getSupabaseServiceClient();
    
    await supabase.from('lead_logs').insert({
      lead_id: leadId,
      source,
      source_user_id: sourceUserId,
      action,
      details: details || {},
    });
  } catch (error) {
    console.error('Lead logging error:', error);
    // Don't throw - logging failure shouldn't break the main flow
  }
}
