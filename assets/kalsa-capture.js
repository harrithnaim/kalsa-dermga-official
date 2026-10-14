(function() {
  'use strict';
  var API = 'https://apps.kalsadermaga.com/api/superapp/public/lms/enquiry';
  var WAIT_MS = 400;
  function fieldsOf(form) {
    var out = {};
    var data = new FormData(form);
    data.forEach(function(value, key) {
      if (key === 'access_key' || key === 'redirect' || key === 'subject' || key === 'from_name') return;
      if (out[key] === undefined) {
        out[key] = value;
        return;
      }
      if (Array.isArray(out[key])) out[key].push(value); else out[key] = [ out[key], value ];
    });
    return out;
  }
  function isEnrolment(form) {
    var names = Array.prototype.map.call(form.elements, function(el) {
      return (el.name || '').toLowerCase();
    });
    return names.indexOf('child name') >= 0 || names.indexOf('child_name') >= 0;
  }
  function send(payload) {
    var body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      try {
        var blob = new Blob([ body ], {
          type: 'text/plain;charset=UTF-8'
        });
        if (navigator.sendBeacon(API, blob)) return {
          beacon: true,
          done: Promise.resolve(true)
        };
      } catch (e) {}
    }
    var done = fetch(API, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8'
      },
      body: body,
      keepalive: true,
      mode: 'cors'
    }).then(function() {
      return true;
    }).catch(function() {
      return false;
    });
    return {
      beacon: false,
      done: done
    };
  }
  function attach(form) {
    if (form.getAttribute('data-kalsa-capture') === 'on') return;
    form.setAttribute('data-kalsa-capture', 'on');
    form.addEventListener('submit', function(ev) {
      if (form.checkValidity && !form.checkValidity()) return;
      var payload = fieldsOf(form);
      var r = send(payload);
      if (r.beacon) return;
      ev.preventDefault();
      var released = false;
      var go = function() {
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
    Array.prototype.forEach.call(forms, function(f) {
      if (isEnrolment(f)) attach(f);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
