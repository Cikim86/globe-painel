// Vercel Serverless Function · Testa múltiplas variações de header de autenticação Manse

export default async function handler(req, res) {
  const token = process.env.MANSE_TOKEN;
  if (!token) return res.status(500).json({ error: 'MANSE_TOKEN ausente' });

  const url = 'https://manse.com.br/rest/xmanse/api/cliente/lista?inicio=2026-05-01&fim=2026-05-15&pagina=1';

  const variations = [
    { name: 'xmanse-token', headers: { 'xmanse-token': token } },
    { name: 'X-Manse-Token', headers: { 'X-Manse-Token': token } },
    { name: 'XManse-Token', headers: { 'XManse-Token': token } },
    { name: 'Authorization Bearer', headers: { 'Authorization': 'Bearer ' + token } },
    { name: 'Authorization plain', headers: { 'Authorization': token } },
    { name: 'token', headers: { 'token': token } },
    { name: 'api-token', headers: { 'api-token': token } },
    { name: 'X-Api-Token', headers: { 'X-Api-Token': token } },
    { name: 'X-Auth-Token', headers: { 'X-Auth-Token': token } },
    { name: 'Manse-Token', headers: { 'Manse-Token': token } },
    { name: 'apikey', headers: { 'apikey': token } },
    { name: 'x-api-key', headers: { 'x-api-key': token } }
  ];

  const results = [];
  for (const v of variations) {
    const t0 = Date.now();
    try {
      const r = await fetch(url, {
        method: 'GET',
        headers: { ...v.headers, 'Accept': 'application/json' }
      });
      const text = await r.text();
      results.push({
        header: v.name,
        status: r.status,
        latency_ms: Date.now() - t0,
        body_len: text.length,
        body_preview: text.slice(0, 300)
      });
    } catch (e) {
      results.push({ header: v.name, error: e.message });
    }
  }

  const success = results.filter(r => r.status && r.status !== 403 && r.status !== 401);
  const summary = {
    total: results.length,
    succeeded_count: success.length,
    succeeded: success.map(r => ({ header: r.header, status: r.status })),
    token_length: token.length,
    token_preview: token.slice(0, 4) + '...' + token.slice(-4)
  };

  res.setHeader('Cache-Control', 'no-cache');
  return res.status(200).json({ summary, results });
}
