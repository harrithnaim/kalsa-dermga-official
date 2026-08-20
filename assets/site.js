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
        var dr = w.getAttribute('data-drive');
        var btn = w.querySelector('.vplay');
        if (!btn) return;

        // no id filled in yet — hide the play button rather than
        // giving the visitor a control that does nothing
        var unset = function (v) { return !v || v.indexOf('PASTE_') === 0; };
        if (unset(yt) && unset(dr)) { btn.style.display = 'none'; return; }

        function play() {
          if (w.classList.contains('playing')) return;
          var src, allow;
          if (!unset(yt)) {
            src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(yt) +
                  '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
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
        if (!unset(yt)) {
          var note = w.nextElementSibling;
          var out = note && note.querySelector && note.querySelector('a.ytlink');
          if (out) out.setAttribute('href', 'https://www.youtube.com/watch?v=' + encodeURIComponent(yt));
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
