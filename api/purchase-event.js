/**
 * Meta Conversions API endpoint
 * Receives Hotmart postback webhook and forwards Purchase event server-side to Meta.
 *
 * Hotmart webhook reference:
 *   https://developers.hotmart.com/docs/pt-BR/v2/webhook/about-webhook/
 *
 * Meta CAPI reference:
 *   https://developers.facebook.com/docs/marketing-api/conversions-api/
 *
 * Env:
 *   META_ACCESS_TOKEN - access token from Meta Business Manager (Event Manager > Settings)
 *   META_PIXEL_ID      - pixel ID (default matches browser pixel)
 *   HOTMART_WEBHOOK_TOKEN - optional, validates x-hotmart-hottok header
 */

import crypto from 'node:crypto';

const META_API_VERSION = 'v19.0';

function sha256(value) {
  if (!value) return undefined;
  return crypto.createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex');
}

function normalizePhone(phone) {
  if (!phone) return undefined;
  // Digits only, with country code. Hotmart envia ex: "+5511999999999" ou "11999999999".
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return undefined;
  // Se vier sem DDI, assume Brasil (55).
  if (digits.length <= 11) return sha256(`55${digits}`);
  return sha256(digits);
}

function parseFullName(name) {
  if (!name) return { fn: undefined, ln: undefined };
  const parts = String(name).trim().split(/\s+/);
  const fn = parts.shift();
  const ln = parts.length ? parts.join(' ') : undefined;
  return { fn: sha256(fn), ln: sha256(ln) };
}

function extractHotmartData(body) {
  // Suporta payload v1 e v2 do Hotmart
  const data = body?.data || body || {};
  const buyer = data.buyer || {};
  const purchase = data.purchase || {};
  const product = data.product || {};

  const status = (purchase.status || body?.status || '').toUpperCase();
  const transaction = purchase.transaction || data.transaction || body?.id;

  const price = purchase.price?.value ?? purchase.offer?.price?.value ?? body?.price ?? 97;
  const currency = purchase.price?.currency_value || purchase.offer?.code || 'BRL';

  return {
    status,
    transaction,
    email: buyer.email || body?.email,
    phone: buyer.checkout_phone || buyer.phone || body?.phone,
    name: buyer.name || body?.name,
    document: buyer.document || body?.document,
    ip: data.client_ip || body?.ip,
    userAgent: data.user_agent || body?.user_agent,
    productId: product.id || 'I105499750V',
    productName: product.name || 'Negocio no Azul',
    value: Number(price) || 97,
    currency,
  };
}

async function sendPurchaseToMeta({ pixelId, accessToken, event, testEventCode }) {
  const url = new URL(`https://graph.facebook.com/${META_API_VERSION}/${pixelId}/events`);
  url.searchParams.set('access_token', accessToken);

  const payload = { data: [event] };
  if (testEventCode) payload.test_event_code = testEventCode;

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Meta CAPI error: ${res.status}`);
    err.detail = json;
    throw err;
  }
  return json;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const accessToken = process.env.META_ACCESS_TOKEN;
  const pixelId = process.env.META_PIXEL_ID || '1183885533721874';
  const hotmartToken = process.env.HOTMART_WEBHOOK_TOKEN;

  if (!accessToken) {
    return res.status(500).json({ ok: false, error: 'missing_meta_access_token' });
  }

  // Valida origem via hottok (se configurado)
  if (hotmartToken) {
    const headerToken = req.headers['x-hotmart-hottok'] || req.headers['x-hotmart-webhook-token'];
    if (headerToken !== hotmartToken) {
      return res.status(401).json({ ok: false, error: 'invalid_hottok' });
    }
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ ok: false, error: 'invalid_json' });
    }
  }

  const data = extractHotmartData(body);

  // Somente eventos de venda aprovada/completa
  const approvedStatuses = ['APPROVED', 'COMPLETE', 'PURCHASE_APPROVED', 'PURCHASE_COMPLETE'];
  if (data.status && !approvedStatuses.includes(data.status)) {
    return res.status(200).json({
      ok: true,
      skipped: true,
      reason: `status_${data.status.toLowerCase()}_not_tracked`,
    });
  }

  // Dedup: usa o ID da transacao do Hotmart (compartilhado com pixel browser se enviar no front)
  const eventId = data.transaction || `hotmart_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const { fn, ln } = parseFullName(data.name);

  const userData = {
    em: data.email ? [sha256(data.email)] : undefined,
    ph: data.phone ? [normalizePhone(data.phone)] : undefined,
    fn: fn ? [fn] : undefined,
    ln: ln ? [ln] : undefined,
    external_id: data.document ? [sha256(data.document)] : undefined,
    client_ip_address: data.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim(),
    client_user_agent: data.userAgent || req.headers['user-agent'],
  };

  // Remove undefined
  Object.keys(userData).forEach((k) => userData[k] === undefined && delete userData[k]);

  const event = {
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: 'website',
    event_source_url: 'https://negocionoazul.com.br/',
    user_data: userData,
    custom_data: {
      currency: data.currency,
      value: data.value,
      content_name: data.productName,
      content_ids: [data.productId],
      content_type: 'product',
      num_items: 1,
    },
  };

  try {
    const result = await sendPurchaseToMeta({
      pixelId,
      accessToken,
      event,
      testEventCode: req.query?.test_event_code,
    });

    return res.status(200).json({
      ok: true,
      event_id: eventId,
      meta: result,
    });
  } catch (err) {
    console.error('[CAPI] send error:', err.detail || err.message);
    return res.status(502).json({
      ok: false,
      error: 'meta_send_failed',
      detail: err.detail || err.message,
    });
  }
}
