(function () {
  'use strict';

  /* ---- Scroll progress bar ---- */
  const progressBar = document.getElementById('scroll-progress');

  function updateProgress() {
    if (!progressBar) return;
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    progressBar.style.width = pct + '%';
  }

  /* ---- Reveal on scroll ---- */
  function initReveal() {
    const reveals = document.querySelectorAll('.reveal');
    if (!reveals.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    reveals.forEach((el) => observer.observe(el));
  }

  /* ---- Parallax ---- */
  function initParallax() {
    const layers = document.querySelectorAll('[data-parallax]');
    if (!layers.length) return;

    let ticking = false;

    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        layers.forEach((layer) => {
          const speed = parseFloat(layer.dataset.parallax) || 0.3;
          layer.style.transform = `translateY(${scrollY * speed}px)`;
        });
        ticking = false;
      });
    }, { passive: true });
  }

  /* ---- Carousels ---- */
  function initCarousels() {
    document.querySelectorAll('[data-carousel]').forEach((root) => {
      const track = root.querySelector('.carousel-track');
      const slides = [...root.querySelectorAll('.carousel-slide')];
      const prevBtn = root.querySelector('.carousel-prev');
      const nextBtn = root.querySelector('.carousel-next');
      const dotsContainer = root.querySelector('.carousel-dots');
      const autoplayMs = parseInt(root.dataset.autoplay, 10);

      if (!track || slides.length === 0) return;

      let index = 0;
      let autoplayTimer = null;

      function getSlidesPerView() {
        if (root.classList.contains('products-carousel')) {
          return window.innerWidth <= 600 ? 1 : window.innerWidth <= 900 ? 2 : 3;
        }
        if (root.classList.contains('pricing-carousel')) {
          return window.innerWidth <= 900 ? 1 : 2;
        }
        return 1;
      }

      function updateSlideWidth() {
        const perView = getSlidesPerView();
        slides.forEach((slide) => {
          slide.style.flex = `0 0 ${100 / perView}%`;
        });
      }

      function goTo(i) {
        const viewport = root.querySelector('.carousel-viewport');
        const perView = getSlidesPerView();
        const maxIndex = Math.max(0, slides.length - perView);
        index = Math.max(0, Math.min(i, maxIndex));
        const slideW = viewport.clientWidth / perView;
        track.style.transform = `translateX(-${index * slideW}px)`;
        updateDots();
      }

      function updateDots() {
        if (!dotsContainer) return;
        dotsContainer.querySelectorAll('.carousel-dot').forEach((dot, i) => {
          dot.classList.toggle('active', i === index);
        });
      }

      function buildDots() {
        if (!dotsContainer) return;
        dotsContainer.innerHTML = '';
        const perView = getSlidesPerView();
        const dotCount = root.classList.contains('carousel-banner') || root.classList.contains('testimonial-carousel') || root.classList.contains('hero-carousel')
          ? slides.length
          : Math.max(1, slides.length - perView + 1);

        for (let i = 0; i < dotCount; i++) {
          const dot = document.createElement('button');
          dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
          dot.setAttribute('aria-label', `Ir a slide ${i + 1}`);
          dot.addEventListener('click', () => {
            goTo(i);
            resetAutoplay();
          });
          dotsContainer.appendChild(dot);
        }
      }

      function next() {
        const perView = getSlidesPerView();
        const maxIndex = Math.max(0, slides.length - perView);
        goTo(index >= maxIndex ? 0 : index + 1);
      }

      function prev() {
        const perView = getSlidesPerView();
        const maxIndex = Math.max(0, slides.length - perView);
        goTo(index <= 0 ? maxIndex : index - 1);
      }

      function startAutoplay() {
        if (!autoplayMs) return;
        stopAutoplay();
        autoplayTimer = setInterval(next, autoplayMs);
      }

      function stopAutoplay() {
        if (autoplayTimer) clearInterval(autoplayTimer);
      }

      function resetAutoplay() {
        stopAutoplay();
        startAutoplay();
      }

      if (prevBtn) prevBtn.addEventListener('click', () => { prev(); resetAutoplay(); });
      if (nextBtn) nextBtn.addEventListener('click', () => { next(); resetAutoplay(); });

      root.addEventListener('mouseenter', stopAutoplay);
      root.addEventListener('mouseleave', startAutoplay);

      /* Touch swipe */
      let touchStartX = 0;
      root.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });

      root.addEventListener('touchend', (e) => {
        const diff = touchStartX - e.changedTouches[0].screenX;
        if (Math.abs(diff) > 50) {
          diff > 0 ? next() : prev();
          resetAutoplay();
        }
      }, { passive: true });

      updateSlideWidth();
      buildDots();

      window.addEventListener('resize', () => {
        updateSlideWidth();
        buildDots();
        goTo(Math.min(index, Math.max(0, slides.length - getSlidesPerView())));
      });

      startAutoplay();
    });
  }

  /* ---- Smooth init ---- */
  function init() {
    updateProgress();
    initReveal();
    initParallax();
    initCarousels();

    window.addEventListener('scroll', updateProgress, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
