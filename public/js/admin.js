/**
 * Admin – full control over stores, products, users, orders
 */
const Admin = {
  showLogin() {
    const app = document.getElementById('app');
    document.getElementById('bottom-nav').classList.add('hidden');
    app.innerHTML = `
      <div class="card">
        <h2>Admin Login</h2>
        <p style="color:var(--muted);font-size:0.9rem;margin-bottom:16px">
          Full system access. Protect this account carefully.
        </p>
        <div class="form-group">
          <label>Mobile</label>
          <input type="tel" id="adm-mobile" class="form-control" placeholder="9999999999" value="9999999999" />
        </div>
        <div class="form-group">
          <label>PIN</label>
          <input type="password" id="adm-pin" class="form-control" placeholder="admin123" />
        </div>
        <button class="btn btn-primary btn-block" onclick="Admin.doLogin()">Login as Admin</button>
        <button class="btn btn-outline btn-block" onclick="App.goHome()" style="margin-top:8px">Back</button>
        <p style="font-size:0.8rem;color:var(--muted);margin-top:12px;text-align:center">
          Demo: 9999999999 / admin123
        </p>
      </div>
    `;
  },

  async doLogin() {
    const mobile = document.getElementById('adm-mobile').value.trim();
    const pin = document.getElementById('adm-pin').value.trim();
    try {
      const res = await API.post('/auth/login', { mobile, pin, role: 'admin' });
      App.setUser(res.user, res.token);
      this.showDashboard();
    } catch (e) {
      App.toast(e.message || 'Login failed');
    }
  },

  showDashboard() {
    const app = document.getElementById('app');
    const nav = document.getElementById('bottom-nav');
    nav.classList.remove('hidden');
    this.renderNav(nav, 'dashboard');

    app.innerHTML = `
      <div class="card">
        <h2>Admin Panel</h2>
        <p style="color:var(--muted)">Full read / write / delete access</p>
      </div>
      <div class="role-grid">
        <div class="role-card" onclick="Admin.showStores()">
          <div class="emoji">🏪</div>
          <h3>Stores</h3>
          <p style="font-size:0.85rem;color:var(--muted)">Add / edit / delete stores</p>
        </div>
        <div class="role-card" onclick="Admin.showAllProducts()">
          <div class="emoji">📦</div>
          <h3>All Products</h3>
          <p style="font-size:0.85rem;color:var(--muted)">Cross-store catalogue</p>
        </div>
        <div class="role-card" onclick="Admin.showAllOrders()">
          <div class="emoji">🧾</div>
          <h3>All Orders</h3>
          <p style="font-size:0.85rem;color:var(--muted)">System-wide orders</p>
        </div>
        <div class="role-card" onclick="Admin.seedDemoData()">
          <div class="emoji">🌱</div>
          <h3>Seed Demo Data</h3>
          <p style="font-size:0.85rem;color:var(--muted)">Load sample store + products</p>
        </div>
      </div>
    `;
  },

  async showStores() {
    const app = document.getElementById('app');
    this.renderNav(document.getElementById('bottom-nav'), 'stores');
    let stores = [];
    try {
      const res = await API.get('/stores');
      stores = res.stores || [];
    } catch (e) {
      stores = JSON.parse(localStorage.getItem('ns_stores') || '[]');
    }

    app.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h2>Stores</h2>
        <button class="btn btn-primary btn-sm" onclick="Admin.showAddStore()">+ Add Store</button>
      </div>
      ${stores.length === 0 ? '<div class="empty">No stores yet.</div>' :
        stores.map(s => `
          <div class="card">
            <h3>${s.name}</h3>
            <p style="font-size:0.85rem;color:var(--muted)">${s.address || ''}</p>
            <p style="font-size:0.85rem">📞 ${s.phone || '–'}</p>
            <div style="margin-top:10px">
              <button class="btn btn-sm btn-outline" onclick="Admin.editStore(${s.id})">Edit</button>
              <button class="btn btn-sm btn-danger" onclick="Admin.deleteStore(${s.id})">Delete</button>
            </div>
          </div>
        `).join('')}
      <button class="btn btn-outline btn-block" onclick="Admin.showDashboard()">← Dashboard</button>
    `;
  },

  showAddStore(store = null) {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="card">
        <h2>${store ? 'Edit' : 'Add'} Store</h2>
        <div class="form-group">
          <label>Store Name *</label>
          <input type="text" id="st-name" class="form-control" value="${store?.name || ''}" />
        </div>
        <div class="form-group">
          <label>Address</label>
          <textarea id="st-address" class="form-control" rows="2">${store?.address || ''}</textarea>
        </div>
        <div class="form-group">
          <label>Phone Number(s)</label>
          <input type="text" id="st-phone" class="form-control" value="${store?.phone || ''}" placeholder="9876543210, 9123456789" />
        </div>
        <button class="btn btn-primary btn-block" onclick="Admin.saveStore(${store?.id || 'null'})">Save</button>
        <button class="btn btn-outline btn-block" onclick="Admin.showStores()">Cancel</button>
      </div>
    `;
  },

  async saveStore(id) {
    const data = {
      name: document.getElementById('st-name').value.trim(),
      address: document.getElementById('st-address').value.trim(),
      phone: document.getElementById('st-phone').value.trim(),
      payment_options: [
        { type: 'gpay', label: 'GPay / UPI', enabled: true, details: '' },
        { type: 'cash', label: 'Cash on Delivery / Pickup', enabled: true, details: '' },
        { type: 'qr', label: 'Scan QR Code', enabled: false, details: '' },
        { type: 'link', label: 'Payment Link', enabled: false, details: '' }
      ]
    };
    if (!data.name) {
      App.toast('Store name is required');
      return;
    }
    let stores = JSON.parse(localStorage.getItem('ns_stores') || '[]');
    if (id) {
      stores = stores.map(s => s.id === id ? { ...s, ...data } : s);
    } else {
      data.id = Date.now();
      data.is_active = 1;
      stores.push(data);
    }
    localStorage.setItem('ns_stores', JSON.stringify(stores));
    try {
      if (id) await API.put(`/stores/${id}`, data);
      else await API.post('/stores', data);
    } catch (e) {}
    App.toast('Store saved');
    this.showStores();
  },

  editStore(id) {
    const stores = JSON.parse(localStorage.getItem('ns_stores') || '[]');
    const s = stores.find(x => x.id === id);
    if (s) this.showAddStore(s);
  },

  async deleteStore(id) {
    if (!confirm('Delete this store and all its products?')) return;
    let stores = JSON.parse(localStorage.getItem('ns_stores') || '[]');
    stores = stores.filter(s => s.id !== id);
    localStorage.setItem('ns_stores', JSON.stringify(stores));
    try { await API.del(`/stores/${id}`); } catch (e) {}
    App.toast('Store deleted');
    this.showStores();
  },

  async showAllProducts() {
    const app = document.getElementById('app');
    this.renderNav(document.getElementById('bottom-nav'), 'products');
    let products = JSON.parse(localStorage.getItem('ns_products') || '[]');
    try {
      const res = await API.get('/products');
      if (res.products) products = res.products;
    } catch (e) {}

    app.innerHTML = `
      <h2 style="margin-bottom:12px">All Products (${products.length})</h2>
      <div class="card" style="padding:0">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Store</th><th>Name</th><th>Price</th><th></th></tr></thead>
            <tbody>
              ${products.length === 0 ? '<tr><td colspan="4" class="empty">No products</td></tr>' :
                products.slice(0, 100).map(p => `
                  <tr>
                    <td>${p.store_id}</td>
                    <td>${p.name}<br><span style="font-size:0.75rem;color:var(--muted)">${p.category || ''}</span></td>
                    <td>₹${p.selling_price}</td>
                    <td><button class="btn btn-sm btn-danger" onclick="Admin.deleteAnyProduct(${p.id})">Del</button></td>
                  </tr>
                `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <button class="btn btn-outline btn-block" onclick="Admin.showDashboard()">← Dashboard</button>
    `;
  },

  async deleteAnyProduct(id) {
    if (!confirm('Delete this product?')) return;
    let products = JSON.parse(localStorage.getItem('ns_products') || '[]');
    products = products.filter(p => p.id !== id);
    localStorage.setItem('ns_products', JSON.stringify(products));
    try { await API.del(`/products/${id}`); } catch (e) {}
    App.toast('Deleted');
    this.showAllProducts();
  },

  async showAllOrders() {
    const app = document.getElementById('app');
    this.renderNav(document.getElementById('bottom-nav'), 'orders');
    let orders = JSON.parse(localStorage.getItem('ns_orders') || '[]');
    try {
      const res = await API.get('/orders');
      if (res.orders) orders = res.orders;
    } catch (e) {}

    app.innerHTML = `
      <h2 style="margin-bottom:12px">All Orders (${orders.length})</h2>
      ${orders.length === 0 ? '<div class="empty">No orders yet.</div>' :
        orders.map(o => `
          <div class="card">
            <div style="display:flex;justify-content:space-between">
              <strong>${o.order_ref}</strong>
              <span class="badge badge-${o.status}">${o.status}</span>
            </div>
            <p style="font-size:0.85rem">${o.buyer_name || ''} · ${o.buyer_mobile} · Store #${o.store_id}</p>
            <p>₹${o.total_amount} · ${o.payment_method}</p>
          </div>
        `).join('')}
      <button class="btn btn-outline btn-block" onclick="Admin.showDashboard()">← Dashboard</button>
    `;
  },

  seedDemoData() {
    const stores = [{
      id: 1,
      name: 'Tulasi Neighbourhood Store',
      address: '12, Main Road, Near Bus Stand, Bangalore – 560001',
      phone: '9876543210, 9123456789',
      payment_options: [
        { type: 'gpay', label: 'GPay / UPI', enabled: true, details: '' },
        { type: 'cash', label: 'Cash on Delivery / Pickup', enabled: true, details: '' },
        { type: 'qr', label: 'Scan QR Code', enabled: false, details: '' },
        { type: 'link', label: 'Payment Link', enabled: false, details: '' }
      ],
      is_active: 1
    }];
    localStorage.setItem('ns_stores', JSON.stringify(stores));

    const products = [
      { id: 101, store_id: 1, category: 'Staples', name: 'Sona Masoori Rice', weight: '5 kg', volume: '', mrp: 320, selling_price: 299, stock: 50 },
      { id: 102, store_id: 1, category: 'Staples', name: 'Atta (Aashirvaad)', weight: '5 kg', volume: '', mrp: 280, selling_price: 265, stock: 60 },
      { id: 103, store_id: 1, category: 'Staples', name: 'Toor Dal', weight: '1 kg', volume: '', mrp: 160, selling_price: 149, stock: 40 },
      { id: 104, store_id: 1, category: 'Staples', name: 'Sunflower Oil', weight: '', volume: '1 L', mrp: 160, selling_price: 149, stock: 50 },
      { id: 105, store_id: 1, category: 'Dairy', name: 'Milk (Amul Toned)', weight: '', volume: '500 ml', mrp: 30, selling_price: 28, stock: 100 },
      { id: 106, store_id: 1, category: 'Dairy', name: 'Curd (Amul)', weight: '400 g', volume: '', mrp: 40, selling_price: 36, stock: 60 },
      { id: 107, store_id: 1, category: 'Personal Care', name: 'Toilet Soap (Lux)', weight: '100 g', volume: '', mrp: 45, selling_price: 40, stock: 80 },
      { id: 108, store_id: 1, category: 'Household', name: 'Dishwashing Soap (Vim)', weight: '150 g', volume: '', mrp: 25, selling_price: 22, stock: 80 },
      { id: 109, store_id: 1, category: 'Household', name: 'Detergent Powder (Surf Excel)', weight: '1 kg', volume: '', mrp: 180, selling_price: 165, stock: 40 },
      { id: 110, store_id: 1, category: 'Snacks', name: 'Parle-G Biscuits', weight: '800 g', volume: '', mrp: 70, selling_price: 65, stock: 80 },
      { id: 111, store_id: 1, category: 'Beverages', name: 'Tea (Tata Gold)', weight: '250 g', volume: '', mrp: 140, selling_price: 129, stock: 40 },
      { id: 112, store_id: 1, category: 'Spices', name: 'Turmeric Powder', weight: '100 g', volume: '', mrp: 40, selling_price: 35, stock: 50 },
    ];
    localStorage.setItem('ns_products', JSON.stringify(products));
    App.toast('Demo store + 12 products seeded. Shopkeeper can import full CSV for more.');
    this.showDashboard();
  },

  renderNav(nav, active) {
    nav.innerHTML = `
      <a href="#" class="${active === 'dashboard' ? 'active' : ''}" onclick="Admin.showDashboard();return false">
        <span class="icon">🏠</span>Home
      </a>
      <a href="#" class="${active === 'stores' ? 'active' : ''}" onclick="Admin.showStores();return false">
        <span class="icon">🏪</span>Stores
      </a>
      <a href="#" class="${active === 'products' ? 'active' : ''}" onclick="Admin.showAllProducts();return false">
        <span class="icon">📦</span>Products
      </a>
      <a href="#" class="${active === 'orders' ? 'active' : ''}" onclick="Admin.showAllOrders();return false">
        <span class="icon">🧾</span>Orders
      </a>
    `;
  },

  render(app, nav) {
    this.showDashboard();
  }
};
