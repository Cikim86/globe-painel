// Vercel Serverless Function · Proxy para API xManse
// Frontend chama: /api/manse?endpoint=/cliente/vendas&inicio=2026-01-01&fim=2026-05-15&pagina=1
// Token armazenado em MANSE_TOKEN env var (configurado em Project Settings > Environment Variables)
export const config = { regions: ['gru1'] };

export default async function handler(req, res) {
  // CORS — só o próprio domínio do painel pode chamar
  const origin = req.headers.origin || '';
  const allowedOrigins = [
    'https://globe-painel.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173'
  ];
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.MANSE_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'MANSE_TOKEN não configurado nas env vars da Vercel' });
  }

  const { endpoint, ...params } = req.query || {};
  if (!endpoint) {
    return res.status(400).json({
      error: 'Parâmetro "endpoint" obrigatório',
      exemplo: '/api/manse?endpoint=/cliente/vendas&inicio=2026-01-01&fim=2026-05-15&pagina=1'
    });
  }

  // Validar endpoint para não permitir chamadas arbitrárias
  const validPrefixes = ['/produto', '/cliente', '/pedido', '/nfe', '/log'];
  if (!validPrefixes.some(p => endpoint.startsWith(p))) {
    return res.status(400).json({ error: 'endpoint inválido', endpoint });
  }

  // Construir URL Manse
  const baseUrl = 'https://manse.com.br/rest/xmanse/api';
  const url = new URL(baseUrl + endpoint);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') url.searchParams.set(k, v);
  });

  const startedAt = Date.now();

  try {
    const upstream = await fetch(url.toString(), {
      method: req.method === 'POST' || req.method === 'PUT' ? req.method : 'GET',
      headers: {
        'xmanse-token': token,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: (req.method === 'POST' || req.method === 'PUT') ? JSON.stringify(req.body || {}) : undefined
    });

    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    // Cache HTTP — diferentes TTL por endpoint
    let maxAge = 300;
    if (endpoint.startsWith('/produto')) maxAge = 1800;
    else if (endpoint.startsWith('/nfe')) maxAge = 600;
    else if (endpoint.startsWith('/cliente')) maxAge = 900;
    else if (endpoint.startsWith('/pedido/listar')) maxAge = 300;
    else if (endpoint.startsWith('/log')) maxAge = 60;
    res.setHeader('Cache-Control', `s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}`);

    res.setHeader('X-Manse-Status', upstream.status);
    res.setHeader('X-Manse-Latency', Date.now() - startedAt);

    return res.status(upstream.status).json(data);
  } catch (e) {
    return res.status(502).json({
      error: 'Falha ao chamar Manse',
      message: e.message,
      latency_ms: Date.now() - startedAt
    });
  }
}
