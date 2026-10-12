/**
 * Neighbourhood Store – Main App Router & State
 */
const App = {
  state: {
    user: null,
    cart: [],
    selectedStore: null,
    currentView: 'home'
  },

  init() {
    const raw = localStorage.getItem('ns_user');
    if (raw) {
      try {
        this.state.user = JSON.parse(raw);
        this.state.token = localStorage.getItem('ns_token');
      } catch (e) {}
    }
    const cart = localStorage.getItem('ns_cart');
    if (cart) this.state.cart = JSON.parse(cart);
    this.render();
  },

  setUser(user, token) {
    this.state.user = user;
    this.state.token = token;
    localStorage.setItem('ns_user', JSON.stringify(user));
    if (token) localStorage.setItem('ns_token', token);
    this.render();
  },

  logout() {
    this.state.user = null;
    this.state.token = null;
    this.state.cart = [];
    localStorage.removeItem('ns_user');
    localStorage.removeItem('ns_token');
    localStorage.removeItem('ns_cart');
    this.render();
  },

  saveCart() {
    localStorage.setItem('ns_cart', JSON.stringify(this.state.cart));
  },

  addToCart(product, qty = 1) {
    const existing = this.state.cart.find(c => c.product.id === product.id);
    if (existing) existing.qty += qty;
    else this.state.cart.push({ product, qty });
    this.saveCart();
    this.toast(`${product.name} added`);
    this.render();
  },

  updateQty(productId, delta) {
    const item = this.state.cart.find(c => c.product.id === productId);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) this.state.cart = this.state.cart.filter(c => c.product.id !== productId);
    this.saveCart();
    this.render();
  },

  cartTotal() {
    return this.state.cart.reduce((s, c) => s + c.product.selling_price * c.qty, 0);
  },

  cartCount() {
    return this.state.cart.reduce((s, c) => s + c.qty, 0);
  },

  toast(msg) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2200);
  },

  goHome() {
    this.state.currentView = 'home';
    this.render();
  },

  render() {
    const app = document.getElementById('app');
    const badge = document.getElementById('user-badge');
    const nav = document.getElementById('bottom-nav');

    if (this.state.user) {
      badge.classList.remove('hidden');
      badge.innerHTML = `${this.state.user.role.toUpperCase()} · ${this.state.user.name || this.state.user.mobile}
        <button class="btn btn-sm" style="margin-left:8px;background:rgba(255,255,255,.3)" onclick="App.logout()">Logout</button>`;
    } else {
      badge.classList.add('hidden');
    }

    if (!this.state.user) {
      nav.classList.add('hidden');
      this.renderHome(app);
      return;
    }

    switch (this.state.user.role) {
      case 'buyer':
        Buyer.render(app, nav);
        break;
      case 'shopkeeper':
        Shopkeeper.render(app, nav);
        break;
      case 'admin':
        Admin.render(app, nav);
        break;
      default:
        this.renderHome(app);
    }
  },

  renderHome(container) {
    container.innerHTML = `
      <div class="card" style="text-align:center;padding:28px 20px">
        <h1 style="font-size:1.5rem;margin-bottom:8px">Welcome 👋</h1>
        <p style="color:var(--muted);margin-bottom:20px">
          Order from your neighbourhood supermarket<br>or manage your store.
        </p>
      </div>

      <div class="role-grid">
        <div class="role-card" onclick="App.startBuyer()">
          <div class="emoji">🛍️</div>
          <h3>I want to Buy</h3>
          <p style="font-size:0.85rem;color:var(--muted)">Browse products & place orders</p>
        </div>
        <div class="role-card" onclick="App.startShopkeeper()">
          <div class="emoji">🏪</div>
          <h3>I am a Shopkeeper</h3>
          <p style="font-size:0.85rem;color:var(--muted)">Manage catalogue & orders</p>
        </div>
        <div class="role-card" onclick="App.startAdmin()">
          <div class="emoji">⚙️</div>
          <h3>Admin</h3>
          <p style="font-size:0.85rem;color:var(--muted)">Full system control</p>
        </div>
      </div>
    `;
  },

  startBuyer() {
    this.state.currentView = 'buyer-login';
    Buyer.showLogin();
  },
  startShopkeeper() {
    this.state.currentView = 'shopkeeper-login';
    Shopkeeper.showLogin();
  },
  startAdmin() {
    this.state.currentView = 'admin-login';
    Admin.showLogin();
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
