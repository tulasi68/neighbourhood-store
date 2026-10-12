/**
 * Shopkeeper: login → products CRUD → orders → payment options
 */
const Shopkeeper = {
  products: [],
  orders: [],

  showLogin() {
    const app = document.getElementById('app');
    document.getElementById('bottom-nav').classList.add('hidden');
    app.innerHTML = `
      <div class="card">
        <h2>Shopkeeper Login</h2>
        <p style="color:var(--muted);font-size:0.9rem;margin-bottom:16px">
          Use the Store Code and PIN provided by Admin.
        </p>
        <div class="form-group">
          <label>Mobile / Store Code</label>
          <input type="text" id="sk-mobile" class="form-control" placeholder="Your mobile or store code" />
        </div>
        <div class="form-group">
          <label>PIN</label>
          <input type="password" id="sk-pin" class="form-control" placeholder="Your PIN" />
        </div>
        <button class="btn btn-primary btn-block" onclick="Shopkeeper.doLogin()">Login</button>
        <button class="btn btn-outline btn-block" onclick="App.goHome()" style="margin-top:8px">Back</button>
      </div>
    `;
  },

  async doLogin() {
    const mobile = document.getElementById('sk-mobile').value.trim();
    const pin = document.getElementById('sk-pin').value.trim();
    if (!mobile || !pin) {
      App.toast('Enter mobile/code and PIN');
      return;
    }
    try {
      const res = await API.post('/auth/login', { mobile, pin, role: 'shopkeeper' });
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
        <h2>Shopkeeper Dashboard</h2>
        <p style="color:var(--muted)">Store ID: ${App.state.user.store_id || 1}</p>
      </div>
      <div class="role-grid">
        <div class="role-card" onclick="Shopkeeper.showProducts()">
          <div class="emoji">📦</div>
          <h3>Products</h3>
          <p style="font-size:0.85rem;color:var(--muted)">Add, edit, delete items</p>
        </div>
        <div class="role-card" onclick="Shopkeeper.showOrders()">
          <div class="emoji">🧾</div>
          <h3>Orders</h3>
          <p style="font-size:0.85rem;color:var(--muted)">View & update status</p>
        </div>
        <div class="role-card" onclick="Shopkeeper.showPaymentOptions()">
          <div class="emoji">💳</div>
          <h3>Payment Options</h3>
          <p style="font-size:0.85rem;color:var(--muted)">GPay, QR, Link, Cash</p>
        </div>
        <div class="role-card" onclick="Shopkeeper.showImport()">
          <div class="emoji">📥</div>
          <h3>Import CSV</h3>
          <p style="font-size:0.85rem;color:var(--muted)">Bulk upload products</p>
        </div>
      </div>
    `;
  },

  async showProducts() {
    const app = document.getElementById('app');
    this.renderNav(document.getElementById('bottom-nav'), 'products');
    app.innerHTML = `<div class="card"><p>Loading products…</p></div>`;

    const storeId = App.state.user.store_id || 1;
    try {
      let { products } = await API.get(`/products?store_id=${storeId}`);
      if (!products || products.length === 0) {
        products = JSON.parse(localStorage.getItem('ns_products') || '[]')
          .filter(p => p.store_id === storeId);
      }
      this.products = products;
      this._renderProducts(app);
    } catch (e) {
      this.products = [];
      this._renderProducts(app);
    }
  },

  _renderProducts(app) {
    app.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h2>Products (${this.products.length})</h2>
        <button class="btn btn-primary btn-sm" onclick="Shopkeeper.showAddProduct()">+ Add</button>
      </div>
      <div class="card" style="padding:0">
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Price</th><th>Stock</th><th></th></tr>
            </thead>
            <tbody>
              ${this.products.length === 0 ? '<tr><td colspan="4" class="empty">No products yet. Add or import.</td></tr>' :
                this.products.map(p => `
                  <tr>
                    <td>
                      <strong>${p.name}</strong><br>
                      <span style="font-size:0.75rem;color:var(--muted)">${p.category || ''} ${p.weight || p.volume || ''}</span>
                    </td>
                    <td>₹${p.selling_price}</td>
                    <td>${p.stock ?? '–'}</td>
                    <td>
                      <button class="btn btn-sm btn-outline" onclick="Shopkeeper.editProduct(${p.id})">Edit</button>
                      <button class="btn btn-sm btn-danger" onclick="Shopkeeper.deleteProduct(${p.id})">Del</button>
                    </td>
                  </tr>
                `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <button class="btn btn-outline btn-block" onclick="Shopkeeper.showDashboard()">← Dashboard</button>
    `;
  },

  showAddProduct(product = null) {
    const app = document.getElementById('app');
    const isEdit = !!product;
    app.innerHTML = `
      <div class="card">
        <h2>${isEdit ? 'Edit' : 'Add'} Product</h2>
        <div class="form-group">
          <label>Category</label>
          <input type="text" id="p-cat" class="form-control" value="${product?.category || ''}" placeholder="e.g. Staples" />
        </div>
        <div class="form-group">
          <label>Item Name *</label>
          <input type="text" id="p-name" class="form-control" value="${product?.name || ''}" />
        </div>
        <div class="form-group">
          <label>Weight</label>
          <input type="text" id="p-weight" class="form-control" value="${product?.weight || ''}" placeholder="e.g. 5 kg" />
        </div>
        <div class="form-group">
          <label>Volume</label>
          <input type="text" id="p-volume" class="form-control" value="${product?.volume || ''}" placeholder="e.g. 1 L" />
        </div>
        <div class="form-group">
          <label>MRP (₹)</label>
          <input type="number" id="p-mrp" class="form-control" value="${product?.mrp || ''}" step="0.01" />
        </div>
        <div class="form-group">
          <label>Selling Price (₹) *</label>
          <input type="number" id="p-price" class="form-control" value="${product?.selling_price || ''}" step="0.01" />
        </div>
        <div class="form-group">
          <label>Stock</label>
          <input type="number" id="p-stock" class="form-control" value="${product?.stock ?? 0}" />
        </div>
        <button class="btn btn-primary btn-block" onclick="Shopkeeper.saveProduct(${product?.id || 'null'})">Save</button>
        <button class="btn btn-outline btn-block" onclick="Shopkeeper.showProducts()">Cancel</button>
      </div>
    `;
  },

  async saveProduct(id) {
    const data = {
      category: document.getElementById('p-cat').value.trim(),
      name: document.getElementById('p-name').value.trim(),
      weight: document.getElementById('p-weight').value.trim(),
      volume: document.getElementById('p-volume').value.trim(),
      mrp: parseFloat(document.getElementById('p-mrp').value) || null,
      selling_price: parseFloat(document.getElementById('p-price').value),
      stock: parseInt(document.getElementById('p-stock').value) || 0,
      store_id: App.state.user.store_id || 1
    };
    if (!data.name || !data.selling_price) {
      App.toast('Name and Selling Price are required');
      return;
    }

    try {
      if (id) {
        await API.put(`/products/${id}`, data);
        App.toast('Product updated');
      } else {
        await API.post('/products', data);
        App.toast('Product added');
      }
      let products = JSON.parse(localStorage.getItem('ns_products') || '[]');
      if (id) {
        products = products.map(p => p.id === id ? { ...p, ...data } : p);
      } else {
        data.id = Date.now();
        products.push(data);
      }
      localStorage.setItem('ns_products', JSON.stringify(products));
      this.showProducts();
    } catch (e) {
      App.toast(e.message);
    }
  },

  editProduct(id) {
    const p = this.products.find(x => x.id === id);
    if (p) this.showAddProduct(p);
  },

  async deleteProduct(id) {
    if (!confirm('Delete this product?')) return;
    try {
      await API.del(`/products/${id}`);
      let products = JSON.parse(localStorage.getItem('ns_products') || '[]');
      products = products.filter(p => p.id !== id);
      localStorage.setItem('ns_products', JSON.stringify(products));
      App.toast('Deleted');
      this.showProducts();
    } catch (e) {
      App.toast(e.message);
    }
  },

  async showOrders() {
    const app = document.getElementById('app');
    this.renderNav(document.getElementById('bottom-nav'), 'orders');
    app.innerHTML = `<div class="card"><p>Loading orders…</p></div>`;
    try {
      const { orders } = await API.get(`/orders?store_id=${App.state.user.store_id || 1}`);
      this.orders = orders || [];
      app.innerHTML = `
        <h2 style="margin-bottom:12px">Orders</h2>
        ${this.orders.length === 0 ? '<div class="empty">No orders yet.</div>' :
          this.orders.map(o => `
            <div class="card">
              <div style="display:flex;justify-content:space-between">
                <strong>${o.order_ref}</strong>
                <span class="badge badge-${o.status}">${o.status}</span>
              </div>
              <p style="font-size:0.85rem">${o.buyer_name || ''} · ${o.buyer_mobile}</p>
              <p>₹${o.total_amount} · ${o.payment_method}</p>
              <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
                ${['accepted','preparing','ready','completed','cancelled'].map(s =>
                  `<button class="btn btn-sm btn-outline" onclick="Shopkeeper.updateStatus(${o.id},'${s}')">${s}</button>`
                ).join('')}
              </div>
            </div>
          `).join('')}
        <button class="btn btn-outline btn-block" onclick="Shopkeeper.showDashboard()">← Dashboard</button>
      `;
    } catch (e) {
      app.innerHTML = `<div class="empty">Could not load orders.</div>`;
    }
  },

  async updateStatus(orderId, status) {
    try {
      await API.put(`/orders/${orderId}`, { status });
      App.toast('Status updated');
      this.showOrders();
    } catch (e) {
      App.toast(e.message);
    }
  },

  showPaymentOptions() {
    const app = document.getElementById('app');
    const defaults = [
      { type: 'gpay', label: 'GPay / UPI', enabled: true, details: '' },
      { type: 'cash', label: 'Cash on Delivery / Pickup', enabled: true, details: '' },
      { type: 'qr', label: 'Scan QR Code', enabled: false, details: '' },
      { type: 'link', label: 'Payment Link', enabled: false, details: '' }
    ];
    const opts = defaults;

    app.innerHTML = `
      <div class="card">
        <h2>Payment Options</h2>
        <p style="color:var(--muted);font-size:0.9rem;margin-bottom:16px">
          Enable the methods you accept and fill in the details (UPI ID, QR image URL, or payment link).
          GPay is enabled by default as an easy option.
        </p>
        ${opts.map((o, i) => `
          <div style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:12px">
            <label style="display:flex;align-items:center;gap:8px">
              <input type="checkbox" id="pay-en-${i}" ${o.enabled ? 'checked' : ''} />
              <strong>${o.label}</strong>
            </label>
            <div class="form-group" style="margin-top:8px;margin-bottom:0">
              <label>Details (UPI ID / Link / instructions)</label>
              <input type="text" id="pay-det-${i}" class="form-control" value="${o.details || ''}"
                     placeholder="${o.type === 'gpay' ? 'yourname@upi' : o.type === 'link' ? 'https://...' : 'Optional notes'}" />
            </div>
          </div>
        `).join('')}
        <button class="btn btn-primary btn-block" onclick="Shopkeeper.savePaymentOptions()">Save Options</button>
        <button class="btn btn-outline btn-block" onclick="Shopkeeper.showDashboard()">Cancel</button>
      </div>
    `;
  },

  async savePaymentOptions() {
    App.toast('Payment options saved (demo)');
    this.showDashboard();
  },

  showImport() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="card">
        <h2>Import Products from CSV</h2>
        <p style="color:var(--muted);font-size:0.9rem;margin-bottom:12px">
          Download the seed file <code>products_seed.csv</code> from the repository,
          edit it, then upload here. Columns required:<br>
          <code>Category, Item Name, Weight, Volume, MRP, Selling Price, Stock</code>
        </p>
        <div class="form-group">
          <label>Select CSV file</label>
          <input type="file" id="csv-file" accept=".csv" class="form-control" />
        </div>
        <button class="btn btn-primary btn-block" onclick="Shopkeeper.doImport()">Import</button>
        <button class="btn btn-outline btn-block" onclick="Shopkeeper.showDashboard()">Cancel</button>
        <div id="import-result" style="margin-top:16px"></div>
      </div>
    `;
  },

  doImport() {
    const file = document.getElementById('csv-file').files[0];
    if (!file) {
      App.toast('Select a CSV file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.trim().split('\n');
      const storeId = App.state.user.store_id || 1;
      let products = JSON.parse(localStorage.getItem('ns_products') || '[]');
      let added = 0, skipped = 0;
      const errors = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        if (cols.length < 6) { skipped++; continue; }
        const name = cols[1];
        const price = parseFloat(cols[5]);
        if (!name || isNaN(price)) {
          errors.push(`Row ${i + 1}: missing name or price`);
          skipped++;
          continue;
        }
        products.push({
          id: Date.now() + i,
          store_id: storeId,
          category: cols[0] || '',
          name,
          weight: cols[2] || '',
          volume: cols[3] || '',
          mrp: parseFloat(cols[4]) || null,
          selling_price: price,
          stock: parseInt(cols[6]) || 0
        });
        added++;
      }
      localStorage.setItem('ns_products', JSON.stringify(products));
      document.getElementById('import-result').innerHTML = `
        <div style="background:#d1e7dd;padding:12px;border-radius:8px">
          <strong>${added}</strong> products imported.<br>
          ${skipped ? `<span style="color:#842029">${skipped} rows skipped.</span>` : ''}
          ${errors.length ? `<ul>${errors.slice(0,5).map(e => `<li>${e}</li>`).join('')}</ul>` : ''}
        </div>
      `;
      App.toast(`${added} products imported`);
    };
    reader.readAsText(file);
  },

  renderNav(nav, active) {
    nav.innerHTML = `
      <a href="#" class="${active === 'dashboard' ? 'active' : ''}" onclick="Shopkeeper.showDashboard();return false">
        <span class="icon">🏠</span>Home
      </a>
      <a href="#" class="${active === 'products' ? 'active' : ''}" onclick="Shopkeeper.showProducts();return false">
        <span class="icon">📦</span>Products
      </a>
      <a href="#" class="${active === 'orders' ? 'active' : ''}" onclick="Shopkeeper.showOrders();return false">
        <span class="icon">🧾</span>Orders
      </a>
    `;
  },

  render(app, nav) {
    this.showDashboard();
  }
};
