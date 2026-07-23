/*
  oplossingen.js — Oplossingen page controller.
  Tab switching + the measurement events. Depends on zv-measurement.js.

  add_to_cart fires ONLY after Shopify's Cart AJAX API confirms the line was added.
*/
(function (window, document) {
  'use strict';
  var ZV = window.ZVMeasurement || {};

  function itemsIn(panel) {
    var cards = panel ? panel.querySelectorAll('.pcard') : [];
    var items = [];
    for (var i = 0; i < cards.length; i++) items.push(ZV.itemFromEl ? ZV.itemFromEl(cards[i]) : {});
    return items;
  }

  function activePanel(root) {
    return root.querySelector('.pak__panel:not([hidden])');
  }

  function init(root) {
    if (root.__zvBound) return;
    root.__zvBound = true;

    // view_item_list for the initially visible category.
    var first = activePanel(root);
    if (first && ZV.viewItemList) {
      var tab = root.querySelector('.catnav__t.on');
      ZV.viewItemList(itemsIn(first), {
        item_list_id: first.getAttribute('data-cat-panel'),
        item_list_name: tab ? tab.getAttribute('data-cat-name') : undefined
      });
    }

    // Tab switching + solution_category_select + view_item_list for the new tab.
    var tabs = root.querySelectorAll('.catnav__t');
    for (var t = 0; t < tabs.length; t++) {
      tabs[t].addEventListener('click', function () {
        var cat = this.getAttribute('data-cat');
        var tabsAll = root.querySelectorAll('.catnav__t');
        for (var j = 0; j < tabsAll.length; j++) {
          var on = tabsAll[j] === this;
          tabsAll[j].classList.toggle('on', on);
          tabsAll[j].setAttribute('aria-selected', on ? 'true' : 'false');
        }
        var panels = root.querySelectorAll('.pak__panel');
        var shown = null;
        for (var k = 0; k < panels.length; k++) {
          var match = panels[k].getAttribute('data-cat-panel') === cat;
          panels[k].hidden = !match;
          if (match) shown = panels[k];
        }
        if (ZV.solutionCategorySelect) ZV.solutionCategorySelect(cat, this);
        if (shown && ZV.viewItemList) {
          ZV.viewItemList(itemsIn(shown), { item_list_id: cat, item_list_name: this.getAttribute('data-cat-name') });
        }
      });
    }

    // package_view on "Meer informatie".
    root.addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('[data-zv-package-view]') : null;
      if (el && ZV.packageView) {
        var card = el.closest('.pcard');
        ZV.packageView(card || el, { cta_text: 'Meer informatie', cta_location: el.getAttribute('data-cta-location') });
      }
      var cmp = e.target.closest ? e.target.closest('[data-zv-compare]') : null;
      if (cmp && ZV.packageCompareClick) ZV.packageCompareClick(cmp);
      var fnd = e.target.closest ? e.target.closest('[data-zv-finder]') : null;
      if (fnd && ZV.productFinderStart) ZV.productFinderStart(fnd);
    });

    // In winkelwagen: add to the Shopify cart, fire add_to_cart only on confirm.
    root.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-zv-add-to-cart]') : null;
      if (!btn) return;
      var card = btn.closest('.pcard');
      var variantId = card && card.getAttribute('data-variant-id');
      if (!variantId) return;
      btn.disabled = true;
      window.fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ id: variantId, quantity: 1 }] })
      })
        .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
        .then(function () {
          if (ZV.addToCart && ZV.itemFromEl) {
            var item = ZV.itemFromEl(card, { cta_text: 'In winkelwagen', cta_location: btn.getAttribute('data-cta-location') });
            ZV.addToCart(item, { cta_location: btn.getAttribute('data-cta-location') });
          }
          document.dispatchEvent(new CustomEvent('zv:cart:added'));
        })
        .catch(function () { /* leave the button re-enabled for retry */ })
        .then(function () { btn.disabled = false; });
    });

    // phone_click anywhere on the page.
    document.addEventListener('click', function (e) {
      var tel = e.target.closest ? e.target.closest('a[href^="tel:"]') : null;
      if (tel && ZV.phoneClick) ZV.phoneClick(tel);
    });
  }

  function ready() {
    var roots = document.querySelectorAll('[data-zv-oplossingen]');
    for (var i = 0; i < roots.length; i++) init(roots[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})(window, document);
