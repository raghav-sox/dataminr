import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY is not set. Copy .env.local.example to .env.local and add your key.',
    });
  }

  try {
    const { system, messages, model = 'claude-sonnet-4-20250514', max_tokens = 3000 } = req.body;

    const response = await client.messages.create({
      model,
      max_tokens,
      system,
      messages,
    });

    res.status(200).json(response);
  } catch (err) {
    console.error('Anthropic API error:', err);
    res.status(500).json({
      error: err.message || 'Unknown error calling Anthropic API',
      details: err.error || null,
    });
  }
}
