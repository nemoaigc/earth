/**
 * Local dev API server for /api/chat
 * Uses Anthropic-format streaming via the bty gateway.
 * Run: node api/server.mjs
 */

import { createServer } from 'node:http';

const PORT = 13001;
const BASE_URL    = 'https://aigw-api.happyseeds.ai/v1';
const API_KEY     = 'bty-prod-60cc393b4ef549d370f25ed42383331a08e5517c5b4440496730678c6a44dc47';
const MODEL       = 'claude-sonnet-4.6';
const BTY_HEADERS = {
  'x-bty-business': 'ReActUs',
  'x-bty-workspace': 'default',
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

async function handleChat(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;

  let parsed;
  try { parsed = JSON.parse(body); } catch {
    res.writeHead(400); res.end('Bad JSON'); return;
  }

  const messages = (parsed.messages ?? []).filter(m => m.role !== 'system');
  const systemMsg = (parsed.messages ?? []).find(m => m.role === 'system')?.content;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    ...corsHeaders(),
  });

  try {
    const requestBody = {
      model: MODEL,
      max_tokens: 512,
      stream: true,
      messages,
    };
    if (systemMsg) requestBody.system = systemMsg;

    const upstream = await fetch(`${BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
        ...BTY_HEADERS,
      },
      body: JSON.stringify(requestBody),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      res.write(`data: ${JSON.stringify({ error: `Upstream ${upstream.status}: ${errText}` })}\n\n`);
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') {
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }
        try {
          const j = JSON.parse(data);
          // Anthropic stream events
          if (j.type === 'content_block_delta') {
            const delta = j.delta?.text ?? '';
            if (delta) res.write(`data: ${JSON.stringify({ delta })}\n\n`);
          } else if (j.type === 'message_stop') {
            res.write('data: [DONE]\n\n');
            res.end();
            return;
          }
        } catch {}
      }
    }
    res.write('data: [DONE]\n\n');
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  }
  res.end();
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  if (req.url === '/api/chat' && req.method === 'POST') {
    await handleChat(req, res);
    return;
  }

  res.writeHead(404, corsHeaders()); res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`[earth-api] Local API server on http://localhost:${PORT}`);
  console.log(`[earth-api] Model: ${MODEL} via ${BASE_URL}`);
});
