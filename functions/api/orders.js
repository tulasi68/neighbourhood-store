/**
 * GET  /api/orders?store_id=&mobile=
 * POST /api/orders
 * PUT  /api/orders/:id
 *
 * UPDATED: POST now persists delivery_mode + delivery_fee
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
    const pathParts = url.pathname.replace('/api/orders', '').split('/').filter(Boolean);
    const id = pathParts[0] ? parseInt(pathParts[0]) : null;

    if (method === 'GET') {
      const storeId = url.searchParams.get('store_id');
      const mobile = url.searchParams.get('mobile');
      let query = 'SELECT * FROM orders WHERE 1=1';
      const params = [];
      if (storeId) { query += ' AND store_id = ?'; params.push(parseInt(storeId)); }
      if (mobile) { query += ' AND buyer_mobile = ?'; params.push(mobile); }
      query += ' ORDER BY created_at DESC LIMIT 100';
      const stmt = db.prepare(query);
      const { results } = params.length ? await stmt.bind(...params).all() : await stmt.all();
      return json({ orders: results });
    }

    if (method === 'POST') {
      const body = await request.json();
      const orderRef = 'NS-' + Math.random().toString(36).substring(2, 8).toUpperCase();

      // Persist delivery preference + fee sent by buyer checkout
      const deliveryMode = body.delivery_mode || 'self';
      const deliveryFee = parseFloat(body.delivery_fee) || 0;

      const result = await db.prepare(
        `INSERT INTO orders
           (order_ref, store_id, buyer_mobile, buyer_name, payment_method,
            total_amount, delivery_mode, delivery_fee, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'placed')`
      ).bind(
        orderRef,
        body.store_id,
        body.buyer_mobile,
        body.buyer_name || '',
        body.payment_method,
        body.total_amount,
        deliveryMode,
        deliveryFee
      ).run();

      const orderId = result.meta.last_row_id;

      if (Array.isArray(body.items)) {
        for (const item of body.items) {
          await db.prepare(
            `INSERT INTO order_items (order_id, product_id, product_name, qty, unit_price, line_total)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(
            orderId,
            item.product_id || null,
            item.product_name,
            item.qty,
            item.unit_price,
            item.line_total
          ).run();

          if (item.product_id) {
            await db.prepare(
              'UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?'
            ).bind(item.qty, item.product_id).run();
          }
        }
      }

      return json({
        order: {
          id: orderId,
          order_ref: orderRef,
          total_amount: body.total_amount,
          delivery_mode: deliveryMode,
          delivery_fee: deliveryFee,
          status: 'placed'
        }
      });
    }

    if (method === 'PUT' && id) {
      const body = await request.json();

      // Allow updating status and/or delivery fields (shopkeeper override)
      const fields = [];
      const values = [];

      if (body.status)        { fields.push('status = ?');        values.push(body.status); }
      if (body.delivery_mode) { fields.push('delivery_mode = ?'); values.push(body.delivery_mode); }
      if (body.delivery_fee !== undefined) {
        fields.push('delivery_fee = ?');
        values.push(parseFloat(body.delivery_fee) || 0);
      }
      if (body.payment_status) {
        fields.push('payment_status = ?');
        values.push(body.payment_status);
      }

      if (fields.length === 0) {
        return json({ error: 'No updatable fields provided' }, 400);
      }

      fields.push("updated_at = datetime('now')");
      values.push(id);

      await db.prepare(
        `UPDATE orders SET ${fields.join(', ')} WHERE id = ?`
      ).bind(...values).run();

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
