// Nexus Chat marketing site — light interactions

(function () {
  'use strict';

  // Footer year
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // Scroll reveal
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('visible'));
  }

  // Copy-to-clipboard for CTA command
  const copyBtn = document.querySelector('.cta-copy');
  if (copyBtn && navigator.clipboard) {
    copyBtn.addEventListener('click', async () => {
      const text = copyBtn.getAttribute('data-copy') || '';
      try {
        await navigator.clipboard.writeText(text);
        const label = copyBtn.querySelector('span');
        const original = label ? label.textContent : '';
        copyBtn.classList.add('copied');
        if (label) label.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          if (label) label.textContent = original;
        }, 1600);
      } catch (_) {
        // silently ignore
      }
    });
  }

  // Subtle parallax on the hero logo (applied to inner wrapper so it
  // doesn't conflict with the CSS float animation on the parent)
  const heroShine = document.querySelector('.hero-logo-shine');
  const heroContainer = document.querySelector('.hero-logo');
  if (heroShine && heroContainer && window.matchMedia('(min-width: 960px)').matches) {
    let raf = 0;
    let targetX = 0, targetY = 0, currX = 0, currY = 0;
    const onMove = (e) => {
      const rect = heroContainer.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      targetX = (e.clientX - cx) / 50;
      targetY = (e.clientY - cy) / 50;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const tick = () => {
      currX += (targetX - currX) * 0.08;
      currY += (targetY - currY) * 0.08;
      heroShine.style.transform = `translate(${currX}px, ${currY}px)`;
      if (Math.abs(targetX - currX) > 0.1 || Math.abs(targetY - currY) > 0.1) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
      }
    };
    window.addEventListener('mousemove', onMove, { passive: true });
  }
})();
