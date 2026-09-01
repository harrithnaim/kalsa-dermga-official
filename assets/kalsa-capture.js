/* =====================================================================
   KALSA CAPTURE — the enrolment form also lands in the app
   =====================================================================
   The form keeps posting to Web3Forms exactly as it does today. This
   quietly sends the same fields to apps.kalsadermaga.com as well, so an
   enrolment appears in the LMS register the moment a parent submits it.
   The email stays as the safety net; a failure here is swallowed on
   purpose so the parent never sees an error caused by our server.
   Managed by the admin console — do not hand-edit.
   ===================================================================== */
(function () {
  'use strict';
  var API = 'https://apps.kalsadermaga.com/api/superapp/public/lms/enquiry';
  var WAIT_MS = 400;
  function fieldsOf(form) {
    var out = {};
    var data = new FormData(form);
    data.forEach(function (value, key) {
      if (key === 'access_key' || key === 'redirect' || key === 'subject' || key === 'from_name') return;
      if (out[key] === undefined) { out[key] = value; return; }
      if (Array.isArray(out[key])) out[key].push(value);
      else out[key] = [out[key], value];
    });
    return out;
  }
  function isEnrolment(form) {
    var names = Array.prototype.map.call(form.elements, function (el) { return (el.name || '').toLowerCase(); });
    return names.indexOf('child name') >= 0 || names.indexOf('child_name') >= 0;
  }
  function send(payload) {
    var body = JSON.stringify(payload);
    // text/plain is a CORS-safelisted Content-Type, so neither the beacon nor
    // the fetch triggers a CORS preflight. An application/json beacon DOES need
    // one, which iOS Safari cannot perform for a beacon -- so those submissions
    // were being dropped silently. The server accepts a JSON text body whatever
    // the declared Content-Type.
    if (navigator.sendBeacon) {
      try {
        var blob = new Blob([body], { type: 'text/plain;charset=UTF-8' });
        if (navigator.sendBeacon(API, blob)) return { beacon: true, done: Promise.resolve(true) };
      } catch (e) { /* fall through to fetch */ }
    }
    var done = fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: body, keepalive: true, mode: 'cors' })
      .then(function () { return true; }).catch(function () { return false; });
    return { beacon: false, done: done };
  }
  function attach(form) {
    if (form.getAttribute('data-kalsa-capture') === 'on') return;
    form.setAttribute('data-kalsa-capture', 'on');
    form.addEventListener('submit', function (ev) {
      if (form.checkValidity && !form.checkValidity()) return;
      var payload = fieldsOf(form);
      var r = send(payload);
      // Beacon accepted -> data is already queued by the browser; let the form
      // submit / navigate as normal.
      if (r.beacon) return;
      // Otherwise hold the navigation briefly so the keepalive fetch is flushed
      // before the page unloads, then release regardless of the outcome.
      ev.preventDefault();
      var released = false;
      var go = function () {
        if (released) return;
        released = true;
        form.removeAttribute('data-kalsa-capture');
        form.submit();
      };
      setTimeout(go, WAIT_MS);
      r.done.then(go, go);
    });
  }
  function init() {
    var forms = document.querySelectorAll('form');
    Array.prototype.forEach.call(forms, function (f) { if (isEnrolment(f)) attach(f); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
