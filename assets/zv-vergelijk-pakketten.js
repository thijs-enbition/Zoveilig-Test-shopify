/* Pakket-matcher scoring/highlight logic. Rendered by snippets/zv-pakket-matcher.liquid,
   used on both /pages/vergelijk-pakketten and the Langer Thuis panel of /pages/oplossingen.
   Static asset (not a section {% javascript %} block) so both pages load the exact same
   file — see snippets/zv-pakket-matcher.liquid for why. Auto-inits every [data-pm-root]
   found on the page, so it works whether there's one instance or several. */
(function () {
  var TIER = { inzicht: 1, zeker: 2, beschermd: 3 };
  var NAMES = { inzicht: 'Inzicht', zeker: 'Zeker', beschermd: 'Beschermd' };

  function init(root) {
    var cards = Array.prototype.slice.call(root.querySelectorAll('[data-pm-card]'));
    var table = root.parentNode.querySelector('[data-pm-table]');
    var advies = root.querySelector('[data-pm-advies]');
    var nameEl = root.querySelector('[data-pm-name]');
    var tagEl = root.querySelector('[data-pm-tagline]');
    var status = root.querySelector('[data-pm-status]');
    var addBtn = root.querySelector('[data-pm-add]');
    var addText = root.querySelector('[data-pm-add-text]');
    var viewCart = root.querySelector('[data-pm-viewcart]');
    var err = root.querySelector('[data-pm-err]');
    var products = {};
    try { products = JSON.parse((root.querySelector('[data-pm-products]') || {}).textContent || '{}'); } catch (e) { products = {}; }
    var current = null;
    var addedTimer = null;
    var activationVariantId = root.getAttribute('data-activation-variant-id') || null;

    /* Universal one-time "Activatie en installatie" variant (see pricing.config.json
       activation.productHandle/sku) — deduped against the live cart so it's only ever
       added once, same as the Oplossingen page. */
    function activationLineToAdd(cart) {
      if (!activationVariantId) return null;
      var already = (cart && cart.items || []).some(function (it) { return String(it.variant_id) === String(activationVariantId); });
      return already ? null : activationVariantId;
    }

    function taglineFor(pkg) {
      var td = table && table.querySelector('[data-pm-tagline-for="' + pkg + '"]');
      return td ? td.textContent.trim() : '';
    }

    function recommend() {
      var score = { inzicht: 0, zeker: 0, beschermd: 0 };
      var any = false;
      cards.forEach(function (c) {
        if (c.getAttribute('aria-pressed') === 'true') {
          var p = c.getAttribute('data-pm-pkg');
          if (score.hasOwnProperty(p)) { score[p] += 1; any = true; }
        }
      });
      if (!any) return null;
      var best = null;
      Object.keys(score).forEach(function (p) {
        if (best === null || score[p] > score[best] || (score[p] === score[best] && TIER[p] > TIER[best])) best = p;
      });
      return best;
    }

    function setBtnLabel(pkg) {
      if (!addBtn || !addText) return;
      addText.textContent = (addBtn.getAttribute('data-label') || '').replace('[pakket]', NAMES[pkg] || pkg);
    }

    function resetCta(pkg) {
      if (addedTimer) { clearTimeout(addedTimer); addedTimer = null; }
      if (err) { err.hidden = true; err.textContent = ''; }
      var prod = products[pkg];
      if (addBtn) {
        addBtn.hidden = !prod || !prod.available;
        addBtn.disabled = false; addBtn.removeAttribute('aria-busy'); addBtn.dataset.busy = '';
        setBtnLabel(pkg);
      }
      if (viewCart) viewCart.hidden = true;
    }

    function render() {
      var pkg = recommend();
      if (table) {
        table.querySelectorAll('[data-pm-pkg]').forEach(function (cell) {
          cell.classList.toggle('is-match', !!pkg && cell.getAttribute('data-pm-pkg') === pkg);
        });
      }
      if (pkg !== current) {
        current = pkg;
        if (pkg) {
          if (nameEl) nameEl.textContent = NAMES[pkg];
          if (tagEl) tagEl.textContent = taglineFor(pkg);
          resetCta(pkg);
          if (advies) advies.hidden = false;
          if (status) status.textContent = 'Ons advies: ' + NAMES[pkg] + '. ' + taglineFor(pkg);
        } else {
          if (advies) advies.hidden = true;
          if (status) status.textContent = '';
        }
      }
    }

    cards.forEach(function (c) {
      c.addEventListener('click', function () {
        var on = c.getAttribute('aria-pressed') === 'true';
        c.setAttribute('aria-pressed', on ? 'false' : 'true');
        c.classList.toggle('on', !on);
        render();
      });
    });

    function refreshCart() {
      return window.fetch('/cart.js', { headers: { 'Accept': 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (cart) {
          try { document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true, detail: { cart: cart } })); } catch (e) {}
          try { document.dispatchEvent(new CustomEvent('zv:cart:added')); } catch (e) {}
          return cart;
        });
    }

    function failed() {
      if (addBtn) { addBtn.disabled = false; addBtn.removeAttribute('aria-busy'); addBtn.dataset.busy = ''; }
      if (err) { err.textContent = 'Toevoegen mislukt. Probeer het opnieuw.'; err.hidden = false; }
    }

    if (addBtn) {
      addBtn.addEventListener('click', function () {
        var pkg = current;
        var prod = pkg && products[pkg];
        if (!prod || addBtn.dataset.busy === '1') return;
        addBtn.dataset.busy = '1'; addBtn.disabled = true; addBtn.setAttribute('aria-busy', 'true');
        if (err) err.hidden = true;
        var vid = String(prod.variantId);
        // Same variant already in the cart -> bump that line (matches Shopify's merge-on-repeat-add
        // behaviour on the Oplossingen page) instead of creating a second line with different properties.
        window.fetch('/cart.js', { headers: { 'Accept': 'application/json' } })
          .then(function (r) { return r.json(); })
          .then(function (cart) {
            var line = (cart && cart.items || []).filter(function (it) { return String(it.variant_id) === vid; })[0];
            var activationId = activationLineToAdd(cart);
            if (line) {
              var changePromise = window.fetch('/cart/change.js', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: line.key, quantity: line.quantity + 1 })
              });
              if (!activationId) return changePromise;
              // Package line already exists but the activation fee doesn't yet (e.g. it was
              // removed from the cart separately) — bump the package, then add the fee.
              return changePromise.then(function (r) { if (!r.ok) throw new Error(r.status); return r; }).then(function () {
                return window.fetch('/cart/add.js', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ items: [{ id: activationId, quantity: 1 }] })
                });
              });
            }
            var items = [{ id: prod.variantId, quantity: 1, properties: {
              'Pakket': prod.name || NAMES[pkg], 'SKU': prod.sku || '', 'Oplossing': prod.line || '', 'Bron': 'Vergelijk pakketten'
            } }];
            if (activationId) items.push({ id: activationId, quantity: 1 });
            return window.fetch('/cart/add.js', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ items: items })
            });
          })
          .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
          .then(function () {
            var ZV = window.ZVMeasurement;
            if (ZV && ZV.addToCart) { try { ZV.addToCart({ item_id: prod.sku, item_name: prod.name, item_brand: 'Zo Veilig', quantity: 1 }, { cta_location: 'vergelijk_pakketten' }); } catch (e) {} }
            addBtn.dataset.busy = ''; addBtn.removeAttribute('aria-busy');
            if (addText) addText.textContent = addBtn.getAttribute('data-added') || 'Toegevoegd';
            if (status) status.textContent = (addBtn.getAttribute('data-added') || 'Toegevoegd') + ' — ' + (prod.name || NAMES[pkg]);
            addedTimer = setTimeout(function () {
              addBtn.hidden = true; addBtn.disabled = false;
              if (viewCart) { viewCart.hidden = false; viewCart.focus(); }
            }, 1800);
            return refreshCart();
          })
          .catch(failed);
      });
    }

    render();
  }

  function ready() {
    document.querySelectorAll('[data-pm-root]').forEach(init);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})();
