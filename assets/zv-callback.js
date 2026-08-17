/*
  zv-callback.js — "Bel mij terug" callback lead controller.

  Attaches to every [data-zv-callback] form. Fires the callback_* dataLayer events,
  assembles the CRM/Odoo lead payload (via window.ZVMeasurement.buildCallbackLead) and
  POSTs it to the form's data-endpoint.

  Privacy: name, phone and email are sent ONLY to the first-party callback endpoint.
  They are NEVER placed on the dataLayer. The success/error dataLayer events carry only
  non-identifying context (package, category, cta_location).

  Depends on zv-measurement.js (loaded before this file).
*/
(function (window, document) {
  'use strict';

  var ZV = window.ZVMeasurement || {};

  function statusEl(form) { return form.querySelector('.zv-cb-status'); }

  function setStatus(form, message, kind) {
    var el = statusEl(form);
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    el.setAttribute('data-kind', kind || 'info');
  }

  // Non-PII context for dataLayer events.
  function ctx(form) {
    return {
      lead_type: 'callback_request',
      solution_category: form.getAttribute('data-solution-category') || undefined,
      item_id: form.getAttribute('data-item-id') || undefined,
      cta_location: form.getAttribute('data-cta-location') || undefined
    };
  }

  function init(form) {
    if (form.__zvBound) return;
    form.__zvBound = true;

    // callback_form_start on first interaction with any field.
    var started = false;
    form.addEventListener('focusin', function () {
      if (started) return;
      started = true;
      if (ZV.callbackFormStart) ZV.callbackFormStart(form);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var consent = form.querySelector('[name="consent"]');
      if (consent && !consent.checked) {
        setStatus(form, 'Geef eerst toestemming zodat we contact mogen opnemen.', 'error');
        consent.focus();
        return;
      }
      if (!form.checkValidity()) {
        setStatus(form, 'Vul uw naam en telefoonnummer in.', 'error');
        return;
      }

      if (ZV.callbackFormSubmit) ZV.callbackFormSubmit(form);

      var endpoint = form.getAttribute('data-endpoint');
      if (!endpoint) {
        // No endpoint configured: fail loudly, never pretend the lead was sent.
        setStatus(form, 'Er ging iets mis. Bel ons gerust direct op 088 012 3456.', 'error');
        if (ZV.callbackRequestError) ZV.callbackRequestError({ reason: 'no_endpoint', lead_type: 'callback_request' });
        return;
      }

      // Assemble lead: page/journey context + attribution (from storage) + form fields.
      var pageContext = {
        solution_category: form.getAttribute('data-solution-category') || undefined,
        item_id: form.getAttribute('data-item-id') || undefined,
        item_name: form.getAttribute('data-item-name') || undefined,
        monthly_price: form.getAttribute('data-monthly-price') || undefined,
        keuzehulp_result: form.getAttribute('data-keuzehulp-result') || undefined,
        cta_location: form.getAttribute('data-cta-location') || undefined,
        selected_options: form.getAttribute('data-selected-options') || undefined
      };
      var lead = ZV.buildCallbackLead ? ZV.buildCallbackLead(pageContext) : pageContext;
      lead.name = (form.querySelector('[name="name"]') || {}).value || '';
      lead.phone = (form.querySelector('[name="phone"]') || {}).value || '';
      lead.email = (form.querySelector('[name="email"]') || {}).value || '';
      lead.preferred_callback_time = (form.querySelector('[name="preferred_callback_time"]') || {}).value || '';
      lead.consent = !!(consent && consent.checked);

      var btn = form.querySelector('.zv-cb-submit');
      if (btn) { btn.disabled = true; }
      setStatus(form, 'Bezig met versturen...', 'info');

      window.fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(lead),
        keepalive: true,
        mode: 'no-cors'
      })
        .then(function () {
          // Cross-origin webhook returns an opaque response (no CORS headers),
          // so we can't read status. The POST still reaches Odoo; treat as sent.
          form.reset();
          setStatus(form, 'Bedankt. We bellen u terug op het gekozen moment.', 'success');
          if (ZV.callbackRequestSuccess) ZV.callbackRequestSuccess(ctx(form));
        })
        .catch(function () {
          if (btn) { btn.disabled = false; }
          setStatus(form, 'Versturen lukte niet. Probeer opnieuw of bel 088 012 3456.', 'error');
          var c = ctx(form); c.reason = 'request_failed';
          if (ZV.callbackRequestError) ZV.callbackRequestError(c);
        });
    });
  }

  function bindTriggers() {
    // Buttons that open a callback form fire callback_cta_click.
    document.addEventListener('click', function (e) {
      var trigger = e.target.closest ? e.target.closest('[data-zv-callback-trigger]') : null;
      if (trigger && ZV.callbackCtaClick) ZV.callbackCtaClick(trigger);
    });
  }

  function ready() {
    var forms = document.querySelectorAll('[data-zv-callback]');
    for (var i = 0; i < forms.length; i++) init(forms[i]);
    bindTriggers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }
})(window, document);
