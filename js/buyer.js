/**
 * Buyer flows: OTP login → select store → browse → cart → checkout
 */
const Buyer = {
  tempMobile: '',
  tempName: '',
  products: [],
  filterCategory: 'All',

  showLogin() {
    const app = document.getElementById('app');
    document.getElementById('bottom-nav').classList.add('hidden');
    app.innerHTML = `
      <div class="card">
        <h2>Buyer Login</h2>
        <p style="color:var(--muted);font-size:0.9rem;margin-bottom:16px">
          Enter your mobile number. We will send an OTP to prevent spam.
        </p>
        <div class="form-group">
          <label>Your Name</label>
          <input type="text" id="buyer-name" class="form-control" placeholder="e.g. Ramesh" />
        </div>
        <div class="form-group">
          <label>Mobile Number</label>
          <input type="tel" id="buyer-mobile" class="form-control" placeholder="10-digit mobile" maxlength="10" />
        </div>
        <button class="btn btn-primary btn-block" onclick="Buyer.requestOTP()">Send OTP</button>
        <button class="btn btn-outline btn-block" onclick="App.goHome()" style="margin-top:8px">Back</button>
      </div>
    `;
  },

  async requestOTP() {
    const name = document.getElementById('buyer-name').value.trim();
    const mobile = document.getElementById('buyer-mobile').value.trim();
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      App.toast('Enter a valid 10-digit Indian mobile number');
      return;
    }
    this.tempName = name;
    this.tempMobile = mobile;
    try {
      const res = await API.post('/auth/request-otp', { mobile });
      this.showOTPForm(res.demo_otp);
    } catch (e) {
      App.toast(e.message);
    }
  },

  showOTPForm(demoOtp) {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="card">
        <h2>Enter OTP</h2>
        <p style="color:var(--muted);font-size:0.9rem">
          OTP sent to <strong>+91 ${this.tempMobile}</strong>
        </p>
        ${demoOtp ? `<p style="background:#fff3cd;padding:8px;border-radius:8px;font-size:0.85rem;margin:12px 0">
          <strong>Demo mode:</strong> Use OTP <code>${demoOtp}</code>
        </p>` : ''}
        <div class="form-group">
          <label>6-digit OTP</label>
          <input type="text" id="buyer-otp" class="form-control" placeholder="123456" maxlength="6" style="text-align:center;font-size:1.3rem;letter-spacing:4px" />
        </div>
        <button class="btn btn-primary btn-block" onclick="Buyer.verifyOTP()">Verify & Continue</button>
        <button class="btn btn-outline btn-block" onclick="Buyer.showLogin()" style="margin-top:8px">Change Number</button>
      </div>
    `;
  },

  async verifyOTP() {
    const otp = document.getElementById('buyer-otp').value.trim();
    try {
      const res = await API.post('/auth/verify-otp', {
        mobile: this.tempMobile,
        otp,
        name: this.tempName
      });
      App.setUser({ ...res.user, name: this.tempName || res.user.name }, res.token);
      this.showStoreList();
    } catch (e) {
      App.toast(e.message || 'Invalid OTP');
    }
  },

  async showStoreList() {
    const app = document.getElementById('app');
    const nav = document.getElementById('bottom-nav');
    nav.classList.remove('hidden');
    this.renderNav(nav, 'stores');
    app.innerHTML = `<div class="card"><p>Loading stores…</p></div>`;
    try {
      const { stores } = await API.get('/stores');
      if (!stores || stores.length === 0) {
        app.innerHTML = `<div class="empty">No stores registered yet.<br>Ask Admin to add a store.</div>`;
        return;
      }
      app.innerHTML = `
        <h2 style="margin-bottom:12px">Choose a Store</h2>
        ${stores.map(s => `
          <div class="card" style="cursor:pointer" onclick="Buyer.selectStore(${s.id})">
            <h3>${s.name}</h3>
            <p style="font-size:0.85rem;color:var(--muted)">${s.address || ''}</p>
            <p style="font-size:0.85rem;color:var(--muted)">📞 ${s.phone || ''}</p>
          </div>
        `).join('')}
      `;
    } catch (e) {
      app.innerHTML = `<div class="empty">Could not load stores.</div>`;
    }
  },

  async selectStore(storeId) {
    const { store } = await API.get(`/stores/${storeId}`);
    App.state.selectedStore = store;
    this.showProducts();
  },

  async showProducts() {
    const app = document.getElementById('app');
    this.renderNav(document.getElementById('bottom-nav'), 'products');
    const store = App.state.selectedStore;
    app.innerHTML = `<div class="card"><p>Loading products…</p></div>`;
    try {
      let { products } = await API.get(`/products?store_id=${store.id}`);
      if (!products || products.length === 0) products = this._demoProducts(store.id);
      this.products = products;
      this._renderProductList(app, products);
    } catch (e) {
      this.products = this._demoProducts(store.id);
      this._renderProductList(app, this.products);
    }
  },

  _demoProducts(storeId) {
    return [
      { id: 1, store_id: storeId, category: 'Staples', name: 'Sona Masoori Rice', weight: '5 kg', volume: '', mrp: 320, selling_price: 299, stock: 50 },
      { id: 2, store_id: storeId, category: 'Staples', name: 'Atta (Aashirvaad)', weight: '5 kg', volume: '', mrp: 280, selling_price: 265, stock: 60 },
      { id: 3, store_id: storeId, category: 'Dairy', name: 'Milk (Amul Toned)', weight: '', volume: '500 ml', mrp: 30, selling_price: 28, stock: 100 },
      { id: 4, store_id: storeId, category: 'Household', name: 'Dishwashing Soap (Vim)', weight: '150 g', volume: '', mrp: 25, selling_price: 22, stock: 80 },
      { id: 5, store_id: storeId, category: 'Personal Care', name: 'Toilet Soap (Lux)', weight: '100 g', volume: '', mrp: 45, selling_price: 40, stock: 80 },
      { id: 6, store_id: storeId, category: 'Snacks', name: 'Parle-G Biscuits', weight: '800 g', volume: '', mrp: 70, selling_price: 65, stock: 80 },
    ];
  },

  _renderProductList(app, products) {
    const store = App.state.selectedStore;
    const categories = ['All', ...new Set(products.map(p => p.category).filter(Boolean))];
    const filtered = this.filterCategory === 'All' ? products : products.filter(p => p.category === this.filterCategory);
    app.innerHTML = `
      <div style="margin-bottom:8px">
        <strong>${store.name}</strong>
        <button class="btn btn-sm btn-outline" style="float:right" onclick="Buyer.showStoreList()">Change</button>
      </div>
      <div class="chips">
        ${categories.map(c => `<span class="chip ${c === this.filterCategory ? 'active' : ''}" onclick="Buyer.setCategory('${c}')">${c}</span>`).join('')}
      </div>
      <div class="card" style="padding:8px 16px">
        ${filtered.length === 0 ? '<div class="empty">No products in this category</div>' :
          filtered.map(p => `
            <div class="product-item">
              <div class="product-info">
                <h4>${p.name}</h4>
                <div class="meta">${[p.weight, p.volume].filter(Boolean).join(' · ')} ${p.category ? '· ' + p.category : ''}</div>
                <div><span class="price">₹${p.selling_price}</span>${p.mrp && p.mrp > p.selling_price ? `<span class="mrp">₹${p.mrp}</span>` : ''}</div>
              </div>
              <button class="btn btn-primary btn-sm" onclick='Buyer.addProduct(${JSON.stringify(p).replace(/'/g, "&#39;")})'>+ Add</button>
            </div>
          `).join('')}
      </div>
      ${App.cartCount() > 0 ? `<div class="cart-bar" onclick="Buyer.showCart()"><span>${App.cartCount()} items</span><span>₹${App.cartTotal().toFixed(0)} · View Cart →</span></div>` : ''}
    `;
  },

  setCategory(cat) { this.filterCategory = cat; this._renderProductList(document.getElementById('app'), this.products); },
  addProduct(p) { App.addToCart(p, 1); },

  showCart() {
    const app = document.getElementById('app');
    this.renderNav(document.getElementById('bottom-nav'), 'cart');
    if (App.state.cart.length === 0) {
      app.innerHTML = `<div class="empty">Your cart is empty.<br><button class="btn btn-primary" style="margin-top:12px" onclick="Buyer.showProducts()">Browse Products</button></div>`;
      return;
    }
    app.innerHTML = `
      <h2 style="margin-bottom:12px">Your Cart</h2>
      <div class="card">
        ${App.state.cart.map(c => `
          <div class="product-item">
            <div class="product-info"><h4>${c.product.name}</h4><div class="meta">₹${c.product.selling_price} × ${c.qty}</div></div>
            <div class="qty-control">
              <button onclick="App.updateQty(${c.product.id}, -1)">−</button>
              <span>${c.qty}</span>
              <button onclick="App.updateQty(${c.product.id}, 1)">+</button>
            </div>
          </div>
        `).join('')}
        <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border);display:flex;justify-content:space-between;font-weight:700">
          <span>Total</span><span>₹${App.cartTotal().toFixed(0)}</span>
        </div>
      </div>
      <button class="btn btn-success btn-block" onclick="Buyer.showCheckout()">Proceed to Checkout</button>
      <button class="btn btn-outline btn-block" onclick="Buyer.showProducts()">Continue Shopping</button>
    `;
  },

  showCheckout() {
    const store = App.state.selectedStore;
    const paymentOpts = (store.payment_options || []).filter(o => o.enabled);
    const app = document.getElementById('app');
    app.innerHTML = `
      <h2 style="margin-bottom:12px">Checkout</h2>
      <div class="card">
        <p><strong>Store:</strong> ${store.name}</p>
        <p style="font-size:0.85rem;color:var(--muted)">${store.address}</p>
        <p style="font-size:0.85rem;color:var(--muted)">📞 ${store.phone}</p>
      </div>
      <div class="card">
        <h3>Payment Method</h3>
        ${paymentOpts.length === 0 ? '<p class="empty">No payment options configured by store.</p>' :
          paymentOpts.map((o, i) => `
            <label style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
              <input type="radio" name="pay" value="${o.type}" ${i === 0 ? 'checked' : ''} />
              <div><strong>${o.label}</strong>${o.details ? `<div style="font-size:0.8rem;color:var(--muted)">${o.details}</div>` : ''}</div>
            </label>
          `).join('')}
      </div>
      <div class="card">
        <div style="display:flex;justify-content:space-between;font-weight:700;font-size:1.1rem">
          <span>Order Total</span><span>₹${App.cartTotal().toFixed(0)}</span>
        </div>
      </div>
      <button class="btn btn-success btn-block" onclick="Buyer.placeOrder()">Place Order</button>
      <button class="btn btn-outline btn-block" onclick="Buyer.showCart()">Back to Cart</button>
    `;
  },

  async placeOrder() {
    const payEl = document.querySelector('input[name="pay"]:checked');
    if (!payEl) { App.toast('Select a payment method'); return; }
    const payload = {
      store_id: App.state.selectedStore.id,
      buyer_mobile: App.state.user.mobile,
      buyer_name: App.state.user.name,
      payment_method: payEl.value,
      total_amount: App.cartTotal(),
      items: App.state.cart.map(c => ({
        product_id: c.product.id, product_name: c.product.name, qty: c.qty,
        unit_price: c.product.selling_price, line_total: c.product.selling_price * c.qty
      }))
    };
    try {
      const { order } = await API.post('/orders', payload);
      App.state.cart = []; App.saveCart();
      this.showOrderSuccess(order);
    } catch (e) { App.toast(e.message || 'Could not place order'); }
  },

  showOrderSuccess(order) {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="card" style="text-align:center;padding:28px 16px">
        <div style="font-size:3rem">✅</div>
        <h2 style="margin:12px 0">Order Placed!</h2>
        <p style="font-size:1.1rem">Order Reference</p>
        <p style="font-size:1.6rem;font-weight:700;letter-spacing:2px;margin:8px 0">${order.order_ref}</p>
        <p style="color:var(--muted);font-size:0.9rem">Save this reference. Show it at the store or use it to track your order.</p>
        <p style="margin-top:12px"><strong>Total: ₹${order.total_amount || App.cartTotal().toFixed(0)}</strong></p>
        <button class="btn btn-primary btn-block" style="margin-top:20px" onclick="Buyer.showStoreList()">Order from another store</button>
        <button class="btn btn-outline btn-block" onclick="Buyer.showOrderHistory()">View My Orders</button>
      </div>
    `;
  },

  async showOrderHistory() {
    const app = document.getElementById('app');
    this.renderNav(document.getElementById('bottom-nav'), 'orders');
    app.innerHTML = `<div class="card"><p>Loading your orders…</p></div>`;
    try {
      const { orders } = await API.get(`/orders?mobile=${App.state.user.mobile}`);
      const mine = (orders || []).filter(o => o.buyer_mobile === App.state.user.mobile);
      if (mine.length === 0) { app.innerHTML = `<div class="empty">No previous orders yet.</div>`; return; }
      app.innerHTML = `
        <h2 style="margin-bottom:12px">My Orders</h2>
        ${mine.map(o => `
          <div class="card">
            <div style="display:flex;justify-content:space-between"><strong>${o.order_ref}</strong><span class="badge badge-${o.status}">${o.status}</span></div>
            <p style="font-size:0.85rem;color:var(--muted)">${new Date(o.created_at).toLocaleString()}</p>
            <p>₹${o.total_amount} · ${o.payment_method}</p>
          </div>
        `).join('')}
      `;
    } catch (e) { app.innerHTML = `<div class="empty">Could not load orders.</div>`; }
  },

  renderNav(nav, active) {
    nav.innerHTML = `
      <a href="#" class="${active === 'stores' || active === 'products' ? 'active' : ''}" onclick="Buyer.showStoreList();return false"><span class="icon">🏪</span>Stores</a>
      <a href="#" class="${active === 'cart' ? 'active' : ''}" onclick="Buyer.showCart();return false"><span class="icon">🛒</span>Cart${App.cartCount() ? ` (${App.cartCount()})` : ''}</a>
      <a href="#" class="${active === 'orders' ? 'active' : ''}" onclick="Buyer.showOrderHistory();return false"><span class="icon">📋</span>Orders</a>
    `;
  },

  render(app, nav) {
    if (!App.state.selectedStore) this.showStoreList();
    else this.showProducts();
  }
};
