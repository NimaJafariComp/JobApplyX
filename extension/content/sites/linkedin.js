// extension/content/sites/linkedin.js
(function () {
  const { $all, click, log, sleep, text } = window.JAX || {};
  const api = window.JobApplyX || {};

  const isVisible = (el) => el && el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden';

  function btnIn(root, re) {
    return Array.from(root.querySelectorAll('button, a[role="button"], a'))
      .filter(isVisible)
      .find(el => re.test((el.innerText || el.textContent || '').trim()));
  }
  async function tapIn(root, re) {
    const b = btnIn(root, re);
    if (!b) return false;
    b.scrollIntoView({ block: 'center' });
    await sleep(160 + Math.random()*220);
    await click(b);
    await sleep(520 + Math.random()*380);
    return true;
  }

  const rightPaneRoot = () =>
    document.querySelector('#job-details')?.closest('[data-test-job-details], .jobs-search__job-details--container') ||
    document.querySelector('.jobs-search__job-details--container') || document;

  const easyApplyModalOpen = () => !!document.querySelector('[role="dialog"]');

  function isAppliedCard(card) {
    const t = (card.innerText || '').toLowerCase();
    if (/\bapplied\b/.test(t)) return true;
    return !!Array.from(card.querySelectorAll('span, div'))
      .find(el => /\bapplied\b/i.test((el.innerText || '').trim()));
  }
  function isAppliedInPane() {
    const t = (rightPaneRoot()?.innerText || '').toLowerCase();
    return /\byou applied\b|\balready applied\b|\bapplication submitted\b/.test(t);
  }
  function missingRequiredInPane() {
    const t = (rightPaneRoot()?.innerText || '').toLowerCase();
    return /your profile is missing required qualification/.test(t) ||
           /missing required qualification/.test(t) ||
           /does not meet required/.test(t) ||
           /you (do|don’t|don't) meet.*required/.test(t) ||
           /missing required skills/.test(t);
  }

  async function ensureSearch({ role, loc }) {
    try {
      const cur = new URL(location.href);
      if (cur.pathname.startsWith('/jobs/search')) {
        const qs = new URLSearchParams(cur.search);
        const kw = (qs.get('keywords')||'').toLowerCase();
        const lc = (qs.get('location')||'').toLowerCase();
        if (kw.includes((role||'').toLowerCase()) && (!loc || lc.includes((loc||'').toLowerCase()))) return true;
      }
    } catch {}
    const params = new URLSearchParams();
    if (role) params.set('keywords', role);
    if (loc)  params.set('location', loc);
    const target = `https://www.linkedin.com/jobs/search/?${params.toString()}`;
    log && log('LinkedIn: navigate to', target);
    location.href = target;
    await sleep(1600);
    return true;
  }

  async function ensureEasyApplyFilter() {
    const pill = Array.from(document.querySelectorAll('button, a'))
      .find(el =>
        /easy apply/i.test((el.innerText || el.textContent || '')) &&
        (el.getAttribute('aria-pressed') !== 'true' && el.getAttribute('aria-checked') !== 'true')
      );
    if (pill) { pill.click(); await sleep(900); return true; }

    if (await tapIn(document, /all filters/i)) {
      await sleep(680);
      const label = Array.from(document.querySelectorAll('label'))
        .find(l => /linked.?in easy apply|easy apply/i.test((l.innerText || l.textContent || '')));
      if (label) { label.click(); await sleep(260); }
      await tapIn(document, /show results|apply filters/i);
      await sleep(1200);
      return true;
    }
    return false;
  }

  function cardsLeftList() {
    const sel = [
      'li.jobs-search-results__list-item',
      '[data-job-id]',
      '.jobs-search__results-list li'
    ].join(',');
    return ($all ? $all(sel) : Array.from(document.querySelectorAll(sel))).filter(isVisible);
  }

  async function selectCardWithoutNavigating(card) {
    card.scrollIntoView({ block: 'center' });
    card.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, view: window }));
    await sleep(100 + Math.random()*140);
    // Click the white container, not the blue title link
    const clickable = card.querySelector('.job-card-container, [data-control-name], .artdeco-entity-lockup') || card;
    clickable.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    // Wait until right pane loads something
    const pane = rightPaneRoot();
    const t0 = Date.now();
    while (Date.now() - t0 < 4000) {
      const title = pane.querySelector('h1, .jobs-unified-top-card__job-title');
      const body  = pane.querySelector('#job-details, .show-more-less-html__markup, .jobs-description__container');
      if ((title && (title.innerText||'').trim()) || (body && (body.innerText||'').trim())) break;
      await sleep(120);
    }
  }

  async function scrollModalToBottom(modal) {
    for (const sc of [modal.querySelector('.artdeco-modal__content'), modal]) {
      if (!sc) continue;
      sc.scrollTop = sc.scrollHeight;
      await sleep(120);
    }
  }
  async function autoCheckAgreements(modal) {
    for (const lab of Array.from(modal.querySelectorAll('label'))) {
      const t = (lab.innerText || lab.textContent || '').toLowerCase();
      if (/(i agree|i consent|i acknowledge|certify|truthful|verify|terms|privacy)/.test(t)) {
        const forId = lab.getAttribute('for');
        const box = forId ? modal.querySelector(`#${CSS.escape(forId)}`) : lab.querySelector('input[type="checkbox"]');
        if (box && !box.checked && !box.disabled && isVisible(box)) { box.click(); await sleep(70); }
      }
    }
  }

  async function closeModalIfOpen() {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return false;
    const b = btnIn(dlg, /done|close|view jobs|return to search|back to search|finish/i) ||
              dlg.querySelector('[aria-label="Dismiss"], .artdeco-modal__dismiss, button[aria-label*="Close"]');
    if (b) { b.click(); await sleep(650); return true; }
    return false;
  }

  // ---- REGISTER on the global Sites registry (non-module) ----
  const Sites = (window.JobApplyXSites = window.JobApplyXSites || {});
  Sites.LinkedIn = {
    domainMatch: () => /(^|\.)linkedin\.com$/.test(location.hostname) && location.pathname.startsWith('/jobs'),
    // listing = no modal open (we stay on search page)
    isListingPage() { return !easyApplyModalOpen(); },

    // SEARCH PAGE FLOW:
    // 1) navigate using role/location → 2) enable Easy Apply →
    // 3) iterate left cards (skip "Applied") → 4) right pane: skip missing-required →
    // 5) click Easy Apply (right pane) to open modal
    async scanAndOpenEasyApply({ profile, visited }) {
      const role = (profile?.roles && profile.roles[0]) || '';
      const loc  = (profile?.locations && profile.locations[0]) || '';
      if (role) await ensureSearch({ role, loc });
      await ensureEasyApplyFilter();

      for (const card of cardsLeftList()) {
        // skip clearly applied cards (left list)
        if (isAppliedCard(card)) continue;

        const jobId = card.getAttribute('data-job-id') || card.dataset?.jobId || text(card)?.slice(0,120);
        if (visited?.has?.(jobId)) continue;

        await selectCardWithoutNavigating(card);

        // right-pane applied?
        if (isAppliedInPane()) { visited && visited.add(jobId); continue; }

        // right-pane missing required?
        if (missingRequiredInPane()) { visited && visited.add(jobId); continue; }

        // open Easy Apply from right pane (avoid external)
        const pane = rightPaneRoot();
        const external = btnIn(pane, /apply on company|apply externally/i);
        const easy = btnIn(pane, /easy apply/i);
        if (!external && easy) {
          await click(easy);
          await sleep(800);
          visited && visited.add(jobId);
          return true; // modal is up → runner will call applyIfEasy next tick
        }

        visited && visited.add(jobId);
      }

      // Load more results for next pass
      window.scrollBy({ top: 700, behavior: 'smooth' });
      await sleep(650);
      return false;
    },

    // MODAL FLOW: modal-only fill → LLM for blanks → prompt if truly unknown → save Q/A → Next/Submit → close modal
    async applyIfEasy({ backend }) {
      if (!easyApplyModalOpen()) return false;
      const modal = document.querySelector('[role="dialog"]') || document;
      const desc  = (document.querySelector('#job-details, .jobs-description__container, .show-more-less-html__markup')?.innerText || '').slice(0, 7000);

      for (let step = 0; step < 8; step++) {
        const { missing } = await (window.JobApplyX?.autoFillGeneric
          ? window.JobApplyX.autoFillGeneric({ backend, jobDesc: desc, root: modal }) // if you switched to the IIFE filler variant
          : (async () => ({ missing: [] }))());

        await autoCheckAgreements(modal);
        await scrollModalToBottom(modal);

        if (missing.length && window.JobApplyXOverlay) {
          try {
            const answers = await window.JobApplyXOverlay.ask(missing);
            for (const [label, val] of Object.entries(answers)) {
              const el = Array.from(modal.querySelectorAll('input, textarea, select')).find(e => {
                const lab = e.getAttribute('aria-label') ||
                            (e.id && (modal.querySelector(`label[for="${e.id}"]`)?.innerText || '')) || '';
                return (lab || '').toLowerCase().includes(String(label).toLowerCase());
              });
              if (el) {
                el.focus(); el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }
            try { await window.JobApplyX?.persistAnswersToProfile?.({ backend, faqsMap: answers }); } catch {}
          } catch { return false; } // user canceled
        }

        const submit = btnIn(modal, /submit application|submit/i);
        if (submit) {
          await click(submit);
          await sleep(1000 + Math.random()*400);
          await closeModalIfOpen(); // stay on search page
          return true;
        }

        const next = btnIn(modal, /(next|continue|review)/i);
        if (next) {
          await click(next);
          await sleep(720 + Math.random()*420);
          continue;
        }

        break; // no controls
      }
      return false;
    }
  };
})();
