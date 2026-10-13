/**
 * LSP Adapter — unified interface for delivery providers.
 * Each provider exports: createDelivery(), getStatus(), cancel()
 * All providers receive (env, payload) and return a normalized object:
 *   { ok, lsp_ref, fee, tracking_url, rider_name, rider_phone, raw }
 */

export const LSPs = {
  self: {
    async createDelivery(env, payload) {
      // No external call — store handles it
      return {
        ok: true,
        lsp_ref: 'SELF-' + payload.order_ref,
        fee: payload.fee || 0,
        tracking_url: null,
        rider_name: null,
        rider_phone: null,
        raw: { mode: 'self' }
      };
    },
    async getStatus(env, lsp_ref) {
      return { ok: true, status: 'pending' };
    },
    async cancel(env, lsp_ref) {
      return { ok: true };
    }
  },

  uber_direct: {
    async createDelivery(env, payload) {
      if (!env.UBER_DIRECT_TOKEN) {
        return { ok: false, error: 'Uber Direct not configured (UBER_DIRECT_TOKEN missing)' };
      }
      // Uber Direct API — /v1/customers/{customer_id}/deliveries
      const res = await fetch('https://api.uber.com/v1/deliveries', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.UBER_DIRECT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pickup: {
            name: payload.store_name,
            address: payload.store_address,
            phone: payload.store_phone
          },
          dropoff: {
            name: payload.buyer_name,
            address: payload.buyer_address,
            phone: payload.buyer_mobile
          },
          manifest: {
            description: `Grocery order ${payload.order_ref}`,
            reference: payload.order_ref
          }
        })
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.message || 'Uber Direct error', raw: data };
      return {
        ok: true,
        lsp_ref: data.id,
        fee: data.fee || payload.fee || 0,
        tracking_url: data.tracking_url,
        rider_name: data.courier?.name,
        rider_phone: data.courier?.phone,
        raw: data
      };
    },
    async getStatus(env, lsp_ref) {
      const res = await fetch(`https://api.uber.com/v1/deliveries/${lsp_ref}`, {
        headers: { 'Authorization': `Bearer ${env.UBER_DIRECT_TOKEN}` }
      });
      const data = await res.json();
      return { ok: res.ok, status: mapUberStatus(data.status), raw: data };
    },
    async cancel(env, lsp_ref) {
      const res = await fetch(`https://api.uber.com/v1/deliveries/${lsp_ref}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.UBER_DIRECT_TOKEN}` }
      });
      return { ok: res.ok };
    }
  },

  borzo: {
    async createDelivery(env, payload) {
      if (!env.BORZO_API_KEY) {
        return { ok: false, error: 'Borzo not configured (BORZO_API_KEY missing)' };
      }
      const res = await fetch('https://api.borzo.com/v1/order', {
        method: 'POST',
        headers: {
          'X-DV-Auth-Token': env.BORZO_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'standard',
          matter: `Grocery order ${payload.order_ref}`,
          vehicle_type_id: 8, // bike
          points: [
            { address: payload.store_address, contact_person: { name: payload.store_name, phone: payload.store_phone } },
            { address: payload.buyer_address, contact_person: { name: payload.buyer_name, phone: payload.buyer_mobile } }
          ]
        })
      });
      const data = await res.json();
      if (!data.is_successful) return { ok: false, error: data.errors?.[0]?.message || 'Borzo error', raw: data };
      const o = data.order;
      return {
        ok: true,
        lsp_ref: String(o.order_id),
        fee: o.payment_amount || payload.fee || 0,
        tracking_url: o.tracking_url,
        rider_name: o.courier?.name,
        rider_phone: o.courier?.phone,
        raw: data
      };
    },
    async getStatus(env, lsp_ref) {
      const res = await fetch(`https://api.borzo.com/v1/order?order_id=${lsp_ref}`, {
        headers: { 'X-DV-Auth-Token': env.BORZO_API_KEY }
      });
      const data = await res.json();
      const s = data.order?.status;
      return { ok: res.ok, status: mapBorzoStatus(s), raw: data };
    },
    async cancel(env, lsp_ref) {
      const res = await fetch('https://api.borzo.com/v1/order/cancel', {
        method: 'POST',
        headers: { 'X-DV-Auth-Token': env.BORZO_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: lsp_ref })
      });
      return { ok: res.ok };
    }
  }
};

function mapUberStatus(s) {
  if (!s) return 'pending';
  if (['pending', 'processing'].includes(s)) return 'pending';
  if (['courier_assigned', 'pickup'].includes(s)) return 'assigned';
  if (['pickup_complete', 'dropoff'].includes(s)) return 'picked';
  if (s === 'delivered') return 'delivered';
  if (['canceled', 'failed'].includes(s)) return 'failed';
  return 'pending';
}

function mapBorzoStatus(s) {
  if (!s) return 'pending';
  if (['new', 'pending'].includes(s)) return 'pending';
  if (['assigned', 'active'].includes(s)) return 'assigned';
  if (s === 'picked_up') return 'picked';
  if (s === 'completed') return 'delivered';
  if (['canceled', 'failed'].includes(s)) return 'failed';
  return 'pending';
}