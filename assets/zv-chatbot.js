/*
 * zv-chatbot.js — FAQ chatbot widget controller.
 *
 * Attaches to every [data-zv-chatbot] container. Holds conversation state in memory only
 * (per page load, not persisted across reloads), POSTs each turn to the chatbot-faq
 * Supabase Edge Function, renders the reply, and — when the function reports
 * lead_detected — builds and sends a lead exactly the way every other lead form does:
 * window.ZVMeasurement.buildCallbackLead() + window.ZVLeadWebhook.send(lead, 'chatbot').
 * This is a reuse of the existing pipeline, not a fourth/parallel one — see
 * docs/chatbot-faq-design-2026-09-17.md.
 *
 * Only one chatbot lead is sent per widget instance (first lead_detected turn wins) —
 * without this, a visitor who keeps mentioning their email/phone across several messages
 * would otherwise generate a duplicate Odoo lead per turn.
 *
 * No API key or knowledge-base content lives here. `data-anon-key` is the Supabase
 * project's public anon key (same posture as sections/contact-page.liquid's capture-lead
 * call) — it authenticates the Edge Function call, it isn't a secret.
 *
 * Depends on zv-measurement.js and zv-lead-webhook.js (loaded before this file — see
 * sections/zv-chatbot.liquid).
 */
(function (window, document) {
  'use strict';

  var ZV = window.ZVMeasurement || {};
  var GENERIC_ERROR = 'Er ging iets mis. Bel ons gerust direct op 088 122 11 11.';

  function init(root) {
    if (root.__zvChatbotBound) return;
    root.__zvChatbotBound = true;

    var endpoint = root.getAttribute('data-endpoint');
    var anonKey = root.getAttribute('data-anon-key');
    var launcher = root.querySelector('[data-zv-chatbot-toggle]');
    var closeBtn = root.querySelector('[data-zv-chatbot-close]');
    var panel = root.querySelector('.zv-chatbot-panel');
    var messagesEl = root.querySelector('[data-zv-chatbot-messages]');
    var statusEl = root.querySelector('[data-zv-chatbot-status]');
    var form = root.querySelector('[data-zv-chatbot-form]');
    var input = form ? form.querySelector('textarea') : null;

    var history = []; // [{role, content}] — what the server itself returned/received last turn
    var leadSent = false;
    var sending = false;

    function setStatus(message, kind) {
      if (!statusEl) return;
      if (!message) {
        statusEl.hidden = true;
        statusEl.textContent = '';
        return;
      }
      statusEl.hidden = false;
      statusEl.textContent = message;
      statusEl.setAttribute('data-kind', kind || 'info');
    }

    function addMessage(role, text) {
      if (!messagesEl) return;
      var el = document.createElement('p');
      el.className = 'zv-chatbot-msg zv-chatbot-msg--' + role;
      el.textContent = text;
      messagesEl.appendChild(el);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function open() {
      if (!panel) return;
      panel.hidden = false;
      if (launcher) launcher.setAttribute('aria-expanded', 'true');
      if (messagesEl && !messagesEl.children.length) {
        addMessage('assistant', 'Hallo, waarmee kan ik u helpen?');
      }
      if (input) input.focus();
    }

    function close() {
      if (!panel) return;
      panel.hidden = true;
      if (launcher) launcher.setAttribute('aria-expanded', 'false');
    }

    function sendLead(extracted, lastMessage) {
      if (leadSent) return;
      if (!ZV.buildCallbackLead || !window.ZVLeadWebhook) return;
      var lead = ZV.buildCallbackLead({
        lead_type: 'chatbot',
        cta_location: 'chatbot_widget',
        name: null,
        phone: (extracted && extracted.phone) || null,
        email: (extracted && extracted.email) || null,
        message: lastMessage
      });
      window.ZVLeadWebhook.send(lead, 'chatbot');
      leadSent = true;
    }

    function submit(e) {
      if (e) e.preventDefault();
      if (sending || !input) return;

      var text = input.value.trim();
      if (!text) return;

      if (!endpoint) {
        setStatus('Chat is niet beschikbaar. Bel ons gerust direct op 088 122 11 11.', 'error');
        return;
      }

      addMessage('user', text);
      input.value = '';
      sending = true;
      setStatus('Bezig met typen...', 'info');

      window.fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
          'Authorization': 'Bearer ' + anonKey
        },
        body: JSON.stringify({ conversation_history: history, message: text })
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; });
        })
        .then(function (json) {
          sending = false;
          var reply = json && json.reply;
          if (!reply) {
            setStatus(GENERIC_ERROR, 'error');
            return;
          }
          setStatus('');
          history.push({ role: 'user', content: text });
          history.push({ role: 'assistant', content: reply });
          addMessage('assistant', reply);
          if (json.lead_detected) sendLead(json.extracted, text);
        })
        .catch(function () {
          sending = false;
          setStatus('Versturen lukte niet. Probeer opnieuw of bel 088 122 11 11.', 'error');
        });
    }

    if (launcher) {
      launcher.addEventListener('click', function () {
        if (panel && panel.hidden) open(); else close();
      });
    }
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (form) form.addEventListener('submit', submit);
    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          submit();
        }
      });
    }
  }

  function ready() {
    var roots = document.querySelectorAll('[data-zv-chatbot]');
    for (var i = 0; i < roots.length; i++) init(roots[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }
})(window, document);
