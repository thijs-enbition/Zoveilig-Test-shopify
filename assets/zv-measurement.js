/*
  zv-measurement.js — Zo Veilig shared measurement utilities.

  SCOPE (deliberately minimal for now):
    - Initialises window.dataLayer
    - Normalises an email address
    - Hashes a string with SHA-256 via the Web Crypto API

  NOT in scope yet, by design:
    - No form listeners are attached
    - No events are pushed to GA4, Google Ads or Meta
    - No raw email address is ever stored, logged or placed on the dataLayer

  Isolation: everything hangs off a single global namespace (window.ZVMeasurement) with no
  dependencies on Dawn, jQuery or any framework, so the same file can be reused verbatim by
  Replo landing pages as well as the Shopify theme.

  Privacy note: hashing is one way. Only the resulting hex digest may ever leave the browser.
  Callers must never place the plain email on the dataLayer or into a tag.
*/
(function (window) {
  'use strict';

  // 1. Ensure the dataLayer exists before GTM or any caller touches it.
  window.dataLayer = window.dataLayer || [];

  // Reuse the namespace if the script is somehow evaluated twice.
  var ZV = (window.ZVMeasurement = window.ZVMeasurement || {});
  if (ZV.__initialised) return;

  /**
   * Normalise an email address for hashing.
   * Trims surrounding whitespace and lowercases, which is what Google Enhanced
   * Conversions and Meta Advanced Matching expect before hashing.
   *
   * @param {string} email
   * @returns {string} normalised email, or '' when the input is unusable
   */
  function normaliseEmail(email) {
    if (typeof email !== 'string') return '';
    return email.trim().toLowerCase();
  }

  /**
   * SHA-256 hash a string and return it as lowercase hexadecimal.
   * Uses the Web Crypto API, which requires a secure context (https or localhost).
   *
   * @param {string} value
   * @returns {Promise<string|null>} hex digest, or null if hashing is unavailable or input is empty
   */
  function sha256Hex(value) {
    if (typeof value !== 'string' || value === '') {
      return Promise.resolve(null);
    }

    var subtle = window.crypto && window.crypto.subtle;
    if (!subtle || typeof TextEncoder === 'undefined') {
      // Non-secure context or unsupported browser. Fail closed and stay silent:
      // never fall back to sending anything unhashed.
      return Promise.resolve(null);
    }

    var bytes = new TextEncoder().encode(value);

    return subtle
      .digest('SHA-256', bytes)
      .then(function (buffer) {
        var out = '';
        var view = new Uint8Array(buffer);
        for (var i = 0; i < view.length; i++) {
          out += view[i].toString(16).padStart(2, '0');
        }
        return out;
      })
      .catch(function () {
        return null;
      });
  }

  /**
   * Convenience: normalise then hash an email in one call.
   * The plain and normalised values stay inside this function scope.
   *
   * @param {string} email
   * @returns {Promise<string|null>} SHA-256 hex digest of the normalised email
   */
  function hashEmail(email) {
    return sha256Hex(normaliseEmail(email));
  }

  ZV.normaliseEmail = normaliseEmail;
  ZV.sha256Hex = sha256Hex;
  ZV.hashEmail = hashEmail;

  // ========================================================================
  // Attribution capture (gclid / fbclid / utm_*)
  // Captured on entry and persisted so the value survives to the order (Moment A)
  // and can be uploaded weeks later as an offline conversion (Moment B), and so
  // callback leads carry the click id to the CRM. Source of truth is the browser.
  // ========================================================================
  var ATTR_KEY = 'zv_attribution';
  var ATTR_FIELDS = ['gclid', 'fbclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

  function readStore(key) {
    try { return JSON.parse(window.localStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }
  function writeStore(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode: ignore */ }
  }

  function captureAttribution() {
    var params;
    try { params = new URLSearchParams(window.location.search); } catch (e) { return; }
    var existing = readStore(ATTR_KEY) || {};
    var changed = false;
    for (var i = 0; i < ATTR_FIELDS.length; i++) {
      var f = ATTR_FIELDS[i];
      var v = params.get(f);
      // First-touch: only overwrite when a fresh value is present in the URL.
      if (v && v !== existing[f]) { existing[f] = v; changed = true; }
    }
    if (changed) {
      existing.captured_at = new Date().toISOString();
      writeStore(ATTR_KEY, existing);
    }
  }

  function getAttribution() {
    return readStore(ATTR_KEY) || {};
  }

  // ========================================================================
  // dataLayer helpers
  // ========================================================================

  function push(eventName, params) {
    var payload = { event: eventName };
    if (params) { for (var k in params) { if (params.hasOwnProperty(k)) payload[k] = params[k]; } }
    window.dataLayer.push(payload);
    return payload;
  }

  // GA4 requires clearing the ecommerce object between events so items from a
  // previous package are never carried into the next event.
  function clearEcommerce() {
    window.dataLayer.push({ ecommerce: null });
  }

  function toNumber(v) {
    if (v === null || v === undefined || v === '') return undefined;
    var n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? undefined : Math.round(n * 100) / 100;
  }

  // Build a GA4 ecommerce item from an element's data-* attributes. Price and SKU
  // are rendered server-side from the central pricing config, never hardcoded here.
  //   data-item-id (SKU) · data-item-name · data-item-brand · data-item-category
  //   data-item-category2 · data-price · data-quantity · data-item-options (JSON)
  function itemFromEl(el, overrides) {
    if (!el || !el.getAttribute) el = {};
    var g = function (name) { return el.getAttribute ? el.getAttribute(name) : undefined; };
    var item = {
      item_id: g('data-item-id') || undefined,
      item_name: g('data-item-name') || undefined,
      item_brand: g('data-item-brand') || 'Zo Veilig',
      item_category: g('data-item-category') || undefined,
      item_category2: g('data-item-category2') || undefined,
      price: toNumber(g('data-price')),
      quantity: parseInt(g('data-quantity'), 10) || 1
    };
    var opts = g('data-item-options');
    if (opts) { try { item.item_options = JSON.parse(opts); } catch (e) { item.item_options = opts; } }
    if (overrides) { for (var k in overrides) { if (overrides.hasOwnProperty(k)) item[k] = overrides[k]; } }
    // strip undefined keys
    for (var key in item) { if (item[key] === undefined) delete item[key]; }
    return item;
  }

  function ctaContext(el, extra) {
    var ctx = {};
    if (el && el.getAttribute) {
      ctx.cta_text = el.getAttribute('data-cta-text') || (el.textContent || '').trim().slice(0, 80) || undefined;
      ctx.cta_location = el.getAttribute('data-cta-location') || undefined;
    }
    if (extra) { for (var k in extra) { if (extra.hasOwnProperty(k)) ctx[k] = extra[k]; } }
    for (var key in ctx) { if (ctx[key] === undefined) delete ctx[key]; }
    return ctx;
  }

  // Ecommerce event with a fresh ecommerce object (cleared first).
  function pushEcommerce(eventName, ecommerce, topLevel) {
    clearEcommerce();
    var payload = { event: eventName, ecommerce: ecommerce };
    if (topLevel) { for (var k in topLevel) { if (topLevel.hasOwnProperty(k)) payload[k] = topLevel[k]; } }
    window.dataLayer.push(payload);
    return payload;
  }

  // ---- Named events (Oplossingen page) --------------------------------------
  // Behavioural / high-intent. NEVER treat these as a purchase.
  //   funnel: view_item_list -> package_view -> add_to_cart -> view_cart -> begin_checkout -> purchase

  function viewItemList(items, listInfo) {
    var ec = { currency: 'EUR', items: items || [] };
    if (listInfo && listInfo.item_list_id) ec.item_list_id = listInfo.item_list_id;
    if (listInfo && listInfo.item_list_name) ec.item_list_name = listInfo.item_list_name;
    return pushEcommerce('view_item_list', ec);
  }

  function packageView(el, extra) {
    return pushEcommerce('package_view', { currency: 'EUR', items: [itemFromEl(el)] }, ctaContext(el, extra));
  }

  // Call ONLY after Shopify confirms the line was added to the cart.
  function addToCart(item, extra) {
    var ec = { currency: 'EUR', items: [item] };
    if (item && item.price) ec.value = Math.round(item.price * (item.quantity || 1) * 100) / 100;
    return pushEcommerce('add_to_cart', ec, extra);
  }

  function viewCart(cart) {
    var ec = { currency: 'EUR', items: (cart && cart.items) || [] };
    if (cart && cart.value !== undefined) ec.value = cart.value;
    return pushEcommerce('view_cart', ec);
  }

  function beginCheckout(cart) {
    var ec = { currency: 'EUR', items: (cart && cart.items) || [] };
    if (cart && cart.value !== undefined) ec.value = cart.value;
    return pushEcommerce('begin_checkout', ec);
  }

  function solutionCategorySelect(category, el) { return push('solution_category_select', ctaContext(el, { solution_category: category })); }
  function productFinderStart(el) { return push('product_finder_start', ctaContext(el)); }
  function packageCompareClick(el) { return push('package_compare_click', ctaContext(el)); }
  function packageOptionView(el, extra) { return push('package_option_view', ctaContext(el, extra)); }
  function packageOptionSelect(el, option) { return push('package_option_select', ctaContext(el, option)); }
  function phoneClick(el) { return push('phone_click', ctaContext(el, { phone: el && el.getAttribute ? el.getAttribute('href') : undefined })); }

  // ---- Callback ("Bel mij terug") lead events -------------------------------
  function callbackCtaClick(el) { return push('callback_cta_click', ctaContext(el)); }
  function callbackFormStart(el) { return push('callback_form_start', ctaContext(el)); }
  function callbackFormSubmit(el) { return push('callback_form_submit', ctaContext(el)); }
  function callbackRequestSuccess(extra) { return push('callback_request_success', extra); }
  function callbackRequestError(extra) { return push('callback_request_error', extra); }

  // Assemble the CRM / Odoo lead payload. Attribution is merged from storage.
  // Raw email is included ONLY because a callback lead legitimately needs a contact
  // address for Operations; it is sent to the first-party CRM endpoint, never to an
  // ad platform. Ad-platform matching uses hashEmail() instead.
  function buildCallbackLead(context) {
    var attr = getAttribution();
    var lead = {
      lead_source: 'website',
      lead_type: 'callback_request',
      lead_temperature: 'hot',
      page_url: window.location.href,
      timestamp: new Date().toISOString()
    };
    for (var f = 0; f < ATTR_FIELDS.length; f++) { if (attr[ATTR_FIELDS[f]]) lead[ATTR_FIELDS[f]] = attr[ATTR_FIELDS[f]]; }
    if (context) { for (var k in context) { if (context.hasOwnProperty(k)) lead[k] = context[k]; } }
    return lead;
  }

  ZV.getAttribution = getAttribution;
  ZV.push = push;
  ZV.clearEcommerce = clearEcommerce;
  ZV.itemFromEl = itemFromEl;
  ZV.pushEcommerce = pushEcommerce;
  ZV.viewItemList = viewItemList;
  ZV.packageView = packageView;
  ZV.addToCart = addToCart;
  ZV.viewCart = viewCart;
  ZV.beginCheckout = beginCheckout;
  ZV.solutionCategorySelect = solutionCategorySelect;
  ZV.productFinderStart = productFinderStart;
  ZV.packageCompareClick = packageCompareClick;
  ZV.packageOptionView = packageOptionView;
  ZV.packageOptionSelect = packageOptionSelect;
  ZV.phoneClick = phoneClick;
  ZV.callbackCtaClick = callbackCtaClick;
  ZV.callbackFormStart = callbackFormStart;
  ZV.callbackFormSubmit = callbackFormSubmit;
  ZV.callbackRequestSuccess = callbackRequestSuccess;
  ZV.callbackRequestError = callbackRequestError;
  ZV.buildCallbackLead = buildCallbackLead;

  captureAttribution();
  ZV.__initialised = true;
})(window);
