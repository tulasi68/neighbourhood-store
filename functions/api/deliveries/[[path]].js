import { LSPs } from '../lsp/_adapter.js';

/** Catch-all so /api/deliveries/:id reaches this handler on Cloudflare Pages. */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;
  const db = env.DB;

  if (method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });

  try {
    const parts = url.pathname.replace('/api/deliveries', '').split('/').filter(Boolean);
    const id = parts[0] ? parseInt(parts[0]) : null;

    if (method === 'GET' && !id) {
      const orderId = url.searchParams.get('order_id');
      let q = 'SELECT * FROM deliveries';
      const params = [];
      if (orderId) { q += ' WHERE order_id = ?'; params.push(parseInt(orderId)); }
      q += ' ORDER BY created_at DESC LIMIT 100';
      const stmt = db.prepare(q);
      const { results } = params.length ? await stmt.bind(...params).all() : await stmt.all();
      return json({ deliveries: results });
    }

    if (method === 'GET' && id) {
      const d = await db.prepare('SELECT * FROM deliveries WHERE id = ?').bind(id).first();
      if (!d) return json({ error: 'Not found' }, 404);
      // Optionally refresh status from LSP
      if (d.lsp_ref && LSPs[d.lsp_name] && url.searchParams.get('refresh') === '1') {
        const st = await LSPs[d.lsp_name].getStatus(env, d.lsp_ref);
        if (st.ok && st.status !== d.status) {
          await db.prepare(`UPDATE deliveries SET status=?, updated_at=datetime('now') WHERE id=?`)
            .bind(st.status, id).run();
          d.status = st.status;
        }
      }
      return json({ delivery: d });
    }

    // Create a delivery — used by shopkeeper when accepting an order
    if (method === 'POST') {
      const body = await request.json();
      const orderId = body.order_id;
      if (!orderId) return json({ error: 'order_id required' }, 400);

      const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
      if (!order) return json({ error: 'Order not found' }, 404);

      const store = await db.prepare('SELECT * FROM stores WHERE id = ?').bind(order.store_id).first();
      const lspName = body.lsp_name || 'self';
      const adapter = LSPs[lspName];
      if (!adapter) return json({ error: `Unknown LSP: ${lspName}` }, 400);

      const payload = {
        order_ref: order.order_ref,
        store_name: store.name,
        store_address: store.address,
        store_phone: store.phone,
        buyer_name: order.buyer_name,
        buyer_mobile: order.buyer_mobile,
        buyer_address: body.buyer_address || store.address, // TODO: capture real address
        fee: body.fee || 0
      };

      const result = await adapter.createDelivery(env, payload);

      const ins = await db.prepare(
        `INSERT INTO deliveries (order_id, lsp_name, lsp_ref, status, fee, tracking_url, rider_name, rider_phone, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        orderId, lspName,
        result.lsp_ref || null,
        result.ok ? 'pending' : 'failed',
        result.fee || 0,
        result.tracking_url || null,
        result.rider_name || null,
        result.rider_phone || null,
        result.ok ? null : (result.error || 'create failed')
      ).run();

      // If delivery is assigned, bump order status
      if (result.ok) {
        await db.prepare(`UPDATE orders SET status='accepted', updated_at=datetime('now') WHERE id=?`)
          .bind(orderId).run();
      }

      return json({
        delivery_id: ins.meta.last_row_id,
        ok: result.ok,
        error: result.error,
        fee: result.fee,
        tracking_url: result.tracking_url
      });
    }

    // Cancel a delivery
    if (method === 'DELETE' && id) {
      const d = await db.prepare('SELECT * FROM deliveries WHERE id = ?').bind(id).first();
      if (!d) return json({ error: 'Not found' }, 404);
      if (d.lsp_ref && LSPs[d.lsp_name]) {
        await LSPs[d.lsp_name].cancel(env, d.lsp_ref);
      }
      await db.prepare(`UPDATE deliveries SET status='failed', updated_at=datetime('now') WHERE id=?`)
        .bind(id).run();
      return json({ success: true });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() }
  });
}
