import { getSupabaseServiceClient } from './supabase';
import { qualifyLead } from './ai-qualifier';
import { syncToHubSpot } from './hubspot-connector';
import { sendWhatsAppNotification } from './whatsapp-notifier';
import { sendAutoReply } from './meta-auto-reply';
import { logLeadProcessing } from './deduplication';
import { NormalizedWebhookPayload } from './types';

/**
 * Core lead processing logic (extracted from webhook handler)
 * This is called by both the synchronous webhook (for simple cases) 
 * and the async worker (for queued processing)
 */
export async function processInboundLead(payload: NormalizedWebhookPayload) {
  const supabase = getSupabaseServiceClient();

  try {
    console.log(`[Process] Starting processing for ${payload.source} - ${payload.user_id}`);

    // Step 1: AI Qualification
    console.log('[AI] Qualifying lead...');
    const aiResult = await qualifyLead(payload.message_content, payload.source);

    console.log(`[AI] Result: is_lead=${aiResult.is_lead}, urgency=${aiResult.urgency}, score=${aiResult.intent_score}`);

    // Step 2: Create lead record
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        source: payload.source,
        source_user_id: payload.user_id,
        source_post_id: payload.metadata?.post_id,
        message_content: payload.message_content,
        original_language: aiResult.language_detected,
        is_qualified: aiResult.is_lead,
        urgency: aiResult.urgency,
        intent_score: aiResult.intent_score,
        ai_suggested_reply: aiResult.suggested_reply,
        ai_extracted_data: aiResult.extracted_data,
        contact_name: aiResult.extracted_data.name || payload.metadata?.user_name,
        contact_email: aiResult.extracted_data.email,
        contact_phone: aiResult.extracted_data.phone,
        metadata: payload.metadata,
      })
      .select()
      .single();

    if (leadError || !lead) {
      console.error('Failed to create lead:', leadError);
      throw new Error('Failed to create lead record');
    }

    await logLeadProcessing(lead.id, payload.source, payload.user_id, 'processed');

    // Step 3: Send auto-reply if enabled and message qualifies
    const enableAutoReply = process.env.ENABLE_AUTO_REPLY === 'true';
    
    if (enableAutoReply && aiResult.suggested_reply && (payload.source === 'facebook' || payload.source === 'instagram')) {
      console.log('[Auto-Reply] Sending reply...');
      
      const replyResult = await sendAutoReply({
        source: payload.source,
        comment_id: payload.metadata?.comment_id,
        message_id: payload.metadata?.platform_data?.mid,
        sender_id: payload.user_id,
        reply_text: aiResult.suggested_reply,
      });

      if (replyResult.success) {
        await supabase
          .from('leads')
          .update({
            auto_reply_sent: true,
            auto_reply_sent_at: new Date().toISOString(),
          })
          .eq('id', lead.id);

        console.log('[Auto-Reply] Success');
      } else {
        await supabase
          .from('leads')
          .update({
            auto_reply_error: replyResult.error,
          })
          .eq('id', lead.id);

        console.error('[Auto-Reply] Failed:', replyResult.error);
      }
    }

    // Step 4: If qualified, sync to HubSpot
    if (aiResult.is_lead) {
      console.log('[HubSpot] Syncing qualified lead...');
      
      const hubspotResult = await syncToHubSpot(lead);
      
      if (hubspotResult.success) {
        await supabase
          .from('leads')
          .update({
            hubspot_contact_id: hubspotResult.contact_id,
            hubspot_deal_id: hubspotResult.deal_id,
            synced_to_hubspot: true,
          })
          .eq('id', lead.id);

        await logLeadProcessing(lead.id, payload.source, payload.user_id, 'synced', {
          contact_id: hubspotResult.contact_id,
          deal_id: hubspotResult.deal_id,
        });

        console.log(`[HubSpot] Success: Contact ${hubspotResult.contact_id}, Deal ${hubspotResult.deal_id}`);
        
        // Step 5: Send WhatsApp notification for High urgency leads
        if (aiResult.urgency === 'High') {
          console.log('[WhatsApp] Sending high-priority notification...');
          
          const whatsappResult = await sendWhatsAppNotification({
            contact_name: lead.contact_name,
            source: payload.source,
            urgency: aiResult.urgency,
            message_content: payload.message_content,
            hubspot_contact_id: hubspotResult.contact_id,
          });

          if (whatsappResult.success) {
            await supabase
              .from('leads')
              .update({
                whatsapp_notification_sent: true,
                whatsapp_notification_at: new Date().toISOString(),
              })
              .eq('id', lead.id);

            console.log('[WhatsApp] Notification sent:', whatsappResult.message_sid);
          } else {
            console.error('[WhatsApp] Failed:', whatsappResult.error);
            
            // Log failed WhatsApp notification for retry
            await supabase.from('failed_syncs').insert({
              lead_id: lead.id,
              integration: 'whatsapp',
              error_message: whatsappResult.error,
              next_retry_at: new Date(Date.now() + 5 * 60 * 1000), // Retry in 5 minutes
            });
          }
        }
      } else {
        await supabase
          .from('leads')
          .update({
            hubspot_sync_error: hubspotResult.error,
          })
          .eq('id', lead.id);

        console.error('[HubSpot] Sync failed:', hubspotResult.error);
        
        // Log failed HubSpot sync for retry
        await supabase.from('failed_syncs').insert({
          lead_id: lead.id,
          integration: 'hubspot',
          error_message: hubspotResult.error,
          next_retry_at: new Date(Date.now() + 5 * 60 * 1000), // Retry in 5 minutes
        });
      }
    } else {
      console.log('[AI] Not qualified - no HubSpot sync needed');
      await logLeadProcessing(lead.id, payload.source, payload.user_id, 'rejected', {
        reason: aiResult.reasoning,
      });
    }

    return {
      success: true,
      lead_id: lead.id,
      qualified: aiResult.is_lead,
      urgency: aiResult.urgency,
      score: aiResult.intent_score,
    };
  } catch (error) {
    console.error('[Process Error]:', error);
    throw error;
  }
}

/**
 * Queue a lead for async processing
 * Returns immediately without waiting for AI/HubSpot/WhatsApp
 */
export async function queueLeadForProcessing(payload: NormalizedWebhookPayload) {
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from('processing_queue')
    .insert({
      payload,
      status: 'pending',
      max_retries: parseInt(process.env.MAX_PROCESSING_RETRIES || '3'),
    })
    .select()
    .single();

  if (error) {
    console.error('[Queue] Failed to queue lead:', error);
    throw new Error('Failed to queue lead for processing');
  }

  console.log(`[Queue] Lead queued with ID: ${data.id}`);
  
  return {
    queued: true,
    queue_id: data.id,
  };
}
