import { fetch } from '@tauri-apps/plugin-http';

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function callClaude(
  apiKey: string,
  systemPrompt: string,
  messages: ClaudeMessage[],
  maxTokens: number = 1024
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json() as { content: Array<{ type: string; text: string }> };
  return data.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');
}
