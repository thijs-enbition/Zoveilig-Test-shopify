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
  ZV.__initialised = true;
})(window);
