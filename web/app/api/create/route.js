// Crea o cambia una creación llamando a Claude y devuelve el texto en streaming.
import { buildSystem, buildUserMessage } from '../../../lib/prompt.js';

export const maxDuration = 300; // la IA puede tardar hasta un minuto o más

const MAX_PROMPT = 600;
const MAX_CODE = 120_000;

export async function POST(req) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return new Response('Falta ANTHROPIC_API_KEY', { status: 500 });

  let body;
  try { body = await req.json(); } catch { return new Response('JSON inválido', { status: 400 }); }

  const text = String(body.text || '').slice(0, MAX_PROMPT).trim();
  const currentCode = body.currentCode ? String(body.currentCode).slice(0, MAX_CODE) : '';
  if (!text) return new Response('Falta la idea', { status: 400 });

  const system = buildSystem({
    lang: body.lang === 'de' ? 'de' : 'es',
    age: Number(body.age) || 9,
    noViolence: body.noViolence !== false,
    noScary: body.noScary !== false,
  });

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.SIMSALABIT_MODEL || 'claude-sonnet-5-5',
      max_tokens: 16000,
      stream: true,
      system,
      messages: [{ role: 'user', content: buildUserMessage({ text, currentCode }) }],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    return new Response('Error de la IA: ' + upstream.status + ' ' + detail.slice(0, 300), { status: 502 });
  }

  // Convierte el SSE de Anthropic en texto plano para el navegador.
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (!data) continue;
            try {
              const ev = JSON.parse(data);
              if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
                controller.enqueue(encoder.encode(ev.delta.text));
              }
            } catch { /* línea incompleta */ }
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}
