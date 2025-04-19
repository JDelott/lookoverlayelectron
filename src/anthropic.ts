import * as dotenv from 'dotenv';
// Load environment variables from .env file
dotenv.config();

// The API key will be loaded from .env file
const apiKey = process.env.ANTHROPIC_API_KEY || '';

export async function analyzeImageWithClaude(imageData: string, prompt: string): Promise<any> {
  if (!apiKey) {
    return {
      success: false,
      error: 'Anthropic API key not set. Please set the ANTHROPIC_API_KEY environment variable.'
    };
  }
  
  try {
    // Direct API call without using the SDK
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-opus-20240229',
        max_tokens: 1000,
        system: "You are an assistant that analyzes screenshots and images.",
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt || 'What can you see in this image?'
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: imageData.replace(/^data:image\/\w+;base64,/, '')
                }
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();

    return {
      success: true,
      analysis: data.content[0].text
    };
  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    return {
      success: false,
      error: `API error: ${(error as Error).message}`
    };
  }
}
