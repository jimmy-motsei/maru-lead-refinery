// TypeScript type definitions for the Maru.ai Lead Engine

export type LeadSource = 
  | 'facebook' 
  | 'instagram' 
  | 'tiktok' 
  | 'linkedin' 
  | 'web_form';

export type LeadUrgency = 'High' | 'Medium' | 'Low';

export type Language = 'en' | 'zu' | 'af' | 'unknown';

export type WebhookAction = 
  | 'received' 
  | 'processed' 
  | 'qualified' 
  | 'rejected' 
  | 'synced' 
  | 'error';

// Database types
export interface Lead {
  id: string;
  created_at: string;
  updated_at: string;
  
  // Source
  source: LeadSource;
  source_user_id?: string;
  source_post_id?: string;
  
  // Contact
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  
  // Message
  message_content: string;
  original_language?: Language;
  translated_content?: string;
  
  // AI qualification
  is_qualified: boolean;
  urgency?: LeadUrgency;
  intent_score?: number;
  ai_suggested_reply?: string;
  ai_extracted_data?: Record<string, any>;
  
  // HubSpot
  hubspot_contact_id?: string;
  hubspot_deal_id?: string;
  synced_to_hubspot: boolean;
  hubspot_sync_error?: string;
  
  // WhatsApp
  whatsapp_notification_sent: boolean;
  whatsapp_notification_at?: string;
  
  // Metadata
  metadata?: Record<string, any>;
}

export interface LeadLog {
  id: string;
  created_at: string;
  lead_id: string;
  source: LeadSource;
  source_user_id?: string;
  action: WebhookAction;
  details?: Record<string, any>;
}

export interface WebhookEvent {
  id: string;
  created_at: string;
  source: LeadSource;
  event_type?: string;
  raw_payload: Record<string, any>;
  processed: boolean;
  processing_error?: string;
  lead_id?: string;
}

// API Request/Response types
export interface NormalizedWebhookPayload {
  source: LeadSource;
  user_id: string;
  message_content: string;
  timestamp: string;
  metadata?: {
    post_id?: string;
    comment_id?: string;
    user_name?: string;
    user_handle?: string;
    platform_data?: Record<string, any>;
  };
}

export interface AIQualificationResult {
  is_lead: boolean;
  urgency: LeadUrgency;
  intent_score: number;
  suggested_reply: string;
  extracted_data: {
    name?: string;
    phone?: string;
    email?: string;
    service_requested?: string;
    location?: string;
  };
  language_detected: Language;
  reasoning?: string;
}

export interface HubSpotSyncResult {
  success: boolean;
  contact_id?: string;
  deal_id?: string;
  error?: string;
  action: 'created' | 'updated' | 'skipped';
}

export interface WhatsAppNotificationResult {
  success: boolean;
  message_sid?: string;
  error?: string;
}

// Meta (Facebook/Instagram) Webhook types
export interface MetaWebhookEntry {
  id: string;
  time: number;
  changes?: Array<{
    field: string;
    value: any;
  }>;
  messaging?: Array<{
    sender: { id: string };
    recipient: { id: string };
    timestamp: number;
    message?: {
      mid: string;
      text: string;
    };
  }>;
}

export interface MetaWebhookPayload {
  object: 'page' | 'instagram' | 'whatsapp_business_account';
  entry: MetaWebhookEntry[];
}

// TikTok Webhook types
export interface TikTokWebhookPayload {
  event: string;
  timestamp: number;
  data: {
    video_id?: string;
    comment_id?: string;
    user_id?: string;
    text?: string;
    [key: string]: any;
  };
}

// LinkedIn types (via Proxycurl)
export interface LinkedInSearchParams {
  job_title: string;
  location: string;
  limit?: number;
}

export interface LinkedInProfile {
  public_identifier: string;
  profile_pic_url?: string;
  first_name?: string;
  last_name?: string;
  headline?: string;
  summary?: string;
  occupation?: string;
  location?: string;
  connections?: number;
}

// Web Form Submission
export interface WebFormSubmission {
  name: string;
  email?: string;
  phone?: string;
  message: string;
  source_page?: string;
  utm_params?: Record<string, string>;
}

// Error types
export class LeadEngineError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'LeadEngineError';
  }
}
