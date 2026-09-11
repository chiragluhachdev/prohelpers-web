/* Pro Helper — public website behaviour. No dependencies. */

(function () {
  'use strict';

  /* ------------------------------------------------------- mobile menu */
  var toggle = document.getElementById('navToggle');
  var links = document.getElementById('navLinks');

  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    // Tapping any link closes the sheet, otherwise it covers the target.
    links.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        links.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ------------------------------------- nav shadow once the page moves */
  var nav = document.getElementById('nav');
  var onScroll = function () {
    if (nav) nav.classList.toggle('is-stuck', window.scrollY > 8);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ------------------------------------------- highlight the current section */
  var navAnchors = Array.prototype.slice.call(document.querySelectorAll('.nav__links a'));
  var sections = navAnchors
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          navAnchors.forEach(function (a) {
            a.classList.toggle('is-active', a.getAttribute('href') === '#' + entry.target.id);
          });
        });
      },
      // Trigger around the upper third so the highlight matches what you're reading.
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
    );
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ------------------------------------------------ reveal on first view */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          obs.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 }
    );
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ----------------------------------------- services list ↔ photo card */
  var list = document.getElementById('serviceList');
  var svcTitle = document.getElementById('svcTitle');
  var svcBody = document.getElementById('svcBody');

  if (list && svcTitle && svcBody) {
    list.addEventListener('click', function (e) {
      var btn = e.target.closest('.service');
      if (!btn) return;
      list.querySelectorAll('.service').forEach(function (b) {
        b.classList.toggle('is-active', b === btn);
      });
      svcTitle.textContent = btn.dataset.title;
      svcBody.textContent = btn.dataset.body;
    });
  }

  /* ---------------------------------------------------------- FAQ accordion */
  var faq = document.getElementById('faq-list');
  if (faq) {
    faq.querySelectorAll('.faq__q').forEach(function (q) {
      var item = q.parentElement;
      var answer = item.querySelector('.faq__a');
      q.setAttribute('aria-expanded', 'false');

      q.addEventListener('click', function () {
        var open = item.classList.contains('is-open');

        // One at a time keeps the section from growing unmanageably long.
        faq.querySelectorAll('.faq__item').forEach(function (other) {
          other.classList.remove('is-open');
          other.querySelector('.faq__a').style.maxHeight = null;
          other.querySelector('.faq__q').setAttribute('aria-expanded', 'false');
        });

        if (!open) {
          item.classList.add('is-open');
          answer.style.maxHeight = answer.scrollHeight + 'px';
          q.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  /* ------------------------------------------------------------- footer year */
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
