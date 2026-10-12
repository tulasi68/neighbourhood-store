# Neighbourhood Store

Lightweight, mobile-first web application for neighbourhood supermarkets in India.

**Roles**
- **Buyer** – Select store → browse products → cart → place order (OTP-validated mobile login)
- **Shopkeeper** – Manage own store products, orders, payment options (GPay default, QR, link, cash)
- **Admin** – Full control over all stores, products, users and orders

## Features

- No app install required – works in any mobile browser
- OTP login for buyers (prevents spam)
- Per-store catalogue with categories
- Bulk seed data (CSV) of common Indian grocery items
- Shopkeeper can add / edit / delete products for their store only
- Admin has full write / modify / delete access everywhere
- Payment options are placeholders the shopkeeper fills (GPay / UPI, Cash, QR, Payment Link)
- Order reference + order history by mobile number
- Zero hosting cost target (Cloudflare Pages + D1 free tier)

## Tech Stack

| Layer     | Technology                      |
|-----------|---------------------------------|
| Frontend  | HTML, CSS, Vanilla JS (mobile-first) |
| Backend   | Cloudflare Pages Functions      |
| Database  | Cloudflare D1 (SQLite)          |
| Auth      | Mobile + OTP (buyer), Store Code + PIN (shopkeeper/admin) |

## Quick Start (Local Development)

1. **Install dependencies**
   ```bash
   npm install -g wrangler
   ```

2. **Create D1 database**
   ```bash
   wrangler d1 create neighbourhood-store-db
   ```
   Copy the `database_id` into `wrangler.toml`.

3. **Apply schema**
   ```bash
   wrangler d1 execute neighbourhood-store-db --file=./schema.sql
   ```

4. **Seed a demo store + products** (see `seed/` folder)
   Use the Admin panel after first login, or run SQL inserts.

5. **Run locally**
   ```bash
   wrangler pages dev public --d1=DB=neighbourhood-store-db
   ```

6. **Deploy**
   ```bash
   wrangler pages deploy public
   ```

## Default Demo Credentials (after seeding)

| Role        | How to login                          | Notes                          |
|-------------|---------------------------------------|--------------------------------|
| Admin       | Mobile `9999999999` + PIN `admin123`  | Full access                    |
| Shopkeeper  | Store Code + PIN (created by Admin)   | Own store only                 |
| Buyer       | Any mobile + OTP (demo OTP shown on screen for pilot) | OTP required to place order |

> **Production note**: Replace the demo OTP mechanism with a real SMS gateway (MSG91, Twilio, etc.).

## Seed Data

`seed/products_seed.csv` contains 90+ common Indian grocery items across categories:

- Staples (Rice, Atta, Dal, Oil, Sugar…)
- Dairy
- Personal Care
- Household
- Snacks & Biscuits
- Beverages
- Spices
- Instant Food
- Baby Care
- Others

Columns: `Category, Item Name, Weight, Volume, MRP, Selling Price, Stock`

Shopkeepers can import this CSV or add items one-by-one from their dashboard.

## Project Structure

```
├── public/                 # Static frontend
│   ├── index.html
│   ├── css/style.css
│   └── js/                 # Role-based modules
├── functions/api/          # Cloudflare Pages Functions
├── seed/products_seed.csv
├── schema.sql
└── wrangler.toml
```

## Payment Options

By default every store has:

1. **GPay / UPI** (enabled) – shopkeeper fills their UPI ID
2. **Cash on Delivery / Pickup** (enabled)
3. **Scan QR Code** (disabled until shopkeeper uploads/adds details)
4. **Payment Link** (disabled until shopkeeper adds a link)

No hard-coded UPI links are provided. The shopkeeper controls what appears at checkout.

## Security Notes (Pilot)

- Buyer OTP is currently demo-mode (shown in UI). Wire a real SMS provider before public launch.
- PINs are stored hashed.
- Shopkeeper data is strictly filtered by `store_id`.
- Admin has unrestricted access – protect the admin account carefully.

## License

MIT – free for neighbourhood use.
