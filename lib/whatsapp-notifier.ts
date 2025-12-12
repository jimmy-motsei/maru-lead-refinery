import twilio from 'twilio';
import { WhatsAppNotificationResult } from './types';

let twilioClient: ReturnType<typeof twilio> | null = null;

function getTwilioClient() {
  if (twilioClient) {
    return twilioClient;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials are not configured');
  }

  twilioClient = twilio(accountSid, authToken);
  return twilioClient;
}

/**
 * Send WhatsApp notification to SME client when a high-priority lead comes in
 */
export async function sendWhatsAppNotification(
  leadData: {
    contact_name?: string;
    source: string;
    urgency: string;
    message_content: string;
    hubspot_contact_id?: string;
  }
): Promise<WhatsAppNotificationResult> {
  try {
    const client = getTwilioClient();
    
    const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;
    const whatsappTo = process.env.TWILIO_WHATSAPP_TO;

    if (!whatsappFrom || !whatsappTo) {
      throw new Error('WhatsApp phone numbers not configured');
    }

    // Only send for High urgency leads
    if (leadData.urgency !== 'High') {
      return {
        success: true,
        message_sid: 'skipped-low-urgency',
      };
    }

    // Build HubSpot link if available
    const hubspotLink = leadData.hubspot_contact_id
      ? `\n\n🔗 View in HubSpot: https://app.hubspot.com/contacts/YOUR_PORTAL_ID/contact/${leadData.hubspot_contact_id}`
      : '';

    const messageBody = 
      `🔥 *Maru Alert: High Priority Lead*\n\n` +
      `📱 Source: ${leadData.source.toUpperCase()}\n` +
      `👤 From: ${leadData.contact_name || 'Unknown'}\n\n` +
      `💬 Message:\n"${leadData.message_content.substring(0, 200)}${leadData.message_content.length > 200 ? '...' : ''}"\n` +
      `${hubspotLink}`;

    const message = await client.messages.create({
      from: whatsappFrom,
      to: whatsappTo,
      body: messageBody,
    });

    return {
      success: true,
      message_sid: message.sid,
    };
  } catch (error) {
    console.error('WhatsApp Notification Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown WhatsApp error',
    };
  }
}

/**
 * Send approval template message (Meta-approved templates only)
 * Use this for production with pre-approved WhatsApp Business templates
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  templateParams: string[]
): Promise<WhatsAppNotificationResult> {
  try {
    const client = getTwilioClient();
    
    const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;

    if (!whatsappFrom) {
      throw new Error('WhatsApp sender number not configured');
    }

    const message = await client.messages.create({
      from: whatsappFrom,
      to: to,
      contentSid: templateName, // This would be your approved template SID
      contentVariables: JSON.stringify(
        templateParams.reduce((acc, param, index) => {
          acc[`${index + 1}`] = param;
          return acc;
        }, {} as Record<string, string>)
      ),
    });

    return {
      success: true,
      message_sid: message.sid,
    };
  } catch (error) {
    console.error('WhatsApp Template Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown WhatsApp template error',
    };
  }
}
