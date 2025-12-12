/**
 * Meta Auto-Reply Module
 * Sends automated replies to Facebook/Instagram comments and messages
 */

interface AutoReplyParams {
  source: 'facebook' | 'instagram';
  comment_id?: string;
  message_id?: string;
  sender_id: string;
  reply_text: string;
}

interface AutoReplyResult {
  success: boolean;
  reply_id?: string;
  error?: string;
}

/**
 * Send an automated reply to a Facebook comment or Instagram message
 */
export async function sendAutoReply(params: AutoReplyParams): Promise<AutoReplyResult> {
  try {
    const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN;

    if (!pageAccessToken) {
      throw new Error('META_PAGE_ACCESS_TOKEN not configured');
    }

    // Facebook Comment Reply
    if (params.source === 'facebook' && params.comment_id) {
      return await replyToFacebookComment(params.comment_id, params.reply_text, pageAccessToken);
    }

    // Instagram/Facebook Message Reply
    if (params.message_id || params.sender_id) {
      return await sendPrivateMessage(params.sender_id, params.reply_text, pageAccessToken);
    }

    throw new Error('Invalid auto-reply parameters: missing comment_id or sender_id');
  } catch (error) {
    console.error('[Auto-Reply Error]:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown auto-reply error',
    };
  }
}

/**
 * Reply to a Facebook comment
 */
async function replyToFacebookComment(
  commentId: string,
  replyText: string,
  accessToken: string
): Promise<AutoReplyResult> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${commentId}/comments`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: replyText,
          access_token: accessToken,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Facebook API error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();

    return {
      success: true,
      reply_id: data.id,
    };
  } catch (error) {
    console.error('[Facebook Comment Reply Error]:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown Facebook API error',
    };
  }
}

/**
 * Send a private message via Facebook Messenger or Instagram DM
 */
async function sendPrivateMessage(
  recipientId: string,
  messageText: string,
  accessToken: string
): Promise<AutoReplyResult> {
  try {
    // Determine if it's a Page-scoped ID (Facebook) or Instagram-scoped ID
    // This uses the Send API for Messenger
    const response = await fetch(
      'https://graph.facebook.com/v18.0/me/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text: messageText },
          access_token: accessToken,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Messenger API error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();

    return {
      success: true,
      reply_id: data.message_id,
    };
  } catch (error) {
    console.error('[Private Message Error]:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown Messenger API error',
    };
  }
}
