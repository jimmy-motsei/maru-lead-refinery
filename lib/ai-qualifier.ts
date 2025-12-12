import OpenAI from 'openai';
import { AIQualificationResult, Language, LeadUrgency } from './types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * AI Lead Qualification Engine
 * Uses OpenAI GPT-4 to analyze messages and determine if they represent qualified leads
 */
export async function qualifyLead(
  messageContent: string,
  source: string
): Promise<AIQualificationResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured');
  }

  const systemPrompt = `You are a Lead Qualification Specialist for South African SMEs (Small and Medium Enterprises).

Your task is to analyze incoming messages from social media and web forms to determine:
1. Is this a genuine business inquiry (lead) or just social engagement?
2. What is the urgency level? (High/Medium/Low)
3. What information can be extracted?

SOUTH AFRICAN CONTEXT:
- Common languages: English, Zulu (isiZulu), Afrikaans
- Common locations: Johannesburg (JHB), Cape Town (CPT), Durban (DBN), Pretoria (PTA), Sandton, Fourways, Midrand, etc.
- High-intent keywords: "quote", "price", "help", "urgent", "emergency", "need", "how much"
- Low-intent: "nice", "lol", "wow", emojis only, complaints without service request

URGENCY SCORING:
- HIGH (80-100): Emergency needs, "urgent", "today", "ASAP", specific problem requiring immediate attention
- MEDIUM (40-79): General inquiries, "quote", "price", interested but not time-sensitive
- LOW (0-39): Just compliments, complaints without asking for service, vague interest

If the message is in Afrikaans or Zulu, translate to English for CRM storage BUT keep the original for any suggested reply.

Return ONLY a valid JSON object with this exact structure:
{
  "is_lead": boolean,
  "urgency": "High" | "Medium" | "Low",
  "intent_score": number (0-100),
  "suggested_reply": "string",
  "extracted_data": {
    "name": "string or null",
    "phone": "string or null",
    "email": "string or null",
    "service_requested": "string or null",
    "location": "string or null"
  },
  "language_detected": "en" | "zu" | "af" | "unknown",
  "reasoning": "brief explanation of scoring"
}`;

  const userPrompt = `Analyze this message from ${source}:

"${messageContent}"

Is this a qualified lead? What's the urgency? Extract any contact info.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Lower temperature for more consistent classification
    });

    const responseText = completion.choices[0]?.message?.content;
    
    if (!responseText) {
      throw new Error('No response from OpenAI');
    }

    const result = JSON.parse(responseText) as AIQualificationResult;

    // Validate the result has required fields
    if (typeof result.is_lead !== 'boolean' || !result.urgency || typeof result.intent_score !== 'number') {
      throw new Error('Invalid response format from AI');
    }

    return result;
  } catch (error) {
    console.error('AI Qualification Error:', error);
    
    // Fallback: If AI fails, return a conservative default
    return {
      is_lead: false,
      urgency: 'Low',
      intent_score: 0,
      suggested_reply: 'Thank you for your message! We\'ll get back to you soon.',
      extracted_data: {},
      language_detected: 'unknown',
      reasoning: `AI processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Detect language from message content using simple keyword matching
 * (GPT-4 will do more sophisticated detection, this is just a helper)
 */
export function detectLanguage(text: string): Language {
  const lowerText = text.toLowerCase();
  
  // Afrikaans keywords
  const afrikaansKeywords = ['ek', 'jy', 'die', 'is', 'asseblief', 'dankie', 'goeie'];
  const hasAfrikaans = afrikaansKeywords.some(keyword => lowerText.includes(keyword));
  
  // Zulu keywords
  const zuluKeywords = ['ngiyabonga', 'sawubona', 'yebo', 'cha', 'ngicela'];
  const hasZulu = zuluKeywords.some(keyword => lowerText.includes(keyword));
  
  if (hasAfrikaans) return 'af';
  if (hasZulu) return 'zu';
  
  // Default to English
  return 'en';
}
