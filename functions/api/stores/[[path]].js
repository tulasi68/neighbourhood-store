/**
 * GET  /api/stores
 * POST /api/stores
 * GET  /api/stores/:id
 * PUT  /api/stores/:id
 * DELETE /api/stores/:id
 * Catch-all so /api/stores/:id reaches this handler on Cloudflare Pages.
 */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;
  const db = env.DB;

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  try {
    const pathParts = url.pathname.replace('/api/stores', '').split('/').filter(Boolean);
    const id = pathParts[0] ? parseInt(pathParts[0]) : null;

    if (method === 'GET' && !id) {
      const { results } = await db.prepare('SELECT * FROM stores WHERE is_active = 1 ORDER BY name').all();
      for (const s of results) {
        try { s.payment_options = JSON.parse(s.payment_options); } catch (e) {}
        try { s.delivery_config = JSON.parse(s.delivery_config); } catch (e) {}
      }
      return json({ stores: results });
    }

    if (method === 'GET' && id) {
      const store = await db.prepare('SELECT * FROM stores WHERE id = ?').bind(id).first();
      if (!store) return json({ error: 'Not found' }, 404);
      try { store.payment_options = JSON.parse(store.payment_options); } catch(e) {}
      try { store.delivery_config = JSON.parse(store.delivery_config); } catch(e) {}
      return json({ store });
    }

    if (method === 'POST') {
      const body = await request.json();
      const result = await db.prepare(
        `INSERT INTO stores (name, address, phone, payment_options) VALUES (?, ?, ?, ?)`
      ).bind(
        body.name,
        body.address || '',
        body.phone || '',
        JSON.stringify(body.payment_options || defaultPaymentOptions())
      ).run();
      return json({ id: result.meta.last_row_id, success: true });
    }

    if (method === 'PUT' && id) {
      const body = await request.json();
      await db.prepare(
        `UPDATE stores SET name=?, address=?, phone=?, payment_options=?, updated_at=datetime('now') WHERE id=?`
      ).bind(
        body.name,
        body.address || '',
        body.phone || '',
        JSON.stringify(body.payment_options || defaultPaymentOptions()),
        id
      ).run();
      return json({ success: true });
    }

    if (method === 'DELETE' && id) {
      await db.prepare('UPDATE stores SET is_active = 0 WHERE id = ?').bind(id).run();
      return json({ success: true });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

function defaultPaymentOptions() {
  return [
    { type: 'gpay', label: 'GPay / UPI', enabled: true, details: '' },
    { type: 'cash', label: 'Cash on Delivery / Pickup', enabled: true, details: '' },
    { type: 'qr', label: 'Scan QR Code', enabled: false, details: '' },
    { type: 'link', label: 'Payment Link', enabled: false, details: '' }
  ];
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() }
  });
}
