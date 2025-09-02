(function () {
  const { $all, click, sleep, text, log } = window.JAX;
  const api = window.JobApplyX;

  function btn(re) {
    return Array.from(document.querySelectorAll('button, a[role="button"], a'))
      .filter((e) => e.offsetParent !== null && !e.disabled)
      .find((el) => re.test((el.innerText || el.textContent || '').trim()));
  }
  async function tap(re) {
    const b = btn(re);
    if (!b) return false;
    b.scrollIntoView({ block: "center" });
    await sleep(200 + Math.random() * 200);
    b.click();
    await sleep(600 + Math.random() * 400);
    return true;
  }

  // Use roles/locations from Profile JSON to drive the search bar or navigate directly
  async function ensureSearch({ role, loc }) {
    try {
      const current = new URL(window.location.href);
      if (current.pathname.startsWith('/jobs/search')) {
        const qs = new URLSearchParams(current.search);
        const kw = (qs.get('keywords') || '').toLowerCase();
        if (kw.includes(String(role || '').toLowerCase())) { return true; }
      }
    } catch {}
    const kwInput =
      document.querySelector('input[aria-label*="Search" i]') ||
      document.querySelector('input[placeholder*="title" i]');
    const locInput =
      document.querySelector('input[aria-label*="Location" i]') ||
      document.querySelector('input[placeholder*="city" i]');
    if (kwInput) {
      kwInput.focus(); kwInput.value = role || '';
      kwInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (loc && locInput) {
      locInput.focus(); locInput.value = loc;
      locInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const searchBtn = Array.from(document.querySelectorAll('button, a'))
      .find(el => /search/i.test((el.innerText || el.textContent || '').trim()));
    if (searchBtn) { searchBtn.click(); await sleep(1200 + Math.random() * 400); return true; }
    const params = new URLSearchParams(); if (role) params.set('keywords', role); if (loc) params.set('location', loc);
    window.location.href = `https://www.linkedin.com/jobs/search/?${params.toString()}`;
    return true;
  }

  async function ensureEasyApplyFilter() {
    // Try the "Easy Apply" pill first
    const easyPill = Array.from(document.querySelectorAll('button, a'))
      .find(el => /easy apply/i.test((el.innerText || el.textContent || '')) && (el.getAttribute('aria-pressed') !== 'true'));
    if (easyPill) { easyPill.click(); await sleep(800); return true; }
    // Fallback to All filters modal
    if (await tap(/all filters/i)) {
      await sleep(600);
      const label = Array.from(document.querySelectorAll('label'))
        .find(l => /linked.?in easy apply|easy apply/i.test((l.innerText || l.textContent || '')));
      if (label) { label.click(); await sleep(300); }
      await tap(/show results|apply filters/i);
      await sleep(1000);
      return true;
    }
    return false;
  }

  // NEW: detect LinkedIn's own warning banner/text
  function missingRequired() {
    // Look across common containers and the overall body text
    const containers = [
      '#job-details',
      '.jobs-unified-top-card',
      '.jobs-unified-top-card__content--two-pane',
      '.jobs-apply',
      'section'
    ];
    const textBlob = containers
      .flatMap(sel => Array.from(document.querySelectorAll(sel)))
      .map(el => (el.innerText || el.textContent || '').toLowerCase())
      .join(' ');
    const full = (document.body?.innerText || '').toLowerCase();
    const hay = textBlob || full;
    return /your profile is missing required qualification|missing required qualification|does not meet required/i.test(hay);
  }

  async function getJobContext() {
    const role = (document.querySelector('h1.jobs-unified-top-card__job-title')?.innerText ||
                  document.querySelector('h1')?.innerText || '').trim();
    const company = (document.querySelector('.jobs-unified-top-card__company-name a, .jobs-unified-top-card__subtitle-primarily')?.innerText || '').trim();
    const desc = (document.querySelector('#job-details, .jobs-description__container, .show-more-less-html__markup')?.innerText || '').slice(0, 7000);
    return { role, company, desc };
  }

  const Sites = (window.JobApplyXSites = window.JobApplyXSites || {});
  Sites.LinkedIn = {
    domainMatch: () => /(^|\.)linkedin\.com$/.test(location.hostname) && location.pathname.startsWith('/jobs'),
    isListingPage() { return /\/jobs\/search/.test(location.pathname); },

    // OPEN a job → if it doesn't show LinkedIn's "missing required qualifications", click Easy Apply and start
    async scanAndOpenEasyApply({ profile, backend, visited }) {
      const role = (profile.roles && profile.roles[0]) || '';
      const loc  = (profile.locations && profile.locations[0]) || '';
      if (role) await ensureSearch({ role, loc });
      await ensureEasyApplyFilter();

      const links = $all('a[href*="/jobs/view/"]');
      for (const link of links) {
        const href = link.href || link.getAttribute('href') || '';
        if (!href || visited?.has?.(href)) continue;

        link.scrollIntoView({ block: 'center' });
        await sleep(150 + Math.random()*150);
        link.click();
        await sleep(1100 + Math.random()*300);

        if (missingRequired()) { if (visited) visited.add(href); continue; }

        const easy = btn(/easy apply/i);
        if (easy) {
          easy.click();
          await sleep(800);
          if (visited) visited.add(href);
          return true;
        }
        if (visited) visited.add(href);
      }
      return false;
    },

    // FILL & SUBMIT; no LLM scoring—only skip if LinkedIn itself says you’re missing required quals
    async applyIfEasy({ backend, profile, visited }) {
      if (missingRequired()) return false;
      if (btn(/apply on company|apply externally/i)) return false; // avoid external

      // Open Easy Apply modal if not already open
      if (!btn(/submit application|next|continue|review/i)) {
        const opened = await tap(/easy apply/i);
        if (!opened) return false;
      }

      const { role, company, desc } = await getJobContext();

      // Try up to 6 steps (Next/Continue/Review → Submit)
      for (let step = 0; step < 6; step++) {
        const { missing } = await api.autoFillGeneric({ backend, jobDesc: desc });

        if (missing.length && window.JobApplyXOverlay) {
          try {
            const answers = await window.JobApplyXOverlay.ask(missing);
            // Best-effort map answers back into inputs by label
            for (const [label, val] of Object.entries(answers)) {
              const el = Array.from(document.querySelectorAll('input, textarea, select')).find(e => {
                const lab = e.getAttribute('aria-label') ||
                            (e.id && (document.querySelector(`label[for="${e.id}"]`)?.innerText || '')) || '';
                return lab.toLowerCase().includes(String(label).toLowerCase());
              });
              if (el) {
                el.focus();
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }
            // Persist new Q&A to profile (so future apps autofill)
            await api.persistAnswersToProfile({ backend, answersMap: answers });
          } catch { return false; } // user cancelled → bail silently
        }

        // Submit or go next
        if (await tap(/submit application|submit/i)) {
          // Optional logging; ignore errors if endpoint not present
          try {
            await fetch(`${backend}/api/logs/applied`, {
              method: 'POST',
              headers: {'Content-Type':'application/json'},
              body: JSON.stringify({ site: location.hostname, job_url: location.href, job_title: role, company, match_score: null })
            });
          } catch {}
          await sleep(1200);
          return true;
        }
        if (!(await tap(/next|continue|review/i))) break;
        await sleep(600 + Math.random()*600);
      }
      return false;
    }
  };
})();
