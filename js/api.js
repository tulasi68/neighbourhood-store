/**
 * API helper – talks to Cloudflare Pages Functions.
 * Falls back to localStorage ONLY if demo mode is explicitly enabled:
 *   localStorage.setItem('ns_demo_mode', '1')  // enable mock
 *   localStorage.removeItem('ns_demo_mode')    // disable mock
 */
const API = {
  base: '/api',

  async request(path, options = {}) {
    const token = localStorage.getItem('ns_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    };

    try {
      const res = await fetch(`${this.base}${path}`, {
        ...options,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      console.warn('API error:', path, err.message);
      if (localStorage.getItem('ns_demo_mode') === '1') {
        console.warn('→ falling back to demo mock');
        return this._mock(path, options);
      }
      throw err;
    }
  },

  get(path) { return this.request(path); },
  post(path, body) { return this.request(path, { method: 'POST', body }); },
  put(path, body) { return this.request(path, { method: 'PUT', body }); },
  del(path) { return this.request(path, { method: 'DELETE' }); },

  _mock(path, options) {
    const method = (options.method || 'GET').toUpperCase();
    const stores = JSON.parse(localStorage.getItem('ns_stores') || '[]');
    const products = JSON.parse(localStorage.getItem('ns_products') || '[]');
    const orders = JSON.parse(localStorage.getItem('ns_orders') || '[]');

    if (stores.length === 0) {
      stores.push({
        id: 1,
        name: 'Tulasi Neighbourhood Store',
        address: '12, Main Road, Bangalore – 560001',
        phone: '9876543210, 9123456789',
        payment_options: [
          { type: 'gpay', label: 'GPay / UPI', enabled: true, details: '' },
          { type: 'cash', label: 'Cash on Delivery / Pickup', enabled: true, details: '' },
          { type: 'qr', label: 'Scan QR Code', enabled: false, details: '' },
          { type: 'link', label: 'Payment Link', enabled: false, details: '' }
        ],
        delivery_config: { mode: 'self', self_fee: 0, lsp_fee_estimate: 0 },
        is_active: 1
      });
      localStorage.setItem('ns_stores', JSON.stringify(stores));
    }

    if (path === '/stores' && method === 'GET') return { stores };
    if (path.startsWith('/stores/') && method === 'GET') {
      const id = parseInt(path.split('/')[2]);
      return { store: stores.find(s => s.id === id) };
    }
    if (path.startsWith('/products?store_id=')) {
      const sid = parseInt(path.split('=')[1]);
      return { products: products.filter(p => p.store_id === sid) };
    }
    if (path === '/auth/request-otp' && method === 'POST') {
      const otp = '123456';
      localStorage.setItem('ns_demo_otp', otp);
      return { success: true, message: 'OTP sent (demo)', demo_otp: otp };
    }
    if (path === '/auth/verify-otp' && method === 'POST') {
      const { mobile, otp } = options.body;
      if (otp === '123456' || otp === localStorage.getItem('ns_demo_otp')) {
        const token = btoa(JSON.stringify({ mobile, role: 'buyer', exp: Date.now() + 86400000 }));
        return { token, user: { mobile, role: 'buyer', name: options.body.name || '' } };
      }
      throw new Error('Invalid OTP');
    }
    if (path === '/auth/login' && method === 'POST') {
      const { mobile, pin, role } = options.body;
      if (role === 'admin' && mobile === '9999999999' && pin === 'admin123') {
        const token = btoa(JSON.stringify({ mobile, role: 'admin', exp: Date.now() + 86400000 }));
        return { token, user: { mobile, role: 'admin', name: 'Admin' } };
      }
      if (role === 'shopkeeper' && pin === 'shop123') {
        const token = btoa(JSON.stringify({ mobile, role: 'shopkeeper', store_id: 1, exp: Date.now() + 86400000 }));
        return { token, user: { mobile, role: 'shopkeeper', store_id: 1, name: 'Shopkeeper' } };
      }
      throw new Error('Invalid credentials');
    }
    if (path === '/orders' && method === 'POST') {
      const order = {
        id: Date.now(),
        order_ref: 'NS-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        ...options.body,
        status: 'placed',
        created_at: new Date().toISOString()
      };
      orders.push(order);
      localStorage.setItem('ns_orders', JSON.stringify(orders));
      return { order };
    }
    if (path === '/orders' && method === 'GET') return { orders };
    if (path === '/deliveries' && method === 'POST') {
      return { ok: true, delivery_id: Date.now(), lsp_name: options.body.lsp_name };
    }
    if (path === '/deliveries' && method === 'GET') return { deliveries: [] };
    return { success: true };
  }
};
