/**
 * POST /api/auth/request-otp
 * POST /api/auth/verify-otp
 * POST /api/auth/login   (admin / shopkeeper)
 *
 * NOTE: For pilot, OTP is fixed to "123456" and also returned in the response
 * so you can test without an SMS gateway. Replace with real SMS (MSG91/Twilio)
 * before public launch.
 */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;
  const db = env.DB;

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  if (method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await request.json();
    const path = url.pathname;

    if (path.endsWith('/request-otp')) {
      const mobile = (body.mobile || '').trim();
      if (!/^[6-9]\d{9}$/.test(mobile)) {
        return json({ error: 'Invalid mobile number' }, 400);
      }
      const otp = '123456'; // DEMO – replace with random + SMS
      const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await db.prepare('DELETE FROM otps WHERE mobile = ?').bind(mobile).run();
      await db.prepare('INSERT INTO otps (mobile, otp, expires_at) VALUES (?, ?, ?)').bind(mobile, otp, expires).run();
      return json({
        success: true,
        message: 'OTP sent (demo mode – use 123456)',
        demo_otp: otp
      });
    }

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
        id: user.id,
        mobile: user.mobile,
        role: 'buyer',
        exp: Date.now() + 24 * 60 * 60 * 1000
      }));
      return json({ token, user: { mobile: user.mobile, name: user.name || body.name, role: 'buyer' } });
    }

    if (path.endsWith('/login')) {
      const mobile = (body.mobile || '').trim();
      const pin = (body.pin || '').trim();
      const role = body.role || 'shopkeeper';

      if (role === 'admin' && mobile === '9999999999' && pin === 'admin123') {
        const token = btoa(JSON.stringify({ mobile, role: 'admin', exp: Date.now() + 86400000 }));
        return json({ token, user: { mobile, role: 'admin', name: 'Admin' } });
      }

      const user = await db.prepare(
        'SELECT * FROM users WHERE mobile = ? AND role = ?'
      ).bind(mobile, role).first();

      if (user && user.pin_hash === pin) {
        const token = btoa(JSON.stringify({
          id: user.id,
          mobile: user.mobile,
          role: user.role,
          store_id: user.store_id,
          exp: Date.now() + 86400000
        }));
        return json({
          token,
          user: {
            mobile: user.mobile,
            name: user.name,
            role: user.role,
            store_id: user.store_id
          }
        });
      }

      if (role === 'shopkeeper' && pin === 'shop123') {
        const token = btoa(JSON.stringify({ mobile, role: 'shopkeeper', store_id: 1, exp: Date.now() + 86400000 }));
        return json({ token, user: { mobile, role: 'shopkeeper', store_id: 1, name: 'Shopkeeper' } });
      }

      return json({ error: 'Invalid credentials' }, 401);
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
