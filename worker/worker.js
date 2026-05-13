/**
 * Cloudflare Worker — Anthropic API Proxy for Simulated Subjects exhibit.
 *
 * SETUP:
 * 1. Go to https://dash.cloudflare.com → Workers & Pages → Create
 * 2. Name it "simulated-subjects-proxy"
 * 3. Paste this file's contents into the worker editor
 * 4. Go to Settings → Variables and Secrets → Add:
 *      Name: ANTHROPIC_API_KEY
 *      Value: your Anthropic API key (sk-ant-...)
 *      Type: Secret
 * 5. Deploy
 * 6. Your proxy URL will be: https://simulated-subjects-proxy.<your-subdomain>.workers.dev
 * 7. Update PROXY_URL in the Astro app's index.astro <script> to match
 */

const ALLOWED_ORIGINS = [
  'http://localhost:4321',
  'http://localhost:3000',
  'https://oscarrelatent.github.io',
];

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    ...CORS_HEADERS,
    'Access-Control-Allow-Origin': allowedOrigin,
  };
}

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request),
      });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' },
      });
    }

    try {
      const body = await request.json();

      // Only allow specific models
      const allowedModels = ['claude-haiku-4-5-20251001'];
      if (!allowedModels.includes(body.model)) {
        return new Response(JSON.stringify({ error: 'Model not allowed' }), {
          status: 400,
          headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' },
        });
      }

      // Cap max_tokens
      body.max_tokens = Math.min(body.max_tokens || 50, 100);

      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      const data = await anthropicRes.json();

      return new Response(JSON.stringify(data), {
        status: anthropicRes.status,
        headers: {
          ...getCorsHeaders(request),
          'Content-Type': 'application/json',
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Internal proxy error' }), {
        status: 500,
        headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' },
      });
    }
  },
};
