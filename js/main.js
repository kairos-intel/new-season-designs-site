/* New Season Design — scroll engine
   Measured behavior being replicated:
   - hero pinned; house -0.5x, copy +0.1x, sky/smoke 0x, page 1x overlay
   - spring-smoothed scroll value so layers trail the wheel slightly */

(() => {
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- smoothed scroll value ---------- */
  let target = window.scrollY;
  let smooth = target;
  addEventListener('scroll', () => { target = window.scrollY; }, { passive: true });

  /* ---------- hero parallax ---------- */
  const house = document.querySelector('.hero-house');
  const copy = document.querySelector('.hero-copy');
  const hero = document.querySelector('.hero');

  /* ---------- hero load-in ----------
     fires on DOMContentLoaded (not load) so the headline never waits behind fonts
     or media before it fades in; a safety timer guarantees it ends visible even if
     the animation is interrupted */
  let copyEntered = false;
  const revealCopy = () => {
    if (copyEntered) return;
    const anim = copy.animate(
      [{ opacity: 0, filter: 'blur(14px)', transform: 'translateX(-50%) translateY(14px)' },
       { opacity: 1, filter: 'blur(0px)', transform: 'translateX(-50%) translateY(0)' }],
      { duration: 1400, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards', delay: 250 }
    );
    /* release the WAAPI fill so the scroll parallax can drive the copy again */
    anim.onfinish = () => { copy.style.opacity = '1'; anim.cancel(); copyEntered = true; };
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', revealCopy);
  else revealCopy();
  setTimeout(() => { if (!copyEntered) { copy.style.opacity = '1'; copyEntered = true; } }, 2500);

  /* ---------- keep the roofline below the copy ----------
     the house rests at 76vh, which collides with the CTAs whenever the headline
     wraps to an extra line (narrow viewports, long headlines, a fallback font
     with wider metrics). measure the copy block and push the house down when it
     would overlap; 76vh stays the floor so the reference framing is unchanged
     whenever there is already room. measured untransformed: the parallax
     translateY and the load-in scale would otherwise skew the reading. */
  const HOUSE_REST_VH = 0.76;
  const HOUSE_GAP = 24;
  const placeHouse = () => {
    const prevCopy = copy.style.transform;
    const prevHouse = house.style.transform;
    copy.style.transform = 'translateX(-50%)';
    house.style.transform = 'translateX(-50%)';
    const copyBottom = copy.getBoundingClientRect().bottom + window.scrollY;
    copy.style.transform = prevCopy;
    house.style.transform = prevHouse;
    const top = Math.max(innerHeight * HOUSE_REST_VH, copyBottom + HOUSE_GAP);
    house.style.setProperty('--house-top', `${Math.round(top)}px`);
  };
  placeHouse();
  addEventListener('resize', placeHouse);
  addEventListener('orientationchange', placeHouse);
  /* fonts change the headline's wrap point, so re-measure once they land */
  if (document.fonts?.ready) document.fonts.ready.then(placeHouse);

  /* ---------- sticky video zoom + marquee ----------
     measured on reference: card scales 1 -> cover-viewport*1.09 linearly with
     section progress; ticker drifts left at a constant 80px/s behind the card;
     video plays continuously (not scroll-scrubbed) */
  const stickySection = document.querySelector('.sticky-video-section');
  const videoCard = document.getElementById('video-card');
  const tickerTrack = document.getElementById('ticker-track');
  const TICKER_PHRASES = ["Owner's Rep", 'One Point of Contact', 'Clear Approvals'];
  const TICKER_SPEED = 80; // px/s
  const TICKER_GAP = 30;   // must match css gap
  let tickerW = 0, tickerX = 0, endScale = 4.1, lastT = 0;

  const addTickerSet = () => TICKER_PHRASES.forEach(t => {
    const s = document.createElement('span'); s.textContent = t;
    const d = document.createElement('i'); d.className = 'ticker-dot';
    tickerTrack.append(s, d);
  });
  function buildTicker() {
    tickerTrack.innerHTML = '';
    addTickerSet();
    tickerW = tickerTrack.scrollWidth + TICKER_GAP; // one set incl. trailing gap
    const sets = Math.ceil((innerWidth + tickerW) / tickerW);
    for (let i = 1; i <= sets; i++) addTickerSet();
  }
  function calcEndScale() {
    endScale = Math.max(innerWidth / videoCard.offsetWidth, innerHeight / videoCard.offsetHeight) * 1.09;
  }
  buildTicker(); calcEndScale();
  addEventListener('load', () => { buildTicker(); calcEndScale(); });
  let rsT; addEventListener('resize', () => { clearTimeout(rsT); rsT = setTimeout(() => { buildTicker(); calcEndScale(); }, 150); });

  /* ---------- main loop ---------- */
  function frame(now) {
    const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0;
    lastT = now;
    smooth = lerp(smooth, target, 0.12);
    const s = smooth;

    // hero layers (only while hero zone is on screen)
    if (target < 1650) {
      house.style.transform = `translateX(-50%) translateY(${-(s * 0.5)}px)`;
      // copy: +0.1x drift down, scale 1->0.885 and fade 1->0.767 over first 600px (ease-out) — measured on reference
      const pr = Math.min(s / 600, 1);
      const p = 1 - (1 - pr) * (1 - pr);
      copy.style.transform = `translateX(-50%) translateY(${s * 0.1}px) scale(${1 - 0.115 * p})`;
      if (copyEntered) copy.style.opacity = 1 - 0.233 * p;
      hero.style.visibility = 'visible';
    } else {
      hero.style.visibility = 'hidden';
    }
    // sky + clouds stay viewport-fixed (measured on reference: only house/copy/page move)

    // sticky video: card scale linear with progress 0..1 across its 250vh
    const r = stickySection.getBoundingClientRect();
    if (r.bottom > 0 && r.top < innerHeight) {
      const total = r.height - innerHeight;
      const p = Math.min(1, Math.max(0, -r.top / total));
      videoCard.style.transform = `scale(${1 + (endScale - 1) * p})`;
      if (tickerW) {
        tickerX -= TICKER_SPEED * dt;
        if (tickerX <= -tickerW) tickerX += tickerW;
        tickerTrack.style.transform = `translateX(${tickerX}px)`;
      }
    }

    // manifesto word reveal: scrub across viewport travel
    if (words.length) {
      const mr = manifesto.getBoundingClientRect();
      const mp = Math.min(1, Math.max(0, (innerHeight * 0.8 - mr.top) / (innerHeight * 0.9)));
      const onCount = Math.floor(mp * words.length);
      words.forEach((w, i) => w.classList.toggle('on', i < onCount));
    }

    requestAnimationFrame(frame);
  }

  /* ---------- manifesto split into words ---------- */
  const manifesto = document.getElementById('manifesto-text');
  let words = [];
  if (manifesto) {
    const text = manifesto.textContent.trim().split(/\s+/);
    manifesto.innerHTML = text.map(w => `<span class="w">${w}</span>`).join(' ');
    words = [...manifesto.querySelectorAll('.w')];
  }

  requestAnimationFrame(frame);

  /* ---------- reveal on scroll ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.25 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  /* ---------- count-up stats ---------- */
  const cio = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      cio.unobserve(e.target);
      if (e.target.dataset.count === undefined) return; /* static stats (e.g. 1, 2) don't animate */
      const end = +e.target.dataset.count;
      const suffix = e.target.dataset.suffix || '';
      const t0 = performance.now();
      const dur = 1400;
      (function tick(now) {
        const p = Math.min(1, (now - t0) / dur);
        e.target.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
    });
  }, { threshold: 0.6 });
  document.querySelectorAll('.stat-num').forEach(el => cio.observe(el));

  /* ---------- lazy-start the walkthrough video only when it nears view ---------- */
  const vid = document.getElementById('showcase-video');
  if (vid) {
    const vio = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { vid.preload = 'auto'; vid.play?.().catch(() => {}); }
        else { vid.pause?.(); }
      });
    }, { rootMargin: '100% 0px' });
    vio.observe(vid);
  }

  /* ---------- before/after sliders (drag / tap, mouse + touch) ---------- */
  document.querySelectorAll('[data-ba]').forEach(slider => {
    let dragging = false;
    const setPos = clientX => {
      const r = slider.getBoundingClientRect();
      let pct = ((clientX - r.left) / r.width) * 100;
      pct = Math.max(0, Math.min(100, pct));
      slider.style.setProperty('--pos', pct + '%');
    };
    slider.addEventListener('pointerdown', e => {
      dragging = true;
      slider.setPointerCapture?.(e.pointerId);
      setPos(e.clientX);
    });
    slider.addEventListener('pointermove', e => { if (dragging) setPos(e.clientX); });
    const end = () => { dragging = false; };
    slider.addEventListener('pointerup', end);
    slider.addEventListener('pointercancel', end);
  });

  /* ---------- FAQ accordion (one open) ---------- */
  const items = [...document.querySelectorAll('.acc-item')];
  const setH = it => {
    const a = it.querySelector('.acc-a');
    a.style.maxHeight = it.classList.contains('open') ? a.scrollHeight + 'px' : '0px';
  };
  items.forEach(it => {
    setH(it);
    it.querySelector('.acc-q').addEventListener('click', () => {
      items.forEach(o => { o.classList.toggle('open', o === it && !it.classList.contains('open')); setH(o); });
    });
  });

  /* ---------- year ---------- */
  document.getElementById('year').textContent = new Date().getFullYear();
})();
