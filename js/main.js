(function () {
  'use strict';

  const header = document.getElementById('header');
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 20);
  });

  navToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', isOpen);
  });

  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  /* Active nav link on scroll */
  const sections = document.querySelectorAll('main section[id]');
  const navAnchors = navLinks.querySelectorAll('a[href^="#"]:not(.btn)');

  function highlightNav() {
    const scrollPos = window.scrollY + 120;
    let current = '';

    sections.forEach((section) => {
      if (section.offsetTop <= scrollPos) {
        current = section.getAttribute('id');
      }
    });

    navAnchors.forEach((link) => {
      const href = link.getAttribute('href').slice(1);
      link.classList.toggle('nav-active', href === current);
    });
  }

  window.addEventListener('scroll', highlightNav, { passive: true });
  highlightNav();
})();
