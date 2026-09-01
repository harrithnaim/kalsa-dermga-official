/* Kalsa Dermaga — interactions
   Progressive enhancement only: everything below degrades to a working
   static page if JS is off or the browser is old. */
(function () {
  'use strict';

  var reduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------
     1. Reveal on scroll
     Elements marked .reveal / .reveal-l / .reveal-r / .reveal-s fade
     in once as they enter the viewport. Staggered per group via
     data-stagger on the parent.
     --------------------------------------------------------------- */
  function initReveal() {
    var items = document.querySelectorAll('.reveal, .reveal-l, .reveal-r, .reveal-s');
    if (!items.length) return;

    if (reduced || !('IntersectionObserver' in window)) {
      for (var i = 0; i < items.length; i++) items[i].classList.add('in');
      return;
    }

    // stagger children of any [data-stagger] container
    var groups = document.querySelectorAll('[data-stagger]');
    for (var g = 0; g < groups.length; g++) {
      var step = parseInt(groups[g].getAttribute('data-stagger'), 10) || 90;
      var kids = groups[g].children;
      for (var k = 0; k < kids.length; k++) {
        if (kids[k].classList.contains('reveal') ||
            kids[k].classList.contains('reveal-l') ||
            kids[k].classList.contains('reveal-r') ||
            kids[k].classList.contains('reveal-s')) {
          kids[k].style.setProperty('--d', (k * step) + 'ms');
        }
      }
    }

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          obs.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    for (var n = 0; n < items.length; n++) obs.observe(items[n]);
  }

  /* ---------------------------------------------------------------
     2. Sticky nav shadow once the page has scrolled
     --------------------------------------------------------------- */
  function initNav() {
    var nav = document.querySelector('.stickynav');
    if (!nav) return;
    var ticking = false;
    function update() {
      nav.classList.toggle('scrolled', window.scrollY > 12);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  }

  /* ---------------------------------------------------------------
     3. Count-up stats
     <span data-count="7" data-suffix="+">7+</span>
     --------------------------------------------------------------- */
  function initCounters() {
    var nums = document.querySelectorAll('[data-count]');
    if (!nums.length) return;

    if (reduced || !('IntersectionObserver' in window)) return; // leave static text

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        obs.unobserve(e.target);
        var el = e.target;
        var target = parseFloat(el.getAttribute('data-count'));
        var suffix = el.getAttribute('data-suffix') || '';
        var prefix = el.getAttribute('data-prefix') || '';
        if (isNaN(target)) return;
        var dur = 1300, t0 = null;
        function frame(ts) {
          if (t0 === null) t0 = ts;
          var p = Math.min((ts - t0) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = prefix + Math.round(target * eased) + suffix;
          if (p < 1) window.requestAnimationFrame(frame);
        }
        window.requestAnimationFrame(frame);
      });
    }, { threshold: 0.5 });

    for (var i = 0; i < nums.length; i++) obs.observe(nums[i]);
  }

  /* ---------------------------------------------------------------
     4. Carousel arrows — scrolls the rail by roughly one card
     --------------------------------------------------------------- */
  function initCarousels() {
    var cars = document.querySelectorAll('.carousel');
    for (var i = 0; i < cars.length; i++) {
      (function (car) {
        var rail = car.querySelector('.crail');
        if (!rail) return;
        var prev = car.querySelector('[data-car="prev"]');
        var next = car.querySelector('[data-car="next"]');
        function step(dir) {
          var slide = rail.querySelector('.cslide');
          var w = slide ? slide.getBoundingClientRect().width + 16 : rail.clientWidth * 0.8;
          rail.scrollBy({ left: dir * w, behavior: reduced ? 'auto' : 'smooth' });
        }
        if (prev) prev.addEventListener('click', function () { step(-1); });
        if (next) next.addEventListener('click', function () { step(1); });

        function sync() {
          var max = rail.scrollWidth - rail.clientWidth - 2;
          if (prev) prev.disabled = rail.scrollLeft <= 2;
          if (next) next.disabled = rail.scrollLeft >= max;
        }
        rail.addEventListener('scroll', sync, { passive: true });
        window.addEventListener('resize', sync);
        sync();
      })(cars[i]);
    }
  }

  /* ---------------------------------------------------------------
     5. Duplicate marquee content so the loop is seamless
     --------------------------------------------------------------- */
  function initMarquee() {
    var tracks = document.querySelectorAll('.marquee-track');
    for (var i = 0; i < tracks.length; i++) {
      if (tracks[i].getAttribute('data-cloned')) continue;
      tracks[i].innerHTML += tracks[i].innerHTML;
      tracks[i].setAttribute('data-cloned', '1');
      tracks[i].setAttribute('aria-hidden', 'true');
    }
  }

  /* ---------------------------------------------------------------
     6. Close the mobile menu after tapping a link
     --------------------------------------------------------------- */
  function initMobileNav() {
    var check = document.getElementById('navcheck');
    var menu = document.querySelector('.mobilenav');
    if (!check || !menu) return;
    menu.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') check.checked = false;
    });
  }

  /* ---------------------------------------------------------------
     7. Auto-reveal for pages that opt in with <body data-autoreveal>
     Tags up headings, cards and figures so the venture pages get the
     same scroll motion without hand-editing every section.
     --------------------------------------------------------------- */
  function initAutoReveal() {
    if (!document.body.hasAttribute('data-autoreveal')) return;
    var sel = 'section h2, section h3.card-title, section .card, section figure, ' +
              'section .lede, section > div > p, .vcard, .newscard';
    var els = document.querySelectorAll(sel);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.closest('header') || el.closest('footer')) continue;
      /* Never auto-reveal anything inside a marquee. initMarquee runs
         AFTER this and duplicates the track's innerHTML, so the clones
         carry the reveal class but were never handed to the observer —
         they stay at opacity 0 forever and half the strip is invisible.
         A marquee is decorative and already moving; it needs no reveal. */
      if (el.closest('.marquee')) continue;
      if (el.classList.contains('reveal') || el.classList.contains('reveal-l') ||
          el.classList.contains('reveal-r') || el.classList.contains('reveal-s')) continue;
      if (el.closest('.card') && el.classList.contains('card-title')) continue;
      el.classList.add('reveal');
    }
    // stagger siblings inside each grid
    var grids = document.querySelectorAll('section div[style*="grid-template-columns"]');
    for (var g = 0; g < grids.length; g++) {
      var kids = grids[g].children, c = 0;
      for (var k = 0; k < kids.length; k++) {
        if (kids[k].classList.contains('reveal')) {
          kids[k].style.setProperty('--d', (c * 80) + 'ms');
          c++;
        }
      }
    }
  }

  /* ---------------------------------------------------------------
     8. Photo lightbox
     Any .pgrid button opens its image full-size. Arrow keys and the
     on-screen arrows move between photos; Esc or a backdrop click
     closes. Focus returns to the thumbnail that opened it.
     --------------------------------------------------------------- */
  function initLightbox() {
    var grids = document.querySelectorAll('.pgrid');
    if (!grids.length) return;

    var box = document.createElement('div');
    box.className = 'lbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Photo viewer');
    box.innerHTML =
      '<button class="lclose" type="button" aria-label="Close">✕</button>' +
      '<button class="lprev" type="button" aria-label="Previous photo">‹</button>' +
      '<button class="lnext" type="button" aria-label="Next photo">›</button>' +
      '<div><img alt=""><div class="lcap"></div></div>';
    document.body.appendChild(box);

    var img = box.querySelector('img');
    var cap = box.querySelector('.lcap');
    var shots = [], idx = 0, opener = null;

    for (var g = 0; g < grids.length; g++) {
      var btns = grids[g].querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        (function (btn) {
          var im = btn.querySelector('img');
          if (!im) return;
          var c = btn.querySelector('figcaption');
          var rec = { src: im.getAttribute('data-full') || im.src,
                      alt: im.alt || '',
                      cap: c ? c.textContent.trim() : '' };
          shots.push(rec);
          var myIndex = shots.length - 1;
          btn.addEventListener('click', function () { opener = btn; show(myIndex); });
        })(btns[i]);
      }
    }
    if (!shots.length) { box.parentNode.removeChild(box); return; }

    function show(n) {
      idx = (n + shots.length) % shots.length;
      img.src = shots[idx].src;
      img.alt = shots[idx].alt;
      cap.textContent = shots[idx].cap;
      box.classList.add('open');
      document.body.style.overflow = 'hidden';
      box.querySelector('.lclose').focus();
    }
    function close() {
      box.classList.remove('open');
      document.body.style.overflow = '';
      img.src = '';
      if (opener) { opener.focus(); opener = null; }
    }

    box.querySelector('.lclose').addEventListener('click', close);
    box.querySelector('.lprev').addEventListener('click', function (e) {
      e.stopPropagation(); show(idx - 1);
    });
    box.querySelector('.lnext').addEventListener('click', function (e) {
      e.stopPropagation(); show(idx + 1);
    });
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    document.addEventListener('keydown', function (e) {
      if (!box.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(idx - 1);
      else if (e.key === 'ArrowRight') show(idx + 1);
    });
  }

  /* ---------------------------------------------------------------
     9. Click-to-play video facade
     Shows a poster until pressed, then swaps in the real player.
     Supports YouTube (data-yt) and Google Drive (data-drive). Nothing
     is requested from either service until someone actually presses
     play — which keeps the page fast, avoids third-party tracking of
     visitors who never watch, and with Drive avoids spending the
     file's daily bandwidth quota on people who just scroll past.
     --------------------------------------------------------------- */
  /* ---------------------------------------------------------------
     Publish the header height as --kd-navh
     The transparent-over-hero nav needs the hero to start behind the
     bar. CSS cannot measure the bar, so it is published here and the
     stylesheet pulls the hero up by exactly that much and pads it back
     down again. Falls back to 0px, which is the old layout, so a page
     with this script blocked still looks right rather than broken.
     --------------------------------------------------------------- */
  function initNavHeight() {
    var head = document.querySelector('.stickynav');
    if (!head) return;
    var apply = function () {
      document.documentElement.style.setProperty(
        '--kd-navh', Math.round(head.getBoundingClientRect().height) + 'px');
    };
    apply();
    if (window.ResizeObserver) new ResizeObserver(apply).observe(head);
    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt); rt = setTimeout(apply, 120);
    }, { passive: true });
    window.addEventListener('load', apply);
  }

  function initVideoFacade() {
    var wraps = document.querySelectorAll('.vfacade');
    for (var i = 0; i < wraps.length; i++) {
      (function (w) {
        var yt = w.getAttribute('data-yt');
        var list = w.getAttribute('data-yt-list');
        var dr = w.getAttribute('data-drive');
        var btn = w.querySelector('.vplay');
        if (!btn) return;

        // no id filled in yet — hide the play button rather than
        // giving the visitor a control that does nothing
        var unset = function (v) { return !v || v.indexOf('PASTE_') === 0; };
        if (unset(yt) && unset(list) && unset(dr)) { btn.style.display = 'none'; return; }

        function play() {
          if (w.classList.contains('playing')) return;
          var src, allow;
          if (!unset(yt) || !unset(list)) {
            /* Three shapes, and which one you get depends only on the
               attributes:

                 data-yt only          that one film
                 data-yt + data-yt-list  that film first, with the rest of
                                       the playlist queued behind it
                 data-yt-list only     "videoseries", which plays the
                                       NEWEST item first — so pointing it
                                       at a channel's uploads playlist
                                       (swap the UC of a channel id for
                                       UU) means new films appear here on
                                       their own, with no edit at all.

               rel=0 keeps YouTube's end-screen suggestions inside the
               same channel rather than sending a parent off to whatever
               the algorithm fancies, which matters on a children's
               programme page. */
            var base = unset(yt) ? 'videoseries' : encodeURIComponent(yt);
            src = 'https://www.youtube-nocookie.com/embed/' + base +
                  '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
            if (!unset(list)) src += '&list=' + encodeURIComponent(list);
            allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen';
          } else {
            src = 'https://drive.google.com/file/d/' + encodeURIComponent(dr) + '/preview';
            allow = 'autoplay; fullscreen';
          }
          var f = document.createElement('iframe');
          f.setAttribute('src', src);
          f.setAttribute('title', w.getAttribute('data-title') || 'Video');
          f.setAttribute('allow', allow);
          f.setAttribute('allowfullscreen', '');
          f.setAttribute('loading', 'lazy');
          f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
          w.classList.add('playing');
          w.appendChild(f);
          f.focus();
        }

        /* Point any "watch on YouTube" link at the same video, so the
           id lives in exactly one place. Two copies of it in the markup
           is a trap: somebody swaps the film, updates the player, misses
           the link, and it quietly sends people to a deleted video. */
        var note = w.nextElementSibling;
        var out = note && note.querySelector && note.querySelector('a.ytlink');
        if (out) {
          if (!unset(yt)) {
            out.setAttribute('href', 'https://www.youtube.com/watch?v=' + encodeURIComponent(yt) +
              (unset(list) ? '' : '&list=' + encodeURIComponent(list)));
          } else if (!unset(list)) {
            out.setAttribute('href', 'https://www.youtube.com/playlist?list=' + encodeURIComponent(list));
          }
        }

        btn.addEventListener('click', play);
        w.addEventListener('click', function (e) {
          if (e.target === btn || btn.contains(e.target)) return;
          play();
        });
      })(wraps[i]);
    }
  }

  /* ---------------------------------------------------------------
     10. Copy the feedback form to our own server as well as email
     The form posts to Web3Forms exactly as before — that is still the
     thing that must not fail, and it keeps working if our server is
     off. This additionally sends a copy to the admin console so an
     approved reply can become a published quote in one click, instead
     of someone retyping it out of an inbox.

     Deliberately fire-and-forget: sendBeacon cannot delay or block the
     real submit, and every failure is swallowed. If our server is
     asleep the parent notices nothing and the email still arrives.
     --------------------------------------------------------------- */
  var FEEDBACK_SINK = 'https://apps.kalsadermaga.com/api/superapp/site/feedback';

  function initFeedbackCopy() {
    var form = document.querySelector('#feedback form');
    if (!form || !navigator.sendBeacon) return;
    form.addEventListener('submit', function () {
      try {
        var out = {};
        var els = form.querySelectorAll('input[name],select[name],textarea[name]');
        for (var i = 0; i < els.length; i++) {
          var el = els[i];
          if (['access_key', 'subject', 'from_name', 'redirect', 'botcheck'].indexOf(el.name) > -1) continue;
          if (el.type === 'radio' && !el.checked) continue;
          if (el.type === 'checkbox') { out[el.name] = el.checked ? el.value || 'yes' : ''; continue; }
          out[el.name] = el.value;
        }
        var blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
        navigator.sendBeacon(FEEDBACK_SINK, blob);
      } catch (e) { /* never let this affect the real submit */ }
    });
  }

  /* ---------------------------------------------------------------
     11. Site-wide announcement banner
     Read from assets/announcement.json rather than baked into every
     page: one small file to publish, and the banner then appears on
     all eleven pages instead of needing a marker in each of them.
     A banner is not search-engine content, so rendering it with JS
     costs nothing that matters.

     Dismissal is remembered per announcement id, so a new notice
     shows again even to someone who closed the last one.
     --------------------------------------------------------------- */
  function initBanner() {
    if (!window.fetch) return;
    fetch('assets/announcement.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (a) {
        if (!a || !a.active || !a.text) return;
        try { if (localStorage.getItem('kd_ann_' + a.id) === '1') return; } catch (e) {}

        var bar = document.createElement('div');
        bar.className = 'kdbanner' + (a.tone === 'warn' ? ' warn' : (a.tone === 'good' ? ' good' : ''));
        bar.setAttribute('role', 'status');

        var t = document.createElement('span');
        t.className = 'kdb-t';
        t.textContent = a.text;                    // textContent, never innerHTML
        bar.appendChild(t);

        if (a.linkText && a.linkHref) {
          var link = document.createElement('a');
          link.href = a.linkHref;
          link.textContent = a.linkText;
          bar.appendChild(link);
        }

        var x = document.createElement('button');
        x.type = 'button';
        x.setAttribute('aria-label', 'Dismiss this announcement');
        x.textContent = '✕';
        x.onclick = function () {
          bar.remove();
          try { localStorage.setItem('kd_ann_' + a.id, '1'); } catch (e) {}
        };
        bar.appendChild(x);

        document.body.insertBefore(bar, document.body.firstChild);
      })
      .catch(function () { /* no banner is a fine outcome */ });
  }

  /* ---------------------------------------------------------------
     12. Enrolment: module pricing + pay-now / pay-later-on-WhatsApp
     The enrolment form on little-marine-scientists.html has per-module
     checkboxes (data-mod-price) that build a running total, and two
     buttons instead of one plain submit:

       #btn-pay-now   → validate, send to web3forms + admin dashboard,
                        then create a CHIP checkout session and redirect.
       #btn-pay-later → validate, send to web3forms + admin dashboard,
                        then open WhatsApp with a pre-filled summary so
                        the parent can ask questions before paying.

     Both paths always reach web3forms (lmsteam@kalsadermaga.com) and
     the admin dashboard (ENROL_SINK) — payment is the only thing that
     differs between them. This section only runs on pages that have
     the enrolment form; it does nothing on pages without it.
     --------------------------------------------------------------- */
  var ENROL_SINK = 'https://apps.kalsadermaga.com/api/superapp/site/enrolment';
  var LMS_WHATSAPP_NUMBER = '60123454520'; // 012-3454520 in international format

  /* Single source of truth for module names/prices/availability — edit
     here only. Every child's picker (renderChildModules) is generated
     from this list, so adding, renaming, repricing, or activating a
     module never needs an HTML edit. */
  var LMS_MODULES = [
    { name: 'Secret Life of Low Tide', price: 60, available: true },
    { name: 'The Sick Sea Shells', price: 50, available: true },
    { name: 'Secret Drifters of The Sea', price: 60, available: true },
    { name: 'Upcoming module 4', price: 0, available: false },
    { name: 'Upcoming module 5', price: 0, available: false },
    { name: 'Upcoming module 6', price: 0, available: false }
  ];

  /* Builds one module-picker block per child inside #childmodules, based
     on "Number of children enrolling together". Each child gets their
     own checkboxes (siblings can pick different modules), and children
     2+ get their own Name/Age fields (child 1's are already in the
     "Child's details" fieldset above). Re-run whenever the sibling
     count changes; preserves already-made selections and typed
     name/age values where a child index still exists after rebuild. */
  function renderChildModules(form) {
    var container = document.getElementById('childmodules');
    var countInput = document.getElementById('c-siblingcount');
    if (!container || !countInput) return;

    var count = parseInt(countInput.value, 10) || 1;
    if (count < 1) count = 1;
    if (count > 10) count = 10;

    var preserved = {};
    var existingBlocks = container.querySelectorAll('.childmodule-block');
    for (var b = 0; b < existingBlocks.length; b++) {
      var idx = existingBlocks[b].getAttribute('data-child');
      var checked = [];
      var checks = existingBlocks[b].querySelectorAll('input[type="checkbox"]:checked');
      for (var c2 = 0; c2 < checks.length; c2++) checked.push(checks[c2].value);
      var nameInput = existingBlocks[b].querySelector('.childname-input');
      var ageInput = existingBlocks[b].querySelector('.childage-input');
      preserved[idx] = {
        checked: checked,
        name: nameInput ? nameInput.value : '',
        age: ageInput ? ageInput.value : ''
      };
    }

    container.innerHTML = '';

    for (var i = 1; i <= count; i++) {
      var block = document.createElement('div');
      block.className = 'childmodule-block';
      block.setAttribute('data-child', i);

      var heading = document.createElement('div');
      heading.className = 'childmodule-heading';
      heading.textContent = 'Child ' + i;
      block.appendChild(heading);

      if (i >= 2) {
        var row = document.createElement('div');
        row.className = 'grid2';
        row.style.marginBottom = '10px';

        var nameField = document.createElement('div');
        nameField.className = 'field';
        var nameLabel = document.createElement('label');
        nameLabel.textContent = 'Name *';
        var nameInputEl = document.createElement('input');
        nameInputEl.className = 'input childname-input';
        nameInputEl.type = 'text';
        nameInputEl.name = 'Child ' + i + ' name';
        nameInputEl.required = true;
        nameInputEl.value = (preserved[i] && preserved[i].name) || '';
        nameField.appendChild(nameLabel);
        nameField.appendChild(nameInputEl);

        var ageField = document.createElement('div');
        ageField.className = 'field';
        var ageLabel = document.createElement('label');
        ageLabel.textContent = 'Age *';
        var ageInputEl = document.createElement('input');
        ageInputEl.className = 'input childage-input';
        ageInputEl.type = 'number';
        ageInputEl.name = 'Child ' + i + ' age';
        ageInputEl.min = '4';
        ageInputEl.max = '17';
        ageInputEl.required = true;
        ageInputEl.value = (preserved[i] && preserved[i].age) || '';
        ageField.appendChild(ageLabel);
        ageField.appendChild(ageInputEl);

        row.appendChild(nameField);
        row.appendChild(ageField);
        block.appendChild(row);
      }

      var modGrid = document.createElement('div');
      modGrid.className = 'grid2 modgrid';

      for (var m = 0; m < LMS_MODULES.length; m++) {
        var mod = LMS_MODULES[m];
        var label = document.createElement('label');
        label.className = 'check modcheck' + (mod.available ? '' : ' is-upcoming');

        var input = document.createElement('input');
        input.type = 'checkbox';
        input.name = 'Modules (Child ' + i + ')';
        input.value = mod.name;
        input.setAttribute('data-mod-price', mod.price);
        if (!mod.available) input.disabled = true;
        if (preserved[i] && preserved[i].checked.indexOf(mod.name) > -1) input.checked = true;

        var span = document.createElement('span');
        span.appendChild(document.createTextNode(mod.name + ' '));
        var priceB = document.createElement('b');
        priceB.className = 'modprice' + (mod.available ? '' : ' modprice-soon');
        priceB.textContent = mod.available ? ('RM ' + mod.price) : 'Coming soon';
        span.appendChild(priceB);

        label.appendChild(input);
        label.appendChild(span);
        modGrid.appendChild(label);
      }

      block.appendChild(modGrid);

      var subEl = document.createElement('div');
      subEl.className = 'childsubtotal';
      subEl.innerHTML = 'Subtotal: <b class="childsubtotal-amount">RM 0</b>';
      block.appendChild(subEl);

      container.appendChild(block);
    }
  }

  function initModulePricing() {
    var form = document.querySelector('#enrol form');
    if (!form) return;

    var countInput = document.getElementById('c-siblingcount');
    var subtotalEl = document.getElementById('modtotal-subtotal');
    var discountRowEl = document.getElementById('modtotal-discount-row');
    var discountEl = document.getElementById('modtotal-discount');
    var childrenEl = document.getElementById('modtotal-children');
    var totalEl = document.getElementById('modtotal-amount');
    var payNowAmountEl = document.getElementById('paynow-amount');
    if (!countInput || !totalEl) return;

    function recalc() {
      var t = computeTotals(form);
      if (subtotalEl) subtotalEl.textContent = 'RM ' + t.subtotal;
      if (childrenEl) childrenEl.textContent = t.children;
      if (discountRowEl) discountRowEl.style.display = t.discount > 0 ? '' : 'none';
      if (discountEl) discountEl.textContent = '\u2212RM ' + t.discount;
      totalEl.textContent = 'RM ' + t.total;
      if (payNowAmountEl) payNowAmountEl.textContent = 'RM ' + t.total;
      return t;
    }

    function rebuild() {
      renderChildModules(form);
      var allChecks = document.querySelectorAll('#childmodules input[type="checkbox"]');
      for (var ci = 0; ci < allChecks.length; ci++) {
        allChecks[ci].addEventListener('change', recalc);
      }
      recalc();
    }

    countInput.addEventListener('input', rebuild);
    rebuild();
  }

  /* Single source of truth for pricing — used by the live total display
     (initModulePricing) and by both submit buttons, so what a parent
     sees is always exactly what gets charged. RM5/child discount kicks
     in automatically once 2 or more children are enrolling together.
     Also updates each child block's own subtotal line as a side effect. */
  function computeTotals(form) {
    var blocks = form.querySelectorAll('.childmodule-block');
    var children = blocks.length || 1;
    var subtotal = 0;
    for (var b = 0; b < blocks.length; b++) {
      var checks = blocks[b].querySelectorAll('input[type="checkbox"]:checked');
      var childSum = 0;
      for (var c = 0; c < checks.length; c++) {
        childSum += parseFloat(checks[c].getAttribute('data-mod-price')) || 0;
      }
      var subEl = blocks[b].querySelector('.childsubtotal-amount');
      if (subEl) subEl.textContent = 'RM ' + childSum;
      subtotal += childSum;
    }
    var discountPerChild = children >= 2 ? 5 : 0;
    var discount = discountPerChild * children;
    var total = Math.max(subtotal - discount, 0);
    return { children: children, subtotal: subtotal, discount: discount, total: total };
  }

  /* Returns every selected module across all children, each tagged with
     which child it belongs to (by name if typed, else "Child N") — used
     to build the CHIP checkout line items and the WhatsApp summary. */
  function getSelectedModules(form) {
    var out = [];
    var blocks = form.querySelectorAll('.childmodule-block');
    for (var b = 0; b < blocks.length; b++) {
      var idx = blocks[b].getAttribute('data-child');
      var label;
      if (idx === '1') {
        var c1 = form.querySelector('#c-name');
        label = (c1 && c1.value) || 'Child 1';
      } else {
        var ni = blocks[b].querySelector('.childname-input');
        label = (ni && ni.value) || ('Child ' + idx);
      }
      var checks = blocks[b].querySelectorAll('input[type="checkbox"]:checked');
      for (var c = 0; c < checks.length; c++) {
        out.push({
          child: label,
          name: checks[c].value,
          price: parseFloat(checks[c].getAttribute('data-mod-price')) || 0
        });
      }
    }
    return out;
  }

  function collectFormData(form) {
    var out = {};
    var els = form.querySelectorAll('input[name],select[name],textarea[name]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (['access_key', 'subject', 'from_name', 'redirect', 'botcheck'].indexOf(el.name) > -1) continue;
      if (el.type === 'checkbox') {
        if (el.name.indexOf('Modules (') === 0) { if (el.checked) { out[el.name] = out[el.name] ? out[el.name] + ', ' + el.value : el.value; } continue; }
        out[el.name] = el.checked ? (el.value || 'Yes') : '';
        continue;
      }
      if (el.type === 'radio') { if (!el.checked) continue; }
      out[el.name] = el.value;
    }
    return out;
  }

  function postWeb3Forms(form) {
    var payload = collectFormData(form);
    payload.access_key = form.querySelector('input[name="access_key"]').value;
    payload.subject = form.querySelector('input[name="subject"]').value;
    payload.from_name = form.querySelector('input[name="from_name"]').value;

    return fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); });
  }

  function notifyAdminDashboard(form, extra) {
    try {
      var payload = collectFormData(form);
      for (var k in extra) { if (extra.hasOwnProperty(k)) payload[k] = extra[k]; }
      if (navigator.sendBeacon) {
        var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(ENROL_SINK, blob);
      } else if (window.fetch) {
        fetch(ENROL_SINK, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload), keepalive: true
        });
      }
    } catch (e) { /* dashboard notification is best-effort, never blocks the parent */ }
  }

  /* Turns the flat getSelectedModules() list into a readable per-child
     summary, e.g. "Child 1: Secret Life of Low Tide (RM70); Aisyah:
     The Sick Sea Shells, Secret Drifters of The Sea (RM180)" — used in
     the WhatsApp pay-later message so the team sees who picked what. */
  function summarizeModulesByChild(modules) {
    var byChild = {};
    var order = [];
    for (var i = 0; i < modules.length; i++) {
      var m = modules[i];
      if (!byChild[m.child]) { byChild[m.child] = { names: [], total: 0 }; order.push(m.child); }
      byChild[m.child].names.push(m.name);
      byChild[m.child].total += m.price;
    }
    var lines = [];
    for (var j = 0; j < order.length; j++) {
      var c = order[j];
      lines.push(c + ': ' + byChild[c].names.join(', ') + ' (RM' + byChild[c].total + ')');
    }
    return lines.join('; ');
  }

  function initEnrolSubmit() {
    var form = document.querySelector('#enrol form');
    if (!form || !window.fetch) return;

    var payNowBtn = document.getElementById('btn-pay-now');
    var payLaterBtn = document.getElementById('btn-pay-later');
    var enrolOnlyBtn = document.getElementById('btn-enrol-only');
    var statusEl = document.getElementById('enrol-status');

    function setStatus(msg, cls) {
      if (!statusEl) return;
      statusEl.textContent = msg || '';
      statusEl.className = 'paystatus' + (cls ? ' ' + cls : '');
    }

    function disableAll(disabled) {
      if (payNowBtn) payNowBtn.disabled = disabled;
      if (payLaterBtn) payLaterBtn.disabled = disabled;
      if (enrolOnlyBtn) enrolOnlyBtn.disabled = disabled;
    }

    function validateCommon() {
      if (!form.reportValidity()) return false;
      var modules = getSelectedModules(form);
      if (modules.length === 0) {
        setStatus('Please select at least one module before continuing.', 'err');
        return false;
      }
      return true;
    }

    if (payNowBtn) {
      payNowBtn.addEventListener('click', function () {
        if (!validateCommon()) return;
        var modules = getSelectedModules(form);
        var totals = computeTotals(form);

        var originalLabel = payNowBtn.textContent;
        disableAll(true);
        payNowBtn.textContent = 'Submitting…';
        setStatus('');

        postWeb3Forms(form)
          .then(function () {
            notifyAdminDashboard(form, {
              'Payment path': 'Pay now',
              'Children enrolling': totals.children,
              'Sibling discount': totals.discount,
              'Modules total': totals.total
            });
            payNowBtn.textContent = 'Redirecting to payment…';
            return fetch(CHECKOUT_ENDPOINT, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                items: modules,
                children: totals.children,
                discount: totals.discount,
                total: totals.total,
                source: 'little-marine-scientists.html',
                child: form.querySelector('[name="Child name"]').value,
                email: form.querySelector('[name="Parent email"]').value
              })
            });
          })
          .then(function (r) {
            if (!r.ok) throw new Error('Checkout request failed (' + r.status + ')');
            return r.json();
          })
          .then(function (data) {
            if (!data || !data.checkout_url) throw new Error('No checkout URL returned');
            window.location.href = data.checkout_url;
          })
          .catch(function () {
            setStatus('We received your enrolment, but could not start payment just now. Please call 011-39822811 to complete payment, or try again in a moment.', 'err');
            disableAll(false);
            payNowBtn.textContent = originalLabel;
          });
      });
    }

    if (payLaterBtn) {
      payLaterBtn.addEventListener('click', function () {
        if (!validateCommon()) return;
        var modules = getSelectedModules(form);
        var totals = computeTotals(form);
        var childName = form.querySelector('[name="Child name"]').value;
        var summaryText = summarizeModulesByChild(modules);

        var originalLabel = payLaterBtn.textContent;
        disableAll(true);
        payLaterBtn.textContent = 'Submitting…';
        setStatus('');

        postWeb3Forms(form)
          .then(function () {
            notifyAdminDashboard(form, {
              'Payment path': 'Pay later via WhatsApp',
              'Children enrolling': totals.children,
              'Sibling discount': totals.discount,
              'Modules total': totals.total
            });

            var msg = 'Hi LMS team, I just enrolled ' + (childName || 'my child') +
              (totals.children >= 2 ? ' and ' + (totals.children - 1) + ' sibling(s)' : '') +
              ' — ' + summaryText + ' (Total: RM ' + totals.total +
              (totals.discount > 0 ? ', after RM' + totals.discount + ' sibling discount' : '') + '). ' +
              'I have a few questions before I complete payment.';
            var waUrl = 'https://wa.me/' + LMS_WHATSAPP_NUMBER + '?text=' + encodeURIComponent(msg);

            setStatus('Enrolment received — opening WhatsApp so you can chat with our team before paying.', 'ok');
            window.open(waUrl, '_blank', 'noopener');
            payLaterBtn.textContent = 'Enrolment sent ✓';
          })
          .catch(function () {
            setStatus('Sorry, something went wrong sending your enrolment. Please try again, or call 011-39822811.', 'err');
            disableAll(false);
            payLaterBtn.textContent = originalLabel;
          });
      });
    }

    if (enrolOnlyBtn) {
      enrolOnlyBtn.addEventListener('click', function () {
        if (!validateCommon()) return;
        var totals = computeTotals(form);

        var originalLabel = enrolOnlyBtn.textContent;
        disableAll(true);
        enrolOnlyBtn.textContent = 'Submitting…';
        setStatus('');

        postWeb3Forms(form)
          .then(function () {
            notifyAdminDashboard(form, {
              'Payment path': 'Enrolled only — no payment yet',
              'Children enrolling': totals.children,
              'Sibling discount': totals.discount,
              'Modules total': totals.total
            });
            setStatus('Enrolment received — our team will contact you about payment before the session.', 'ok');
            enrolOnlyBtn.textContent = 'Enrolment sent ✓';
          })
          .catch(function () {
            setStatus('Sorry, something went wrong sending your enrolment. Please try again, or call 011-39822811.', 'err');
            disableAll(false);
            enrolOnlyBtn.textContent = originalLabel;
          });
      });
    }
  }

  /* Keeps the hidden "email" field in sync with the visible "Parent
     email" field. Web3Forms' Autoresponder (Pro feature — confirms an
     enrolment straight to the parent's inbox) only fires on a field
     literally named "email"; this lets that work without renaming
     "Parent email" and breaking the admin dashboard's existing field
     mapping. Requires enabling Autoresponder on the Web3Forms
     dashboard for this access key — see note in the HTML above the
     hidden field. */
  function initEmailMirror() {
    var source = document.getElementById('p-email');
    var mirror = document.getElementById('p-email-mirror');
    if (!source || !mirror) return;
    source.addEventListener('input', function () { mirror.value = source.value; });
  }

  var CHECKOUT_ENDPOINT = 'https://apps.kalsadermaga.com/api/superapp/site/checkout';

  function boot() {
    initNavHeight();
    initBanner();
    initFeedbackCopy();
    initVideoFacade();
    initLightbox();
    initAutoReveal();
    initReveal();
    initNav();
    initCounters();
    initCarousels();
    initMarquee();
    initMobileNav();
    initModulePricing();
    initEnrolSubmit();
    initEmailMirror();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
