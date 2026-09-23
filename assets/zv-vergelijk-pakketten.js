/* Pakket-matcher scoring/highlight logic. Rendered by snippets/zv-pakket-matcher.liquid,
   used on /pages/vergelijk-pakketten (Langer Thuis) and the Langer Thuis + Mijn Thuis panels
   of /pages/oplossingen. Static asset (not a section {% javascript %} block) so every caller
   loads the exact same file — see snippets/zv-pakket-matcher.liquid for why. Auto-inits every
   [data-pm-root] found on the page, so it works whether there's one instance or several —
   Oplossingen has two simultaneously (Langer Thuis + Mijn Thuis), each with its own package
   vocabulary, which is why TIER/NAMES are read per-instance below instead of being one
   shared module-level object like before this file was generalized (2026-09-15).

   Generalization added two per-instance concepts, both read from [data-pm-root] attributes
   the Liquid snippet emits (defaults reproduce the original Langer Thuis-only behavior when
   a caller doesn't emit them, so nothing here changed for that call site):
     data-pm-tier / data-pm-names  "id:value,id:value,…" — tie-break precedence (higher wins
                                    a tie) and display-name maps, in place of the old hardcoded
                                    { inzicht: 1, zeker: 2, beschermd: 3 } / … NAMES object.
     data-pm-lead-pkgs / -lead-url a comma list of package ids that have no cart action (e.g.
                                    Mijn Thuis's Vista — no fixed price, no purchasable variant
                                    in this matcher's sense) plus the href their "Kies X" (and,
                                    if they win the recommendation, the advice bar's own CTA)
                                    should link to instead. See recommend() and resetCta(). */
(function () {
  var DEFAULT_TIER = { inzicht: 1, zeker: 2, beschermd: 3 };
  var DEFAULT_NAMES = { inzicht: 'Inzicht', zeker: 'Zeker', beschermd: 'Beschermd' };

  /* Parses the "id:value,id:value" attribute format shared by data-pm-tier/data-pm-names —
     numeric-looking values become numbers (for TIER), everything else stays a string (for
     NAMES). Returns `fallback` unchanged if the attribute is missing/empty. */
  function parsePairs(str, fallback) {
    if (!str) return fallback;
    var out = {};
    str.split(',').forEach(function (pair) {
      var i = pair.indexOf(':');
      if (i < 0) return;
      var k = pair.slice(0, i).trim(), v = pair.slice(i + 1).trim();
      out[k] = (v !== '' && !isNaN(v)) ? Number(v) : v;
    });
    return out;
  }

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
    var leadCta = root.querySelector('[data-pm-lead-cta]');
    var leadText = root.querySelector('[data-pm-lead-text]');
    var err = root.querySelector('[data-pm-err]');
    var products = {};
    try { products = JSON.parse((root.querySelector('[data-pm-products]') || {}).textContent || '{}'); } catch (e) { products = {}; }
    var current = null;
    var addedTimer = null;
    var activationVariantId = root.getAttribute('data-activation-variant-id') || null;
    var TIER = parsePairs(root.getAttribute('data-pm-tier'), DEFAULT_TIER);
    var NAMES = parsePairs(root.getAttribute('data-pm-names'), DEFAULT_NAMES);
    var leadPkgs = (root.getAttribute('data-pm-lead-pkgs') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var leadUrl = root.getAttribute('data-pm-lead-url') || '';

    /* package product handle -> installGroup ('nami' | 'climax'), from the pricing config
       JSON island the zv-pricing include renders on every page that uses this matcher. */
    var installGroupByHandle = {};
    /* The package line's cart quantity: promo.packageCartQuantity (the 3 prepaid months). */
    var pkgQty = 0;
    try {
      var pricingEl = document.getElementById('zv-pricing-config');
      var pricingCfg = pricingEl && JSON.parse(pricingEl.textContent || '{}');
      pkgQty = (pricingCfg && pricingCfg.promo && pricingCfg.promo.packageCartQuantity) || 0;
      (pricingCfg && pricingCfg.packages || []).forEach(function (p) {
        if (p && p.productHandle) installGroupByHandle[p.productHandle] = p.installGroup;
      });
    } catch (e) { installGroupByHandle = {}; }

    /* One-time Climax installation variant (see pricing.config.json
       activation.productHandle/sku) — added for a CLIMAX package only, never a NAMI one
       (NAMI installation is the customer's choice on Overzicht), and deduped against the
       live cart so it's only ever added once, same as the Oplossingen page. */
    function activationLineToAdd(cart, prod) {
      if (!activationVariantId || !prod || installGroupByHandle[prod.handle] !== 'climax') return null;
      var already = (cart && cart.items || []).some(function (it) { return String(it.variant_id) === String(activationVariantId); });
      return already ? null : activationVariantId;
    }

    function taglineFor(pkg) {
      var td = table && table.querySelector('[data-pm-tagline-for="' + pkg + '"]');
      return td ? td.textContent.trim() : '';
    }

    function recommend() {
      var score = {};
      cards.forEach(function (c) { score[c.getAttribute('data-pm-pkg')] = 0; });
      var any = false;
      cards.forEach(function (c) {
        if (c.getAttribute('aria-pressed') === 'true') {
          score[c.getAttribute('data-pm-pkg')] += 1;
          any = true;
        }
      });
      if (!any) return null;

      /* A leadPkgs package (no cart action — see the file header) may only win by an
         outright majority: strictly higher than every other scored package. If it doesn't
         clear that bar it's removed from consideration entirely for this call — a tie
         involving it never lets it win — and the remaining packages fall back to the
         ordinary highest-score/higher-tier-wins-a-tie rule below. leadPkgs is empty for
         Langer Thuis, so this is a no-op there: `outright` stays null and `eligible`
         is every scored package, same as before generalization. */
      var ids = Object.keys(score);
      var outright = null;
      leadPkgs.forEach(function (lp) {
        if (outright !== null || !score.hasOwnProperty(lp) || score[lp] === 0) return;
        var beatsAll = ids.every(function (other) { return other === lp || score[lp] > score[other]; });
        if (beatsAll) outright = lp;
      });
      if (outright !== null) return outright;

      var eligible = ids.filter(function (p) { return leadPkgs.indexOf(p) === -1; });
      var best = null;
      eligible.forEach(function (p) {
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
      var isLead = leadPkgs.indexOf(pkg) !== -1;
      if (leadCta) {
        leadCta.hidden = !isLead;
        if (isLead) {
          leadCta.setAttribute('href', leadUrl);
          if (leadText) leadText.textContent = 'Kies ' + (NAMES[pkg] || pkg);
        }
      }
      if (isLead) {
        if (addBtn) addBtn.hidden = true;
        if (viewCart) viewCart.hidden = true;
        return;
      }
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

    /* Shared add-to-cart: resolves the real product for `pkg` via the finder_key mapping
       (data-pm-products) and adds it at quantity pkgQty — the 3 prepaid months, which
       Shopify's automatic "Eerste 3 maanden" discount takes 50% off by itself. A package
       already in the cart is never bumped (that would add months, and the cart guard
       resets any package line to pkgQty anyway); only a missing Climax installation line
       is added then. The Climax installation line is added for a CLIMAX package only,
       deduped the same way as sections/oplossingen.liquid's addToCart(). No pkgQty
       (pricing config missing) fails closed. Used by both the advies-bar's own add button
       and, when embedded on Oplossingen, the comparison table's "Kies …" buttons. */
    function addPackageToCart(pkg, btn, opts) {
      var prod = pkg && products[pkg];
      if (!prod || !btn || btn.dataset.busy === '1' || !pkgQty) return;
      var cfg = opts || {};
      var ctaLocation = cfg.ctaLocation || 'vergelijk_pakketten', bron = cfg.bron || 'Vergelijk pakketten';
      btn.dataset.busy = '1'; btn.disabled = true; btn.setAttribute('aria-busy', 'true');
      var vid = String(prod.variantId);
      window.fetch('/cart.js', { headers: { 'Accept': 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (cart) {
          var line = (cart && cart.items || []).filter(function (it) { return String(it.variant_id) === vid; })[0];
          var activationId = activationLineToAdd(cart, prod);
          var items = [];
          if (!line) {
            items.push({ id: prod.variantId, quantity: pkgQty, properties: {
              'Pakket': prod.name || NAMES[pkg], 'SKU': prod.sku || '', 'Oplossing': prod.line || '', 'Bron': bron
            } });
          }
          if (activationId) items.push({ id: activationId, quantity: 1 });
          if (!items.length) return { ok: true, json: function () { return {}; } };
          return window.fetch('/cart/add.js', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: items })
          });
        })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function () {
          var ZV = window.ZVMeasurement;
          if (ZV && ZV.addToCart) { try { ZV.addToCart({ item_id: prod.sku, item_name: prod.name, item_brand: 'Zo Veilig', quantity: 1 }, { cta_location: ctaLocation }); } catch (e) {} }
          btn.dataset.busy = ''; btn.removeAttribute('aria-busy');
          refreshCart();
          if (cfg.onDone) cfg.onDone(prod);
        })
        .catch(function () {
          btn.dataset.busy = ''; btn.disabled = false; btn.removeAttribute('aria-busy');
          if (cfg.onError) cfg.onError();
        });
    }

    if (addBtn) {
      addBtn.addEventListener('click', function () {
        var pkg = current;
        if (err) err.hidden = true;
        addPackageToCart(pkg, addBtn, {
          ctaLocation: 'vergelijk_pakketten',
          bron: 'Vergelijk pakketten',
          onDone: function (prod) {
            if (addText) addText.textContent = addBtn.getAttribute('data-added') || 'Toegevoegd';
            if (status) status.textContent = (addBtn.getAttribute('data-added') || 'Toegevoegd') + ' — ' + (prod.name || NAMES[pkg]);
            addedTimer = setTimeout(function () {
              addBtn.hidden = true; addBtn.disabled = false;
              if (viewCart) { viewCart.hidden = false; viewCart.focus(); }
            }, 1800);
          },
          onError: failed
        });
      });
    }

    /* Comparison table "Kies Inzicht/Zeker/Beschermd" — only rendered as buttons (instead
       of links to opl_url) when this snippet is embedded on Oplossingen itself (see
       snippets/zv-pakket-matcher.liquid's `embedded` param and the 2026-09-11 audit item e:
       on that page the links just reloaded the current page). Adds the same package the
       matching pricing card above would, via the same finder_key-resolved variant. */
    var chooseBtns = table ? Array.prototype.slice.call(table.querySelectorAll('[data-pm-choose]')) : [];
    var tblErr = root.parentNode.querySelector('[data-pm-tbl-err]');
    chooseBtns.forEach(function (btn) {
      var original = btn.innerHTML;
      btn.addEventListener('click', function () {
        var pkg = btn.getAttribute('data-pm-choose');
        if (tblErr) tblErr.hidden = true;
        addPackageToCart(pkg, btn, {
          ctaLocation: 'oplossingen_vergelijk_tabel',
          bron: 'Oplossingen',
          onDone: function () {
            btn.innerHTML = 'Toegevoegd ✓';
            setTimeout(function () { btn.innerHTML = original; btn.disabled = false; }, 1800);
          },
          onError: function () {
            btn.innerHTML = original; btn.disabled = false;
            if (tblErr) { tblErr.textContent = 'Toevoegen mislukt. Probeer het opnieuw.'; tblErr.hidden = false; }
          }
        });
      });
    });

    render();
  }

  function ready() {
    document.querySelectorAll('[data-pm-root]').forEach(init);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})();
