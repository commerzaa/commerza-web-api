'use strict';
const express = require('express');
const db = require('../db');
const asyncHandler = require('../middleware/asyncHandler');
const { ensureCommerzaSchema } = require('../lib/commerzaSchema');

const router = express.Router();

/**
 * Shiprocket webhook receiver: updates shipment & order fulfillment status.
 * Configure this URL in Shiprocket Dashboard -> Settings -> Webhooks.
 */
router.post('/api/shiprocket/webhook', asyncHandler(async (req, res) => {
  await ensureCommerzaSchema();
  const payload = req.body || {};
  const awb = payload.awb || payload.awb_code || null;
  const srOrderId = payload.order_id ? String(payload.order_id) : null;
  const srShipmentId = payload.shipment_id ? String(payload.shipment_id) : null;
  const currentStatus = String(payload.current_status || payload.shipment_status || '').trim();

  if (!awb && !srOrderId && !srShipmentId) {
    return res.status(400).json({ status: 'false', message: 'Missing awb, order_id, or shipment_id' });
  }

  const shipment = await db.queryOne(
    'shopping',
    `SELECT * FROM commerza_shipments
     WHERE (@awb::text IS NOT NULL AND awb_code = @awb)
        OR (@srOrderId::text IS NOT NULL AND shiprocket_order_id = @srOrderId)
        OR (@srShipmentId::text IS NOT NULL AND shiprocket_shipment_id = @srShipmentId)
     ORDER BY id DESC LIMIT 1`,
    { awb, srOrderId, srShipmentId }
  );

  if (!shipment) {
    return res.status(404).json({ status: 'false', message: 'Shipment not found' });
  }

  const nextStatus = currentStatus || shipment.status;
  await db.query(
    'shopping',
    `UPDATE commerza_shipments
     SET status = @status,
         awb_code = COALESCE(@awb, awb_code),
         courier_name = COALESCE(@courier, courier_name),
         raw_payload = @raw::jsonb,
         updated_at = NOW()
     WHERE id = @id`,
    {
      id: shipment.id,
      status: nextStatus,
      awb,
      courier: payload.courier_name || null,
      raw: JSON.stringify(payload),
    }
  );

  // Sync simplified fulfillment status onto commerza_orders
  const lower = nextStatus.toLowerCase();
  let orderStatus = null;
  if (lower.includes('deliver')) orderStatus = 'delivered';
  else if (lower.includes('out for delivery')) orderStatus = 'out_for_delivery';
  else if (lower.includes('transit') || lower.includes('shipped') || lower.includes('picked')) orderStatus = 'shipped';
  else if (lower.includes('cancel')) orderStatus = 'cancelled';

  if (orderStatus && shipment.order_id) {
    await db.query(
      'shopping',
      'UPDATE commerza_orders SET fulfillment_status = @st, updated_at = NOW() WHERE id = @oid',
      { st: orderStatus, oid: shipment.order_id }
    );
  }

  res.json({ status: 'true', message: 'Webhook processed', shipmentId: shipment.id, currentStatus: nextStatus });
}));

module.exports = router;
