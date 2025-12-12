import { NextRequest, NextResponse } from 'next/server';
import { LinkedInSearchParams, LinkedInProfile } from '@/lib/types';

/**
 * LinkedIn Prospect Search Endpoint
 * Uses Proxycurl API to search for LinkedIn profiles matching criteria
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as LinkedInSearchParams;

    if (!body.job_title || !body.location) {
      return NextResponse.json(
        { error: 'Missing required fields: job_title, location' },
        { status: 400 }
      );
    }

    const proxycurlApiKey = process.env.PROXYCURL_API_KEY;

    if (!proxycurlApiKey) {
      return NextResponse.json(
        { error: 'Proxycurl API key not configured' },
        { status: 500 }
      );
    }

    console.log(`[LinkedIn Search] Searching for: ${body.job_title} in ${body.location}`);

    // Call Proxycurl Person Search API
    const searchParams = new URLSearchParams({
      country: 'za', // South Africa
      current_job_title: body.job_title,
      region: body.location,
      enrich_profiles: 'enrich', // Get full profile data
      page_size: String(body.limit || 10),
    });

    const response = await fetch(
      `https://nubela.co/proxycurl/api/search/person/?${searchParams}`,
      {
        headers: {
          Authorization: `Bearer ${proxycurlApiKey}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[LinkedIn Search] API error:', errorText);
      throw new Error(`Proxycurl API error: ${response.status}`);
    }

    const data = await response.json();
    const profiles: LinkedInProfile[] = data.results || [];

    console.log(`[LinkedIn Search] Found ${profiles.length} profiles`);

    return NextResponse.json({
      success: true,
      count: profiles.length,
      profiles: profiles.map((profile: any) => ({
        public_identifier: profile.public_identifier,
        profile_pic_url: profile.profile_pic_url,
        first_name: profile.first_name,
        last_name: profile.last_name,
        headline: profile.headline,
        summary: profile.summary,
        occupation: profile.occupation,
        location: profile.city,
        connections: profile.connections,
      })),
    });
  } catch (error) {
    console.error('[LinkedIn Search Error]:', error);
    return NextResponse.json(
      {
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Get endpoint info
export async function GET() {
  return NextResponse.json({
    endpoint: 'linkedin-search',
    description: 'Search for LinkedIn profiles by job title and location',
    required_fields: ['job_title', 'location'],
    optional_fields: ['limit'],
  });
}
