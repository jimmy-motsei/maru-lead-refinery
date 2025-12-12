import { Client } from '@hubspot/api-client';
import { HubSpotSyncResult, Lead, LeadUrgency } from './types';

let hubspotClient: Client | null = null;

function getHubSpotClient(): Client {
  if (hubspotClient) {
    return hubspotClient;
  }

  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
  
  if (!accessToken) {
    throw new Error('HubSpot access token is not configured');
  }

  hubspotClient = new Client({ accessToken });
  return hubspotClient;
}

/**
 * Sync a qualified lead to HubSpot CRM
 * Creates or updates contact and creates a deal
 */
export async function syncToHubSpot(lead: Partial<Lead>): Promise<HubSpotSyncResult> {
  try {
    const client = getHubSpotClient();
    
    // Determine unique identifier (email or social handle)
    const searchIdentifier = lead.contact_email || lead.source_user_id;
    
    if (!searchIdentifier) {
      return {
        success: false,
        error: 'No contact identifier (email or social ID) available',
        action: 'skipped',
      };
    }

    // Step 1: Check if contact exists
    let contactId: string | undefined;
    let contactAction: 'created' | 'updated' = 'created';

    try {
      // Search by email if available
      if (lead.contact_email) {
        const searchResponse = await client.crm.contacts.searchApi.doSearch({
          filterGroups: [{
            filters: [{
              propertyName: 'email',
              operator: 'EQ' as any, // HubSpot SDK type issue - this is valid
              value: lead.contact_email,
            }],
          }],
          properties: ['email', 'firstname', 'lastname'],
          limit: 1,
        });

        if (searchResponse.results.length > 0) {
          contactId = searchResponse.results[0].id;
          contactAction = 'updated';
        }
      }
    } catch (searchError) {
      console.log('Contact search failed, will create new:', searchError);
    }

    // Step 2: Create or update contact
    const contactProperties: Record<string, any> = {
      ...(lead.contact_name && { 
        firstname: lead.contact_name.split(' ')[0],
        lastname: lead.contact_name.split(' ').slice(1).join(' ') || lead.contact_name.split(' ')[0],
      }),
      ...(lead.contact_email && { email: lead.contact_email }),
      ...(lead.contact_phone && { phone: lead.contact_phone }),
      // Custom properties
      lead_source: lead.source,
      lead_source_platform_id: lead.source_user_id,
      lead_original_message: lead.message_content,
    };

    if (contactId) {
      // Update existing contact
      await client.crm.contacts.basicApi.update(contactId, {
        properties: contactProperties,
      });
    } else {
      // Create new contact
      const createResponse = await client.crm.contacts.basicApi.create({
        properties: contactProperties,
      });
      contactId = createResponse.id;
    }

    // Step 3: Create a Deal
    let dealId: string | undefined;

    if (contactId) {
      const dealProperties: Record<string, string> = {
        dealname: `${lead.source} Lead - ${lead.contact_name || searchIdentifier}`,
        dealstage: process.env.HUBSPOT_DEAL_STAGE || 'appointmentscheduled',
        pipeline: process.env.HUBSPOT_PIPELINE_ID || 'default',
        amount: '0',
        ...(lead.source && { lead_source_platform: lead.source }),
        ...(lead.urgency && { lead_urgency: lead.urgency }),
        lead_intent_score: lead.intent_score?.toString() || '0',
        closedate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).getTime().toString(), // 30 days from now
      };

      const dealResponse = await client.crm.deals.basicApi.create({
        properties: dealProperties,
        associations: [
          {
            to: { id: contactId },
            types: [
              {
                associationCategory: 'HUBSPOT_DEFINED' as any,
                associationTypeId: 3, // Deal to Contact association
              },
            ],
          },
        ],
      });

      dealId = dealResponse.id;

      // Step 4: Add a note with AI context
      if (lead.ai_suggested_reply || lead.urgency) {
        await client.crm.objects.notes.basicApi.create({
          properties: {
            hs_note_body: `🤖 AI Lead Qualification:\n\n` +
              `Source: ${lead.source}\n` +
              `Urgency: ${lead.urgency || 'Unknown'}\n` +
              `Intent Score: ${lead.intent_score || 0}/100\n\n` +
              `Original Message:\n"${lead.message_content}"\n\n` +
              `${lead.ai_suggested_reply ? `AI Suggested Reply:\n"${lead.ai_suggested_reply}"` : ''}`,
            hs_timestamp: new Date().getTime().toString(),
          },
          associations: [
            {
              to: { id: contactId },
              types: [
                {
                  associationCategory: 'HUBSPOT_DEFINED' as any,
                  associationTypeId: 202, // Note to Contact
                },
              ],
            },
            ...(dealId ? [{
              to: { id: dealId },
              types: [
                {
                  associationCategory: 'HUBSPOT_DEFINED' as any,
                  associationTypeId: 214, // Note to Deal
                },
              ],
            }] : []),
          ],
        });
      }
    }

    return {
      success: true,
      contact_id: contactId,
      deal_id: dealId,
      action: contactAction,
    };
  } catch (error) {
    console.error('HubSpot Sync Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown HubSpot error',
      action: 'skipped',
    };
  }
}

/**
 * Map urgency level to HubSpot priority
 */
function urgencyToPriority(urgency: LeadUrgency): string {
  const mapping: Record<LeadUrgency, string> = {
    High: 'HIGH',
    Medium: 'MEDIUM',
    Low: 'LOW',
  };
  return mapping[urgency];
}
