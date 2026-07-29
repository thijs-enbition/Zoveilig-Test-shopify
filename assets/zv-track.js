/*
  zv-track.js — central client-side tracking wiring for Zo Veilig.

  Responsibilities (all client-side; GTM remains the only tag-delivery layer):
    1. Consent bridge: read Shopify's Customer Privacy API and translate it into
       Google Consent Mode v2 `consent update`, and gate first-party attribution
       capture on marketing consent (defaults stay 'denied' — see theme.liquid head).
    2. Global, DELEGATED event wiring (one document-level listener each, so Shopify
       theme-editor section reloads and cart re-renders never create duplicate binds):
       page_view, phone_click, email_click, brochure_download, view_cart,
       begin_checkout, remove_from_cart.

  It pushes NO analytics itself beyond dataLayer events via window.ZVMeasurement.
  No GA4/Ads/Meta script is loaded here. No PII is placed on the dataLayer.
  Purchase is intentionally NOT handled here (Shopify pixel + server-side own it).
*/
(function (window, document) {
  'use strict';
  if (window.__zvTrackInit) return;
  window.__zvTrackInit = true;

  var ZV = window.ZVMeasurement || {};

  // Consent command that reaches GTM via the dataLayer (same queue as the head default).
  function gtagCmd() { (window.dataLayer = window.dataLayer || []).push(arguments); }

  // ---------------------------------------------------------------- consent bridge
  function applyConsent(c) {
    if (!c) return;
    var yes = function (v) { return v === true || v === 'yes' || v === 'granted'; };
    var marketing = yes(c.marketing);
    var analytics = yes(c.analytics);
    gtagCmd('consent', 'update', {
      ad_storage: marketing ? 'granted' : 'denied',
      ad_user_data: marketing ? 'granted' : 'denied',
      ad_personalization: marketing ? 'granted' : 'denied',
      analytics_storage: analytics ? 'granted' : 'denied'
    });
    // Attribution (gclid/fbclid/utm_*) is captured only once marketing consent is granted.
    if (marketing && ZV.captureAttribution) ZV.captureAttribution();
  }

  function initConsent() {
    var cp = window.Shopify && window.Shopify.customerPrivacy;
    if (cp && typeof cp.currentVisitorConsent === 'function') {
      try { applyConsent(cp.currentVisitorConsent()); } catch (e) { /* leave defaults denied */ }
    }
    // Fires when the visitor makes/updates a choice in Shopify's consent banner.
    document.addEventListener('visitorConsentCollected', function (e) {
      if (e && e.detail) applyConsent(e.detail);
    });
  }

  if (window.Shopify && typeof window.Shopify.loadFeatures === 'function') {
    window.Shopify.loadFeatures([{ name: 'consent-tracking-api', version: '0.1' }], function (err) {
      if (!err) initConsent();
      // If the API is unavailable, defaults remain 'denied' (safe) until a banner updates.
    });
  } else {
    initConsent();
  }

  // ---------------------------------------------------------------- helpers
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  function pageType() {
    var p = window.location.pathname || '';
    if (p === '/' || p === '') return 'home';
    if (p.indexOf('/products/') === 0) return 'product';
    if (p.indexOf('/collections/') === 0) return 'collection';
    if (p === '/cart') return 'cart';
    if (p.indexOf('/pages/') === 0) return 'page';
    if (p.indexOf('/blogs/') === 0) return 'article';
    if (p.indexOf('/search') === 0) return 'search';
    return 'other';
  }
  function getCart() {
    return window.fetch('/cart.js', { headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function mapCartItems(cart) {
    return ((cart && cart.items) || []).map(function (it) {
      return {
        item_id: it.sku || String(it.product_id),
        item_name: it.product_title,
        item_variant: it.variant_title || undefined,
        item_brand: it.vendor || 'Zo Veilig',
        item_category: it.product_type || undefined,
        price: (it.price || 0) / 100,
        quantity: it.quantity
      };
    });
  }

  // ---------------------------------------------------------------- page_view
  ready(function () {
    if (ZV.pageView) ZV.pageView({ page_type: pageType(), page_location: window.location.href, page_title: document.title });
    if (pageType() === 'cart' && ZV.viewCart) {
      getCart().then(function (c) { ZV.viewCart({ items: mapCartItems(c), value: (c.total_price || 0) / 100 }); }).catch(function () {});
    }
    // Shopify redirects a successful contact form with ?contact_posted=true — reliable, refresh-safe.
    if (/[?&]contact_posted=true/.test(window.location.search) && ZV.contactSubmit) {
      ZV.contactSubmit({ cta_location: 'contact_page' });
    }
  });

  // lead_form_start on first interaction with a contact/lead form (once per form).
  document.addEventListener('focusin', function (e) {
    var form = e.target.closest && e.target.closest('form[action^="/contact"], [data-zv-lead-form]');
    if (form && !form.__zvStart) {
      form.__zvStart = true;
      if (ZV.push) ZV.push('lead_form_start', { lead_type: form.getAttribute('data-lead-type') || 'contact' });
    }
  }, true);

  // ---------------------------------------------------------------- delegated clicks (single listener)
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

    // tel: / mailto: / brochure downloads
    var a = t.closest('a[href]');
    if (a) {
      var href = a.getAttribute('href') || '';
      if (href.indexOf('tel:') === 0) { if (ZV.phoneClick) ZV.phoneClick(a); }
      else if (href.indexOf('mailto:') === 0) { if (ZV.emailClick) ZV.emailClick(a); }
      else if (a.hasAttribute('data-zv-download') || /\.(pdf|docx?|xlsx?)(\?|$)/i.test(href)) {
        if (ZV.push) ZV.push('brochure_download', { file_url: href, cta_location: a.getAttribute('data-cta-location') || undefined });
      }
    }

    // begin_checkout (best-effort; the Shopify pixel is the authoritative source)
    var checkout = t.closest('button[name="checkout"], a[href="/checkout"], a[href*="/checkout"], [data-zv-begin-checkout]');
    if (checkout && !checkout.__zvChk) {
      checkout.__zvChk = true;
      setTimeout(function () { checkout.__zvChk = false; }, 1500); // guard rapid double-clicks
      getCart().then(function (c) { if (ZV.beginCheckout) ZV.beginCheckout({ items: mapCartItems(c), value: (c.total_price || 0) / 100 }); }).catch(function () {});
    }

    // view_cart when the cart drawer / cart link is opened
    var cartOpen = t.closest('#cart-icon-bubble, a[href="/cart"], [data-zv-view-cart]');
    if (cartOpen && !checkout && !window.__zvCartSeen) {
      window.__zvCartSeen = true;
      setTimeout(function () { window.__zvCartSeen = false; }, 1500);
      getCart().then(function (c) { if (ZV.viewCart) ZV.viewCart({ items: mapCartItems(c), value: (c.total_price || 0) / 100 }); }).catch(function () {});
    }

    // remove_from_cart — read the line being removed from the DOM (best-effort; no PII)
    var rm = t.closest('cart-remove-button, [data-zv-remove]');
    if (rm) {
      try {
        var row = rm.closest('.cart-item, [data-zv-cart-item], tr');
        var name = row && (row.querySelector('.cart-item__name, [data-zv-item-name]') || {}).textContent;
        var qtyEl = row && row.querySelector('.quantity__input, [name^="updates"]');
        var item = { item_name: (name || '').trim() || undefined, quantity: qtyEl ? (parseInt(qtyEl.value, 10) || 1) : 1 };
        if (ZV.removeFromCart) ZV.removeFromCart(item, { cta_location: 'cart' });
      } catch (err) { if (ZV.trackError) ZV.trackError('remove_from_cart_read'); }
    }
  }, true);
})(window, document);
