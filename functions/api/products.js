/**
 * GET    /api/products?store_id=
 * POST   /api/products
 * PUT    /api/products/:id
 * DELETE /api/products/:id
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
    const pathParts = url.pathname.replace('/api/products', '').split('/').filter(Boolean);
    const id = pathParts[0] ? parseInt(pathParts[0]) : null;
    const storeId = url.searchParams.get('store_id');

    if (method === 'GET') {
      let query = 'SELECT * FROM products WHERE is_active = 1';
      const params = [];
      if (storeId) {
        query += ' AND store_id = ?';
        params.push(parseInt(storeId));
      }
      query += ' ORDER BY category, name';
      const stmt = db.prepare(query);
      const { results } = params.length ? await stmt.bind(...params).all() : await stmt.all();
      return json({ products: results });
    }

    if (method === 'POST') {
      const body = await request.json();
      const result = await db.prepare(
        `INSERT INTO products (store_id, category, name, weight, volume, mrp, selling_price, stock)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        body.store_id,
        body.category || '',
        body.name,
        body.weight || '',
        body.volume || '',
        body.mrp || null,
        body.selling_price,
        body.stock || 0
      ).run();
      return json({ id: result.meta.last_row_id, success: true });
    }

    if (method === 'PUT' && id) {
      const body = await request.json();
      await db.prepare(
        `UPDATE products SET category=?, name=?, weight=?, volume=?, mrp=?, selling_price=?, stock=?, updated_at=datetime('now')
         WHERE id=?`
      ).bind(
        body.category || '',
        body.name,
        body.weight || '',
        body.volume || '',
        body.mrp || null,
        body.selling_price,
        body.stock || 0,
        id
      ).run();
      return json({ success: true });
    }

    if (method === 'DELETE' && id) {
      await db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').bind(id).run();
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
