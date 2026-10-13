/**
 * POST /api/auth/request-otp
 * POST /api/auth/verify-otp
 * POST /api/auth/login   (admin / shopkeeper)
 */


export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;
  const db = env.DB;

  if (method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });
  if (method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await request.json();
    const path = url.pathname;

    // ── Request OTP ─────────────────────────────────────
    if (path.endsWith('/request-otp')) {
      const mobile = (body.mobile || '').trim();
      if (!/^[6-9]\d{9}$/.test(mobile)) {
        return json({ error: 'Enter a valid 10-digit Indian mobile number' }, 400);
      }
      const otp = '123456'; // DEMO — replace with random + SMS before public launch
      const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await db.prepare('DELETE FROM otps WHERE mobile = ?').bind(mobile).run();
      await db.prepare('INSERT INTO otps (mobile, otp, expires_at) VALUES (?, ?, ?)').bind(mobile, otp, expires).run();
      return json({
        success: true,
        message: 'OTP sent (demo mode – use 123456)',
        demo_otp: otp
      });
    }

    // ── Verify OTP ──────────────────────────────────────
    if (path.endsWith('/verify-otp')) {
      const mobile = (body.mobile || '').trim();
      const otp = (body.otp || '').trim();
      const row = await db.prepare(
        'SELECT * FROM otps WHERE mobile = ? AND otp = ? AND expires_at > datetime("now")'
      ).bind(mobile, otp).first();

      if (!row && otp !== '123456') {
        return json({ error: 'Invalid or expired OTP' }, 401);
      }
      await db.prepare('DELETE FROM otps WHERE mobile = ?').bind(mobile).run();

      let user = await db.prepare('SELECT * FROM users WHERE mobile = ?').bind(mobile).first();
      if (!user) {
        const r = await db.prepare(
          'INSERT INTO users (mobile, name, role) VALUES (?, ?, ?)'
        ).bind(mobile, body.name || '', 'buyer').run();
        user = { id: r.meta.last_row_id, mobile, name: body.name || '', role: 'buyer' };
      }

      const token = btoa(JSON.stringify({
        id: user.id, mobile: user.mobile, role: 'buyer',
        exp: Date.now() + 24 * 60 * 60 * 1000
      }));
      return json({ token, user: { mobile: user.mobile, name: user.name || body.name, role: 'buyer' } });
    }

    // ── Admin / Shopkeeper login ────────────────────────
    if (path.endsWith('/login')) {
      const mobile = (body.mobile || '').trim();
      const pin = (body.pin || '').trim();
      const role = body.role || 'shopkeeper';

      if (!mobile || !pin) return json({ error: 'Mobile and PIN are required' }, 400);

      // Admin demo login
      if (role === 'admin') {
        if (mobile === '9999999999' && pin === 'admin123') {
          const token = btoa(JSON.stringify({ mobile, role: 'admin', exp: Date.now() + 86400000 }));
          return json({ token, user: { mobile, role: 'admin', name: 'Admin' } });
        }
        return json({ error: 'Invalid admin credentials' }, 401);
      }

      // Shopkeeper
      if (role === 'shopkeeper') {
        const user = await db.prepare(
          'SELECT * FROM users WHERE mobile = ? AND role = ?'
        ).bind(mobile, role).first();

        if (user && user.pin_hash === pin) {
          const token = btoa(JSON.stringify({
            id: user.id, mobile: user.mobile, role: user.role,
            store_id: user.store_id, exp: Date.now() + 86400000
          }));
          return json({
            token,
            user: { mobile: user.mobile, name: user.name, role: user.role, store_id: user.store_id }
          });
        }

        // Demo fallback: any valid mobile + shop123
        if (pin === 'shop123' && /^[6-9]\d{9}$/.test(mobile)) {
          const token = btoa(JSON.stringify({
            mobile, role: 'shopkeeper', store_id: 1, exp: Date.now() + 86400000
          }));
          return json({
            token,
            user: { mobile, role: 'shopkeeper', store_id: 1, name: 'Shopkeeper (demo)' }
          });
        }

        if (!user) return json({ error: 'Mobile number not registered as a shopkeeper' }, 401);
        return json({ error: 'Incorrect PIN' }, 401);
      }

      return json({ error: 'Invalid role' }, 400);
    }

    return json({ error: 'Unknown endpoint' }, 404);
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
