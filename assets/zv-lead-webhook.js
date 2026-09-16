/*
 * Shared send-with-failure-visibility wrapper for every ZV_LEAD_ENDPOINT call site
 * (Vista, Veilig Onderweg "Binnenkort beschikbaar", camera-hardware "Neem contact op").
 *
 * ZV_LEAD_ENDPOINT is called with mode:'no-cors', so a non-2xx response from the
 * endpoint is always an opaque "success" to this code — that's a structural limit of
 * no-cors, not something this file can see around. What IS detectable, and what this
 * logs, is: the request never went out at all (network_error — DNS failure, connection
 * refused, offline, etc.), it never got a response within a generous window
 * (timeout), or building/sending it threw synchronously (exception). See
 * docs/lead-webhook-failure-logging-2026-09-15.md for the full reasoning.
 *
 * Logging is best-effort and silent by design: if ZV_WEBHOOK_FAILURE_LOG_ENDPOINT/KEY
 * aren't configured (Shopify theme settings, blank by default), this simply does
 * nothing beyond the existing fire-and-forget send — same as before this file existed.
 */
window.ZVLeadWebhook = (function () {
  var FAILURE_LOG_TIMEOUT_MS = 15000; // generous: a real slow-but-working send shouldn't get logged as a timeout

  function logFailure(source, errorType, errorMessage) {
    try {
      var endpoint = window.ZV_WEBHOOK_FAILURE_LOG_ENDPOINT;
      var key = window.ZV_WEBHOOK_FAILURE_LOG_KEY;
      if (!endpoint || !key) return; // not configured: fail silent, same as before this existed

      var endpointHost = '';
      try { endpointHost = new URL(window.ZV_LEAD_ENDPOINT || '').host; } catch (e) {}

      window.fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': key,
          'Authorization': 'Bearer ' + key
        },
        body: JSON.stringify({
          source: source,
          endpoint_host: endpointHost,
          error_type: errorType,
          error_message: String(errorMessage || '').slice(0, 500),
          occurred_at: new Date().toISOString()
        }),
        keepalive: true
      }).catch(function () {}); // the failure log itself is also fire-and-forget — nothing left to fall back to
    } catch (e) {}
  }

  /**
   * Send a lead payload to ZV_LEAD_ENDPOINT. Same fire-and-forget contract as before
   * (never throws, never changes what the caller shows the visitor) — the only
   * difference from the old inline per-site code is that a detectable failure gets
   * logged instead of disappearing into an empty .catch().
   *
   * @param {object} payload   the lead record (already includes ts if the caller wants it)
   * @param {string} source    which form this is, e.g. 'vista' | 'camera_hardware' | 'onderweg_coming_soon'
   */
  function send(payload, source) {
    if (!window.ZV_LEAD_ENDPOINT) return;

    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timedOut = false;
    var timer = controller && setTimeout(function () {
      timedOut = true;
      controller.abort();
    }, FAILURE_LOG_TIMEOUT_MS);

    var opts = {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(payload),
      keepalive: true,
      mode: 'no-cors'
    };
    if (controller) opts.signal = controller.signal;

    try {
      window.fetch(window.ZV_LEAD_ENDPOINT, opts).then(function () {
        if (timer) clearTimeout(timer);
      }).catch(function (err) {
        if (timer) clearTimeout(timer);
        logFailure(source, timedOut ? 'timeout' : 'network_error', err && err.message);
      });
    } catch (e) {
      if (timer) clearTimeout(timer);
      logFailure(source, 'exception', e && e.message);
    }
  }

  return { send: send };
})();
