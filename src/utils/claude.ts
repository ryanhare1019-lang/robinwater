import { fetch } from '@tauri-apps/plugin-http';

const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

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
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '(no body)');
    throw new Error(`Claude API error ${response.status}: ${body}`);
  }

  const data = await response.json() as { content: Array<{ type: string; text: string }> };
  return data.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');
}
