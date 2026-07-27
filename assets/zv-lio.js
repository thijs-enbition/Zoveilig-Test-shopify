/*
  zv-lio.js — Lio funnel-helper controller.

  Shows the Lio popup with the matching art + message at decision milestones,
  then auto-hides. Self-contained: it listens for funnel events and clicks, so no
  other file has to know about Lio. Milestones can also be fired manually:
      document.dispatchEvent(new CustomEvent('zv:lio', { detail: 'winkelwagen' }));

  Honours the design rule: Lio only appears in response to a funnel action, never
  as static page decoration.
*/
(function (window, document) {
  'use strict';

  var MESSAGES = {
    hoi: 'Hoi!',
    bekijk: 'Bekijk dit!',
    winkelwagen: 'In de winkelwagen!',
    keuze: 'Goede keuze!'
  };
  var AUTO_HIDE_MS = 4200;
  var hideTimer;

  function el() { return document.querySelector('[data-zv-lio]'); }

  function hide() {
    var root = el();
    if (!root) return;
    root.classList.remove('is-visible');
    window.setTimeout(function () { if (root) root.hidden = true; }, 320);
  }

  function show(mood) {
    var root = el();
    if (!root || !MESSAGES[mood]) return;
    var img = root.querySelector('[data-zv-lio-img]');
    var msg = root.querySelector('[data-zv-lio-msg]');
    var src = root.getAttribute('data-img-' + mood);
    if (src && img) img.src = src;
    if (msg) msg.textContent = MESSAGES[mood];
    root.hidden = false;
    void root.offsetWidth; // reflow so the transition runs
    root.classList.add('is-visible');
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(hide, AUTO_HIDE_MS);
  }

  function ready() {
    var root = el();
    if (!root) return;

    var close = root.querySelector('[data-zv-lio-close]');
    if (close) close.addEventListener('click', hide);

    // Manual + cart events.
    document.addEventListener('zv:lio', function (e) { show(e.detail); });
    document.addEventListener('zv:cart:added', function () { show('winkelwagen'); });

    // Funnel clicks (delegated) map to milestones.
    document.addEventListener('click', function (e) {
      if (!e.target.closest) return;
      if (e.target.closest('[data-zv-finder]')) { show('hoi'); return; }
      if (e.target.closest('[data-zv-package-view]')) { show('bekijk'); return; }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }
})(window, document);
