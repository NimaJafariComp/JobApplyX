// NON-MODULE / IIFE
(function () {
  const { sleep } = window.JAX;
  const api = (window.JobApplyX = window.JobApplyX || {});

  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const isVisible = (el) => el && el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden';
  const isSelectPlaceholder = (el) => {
    if (el.tagName.toLowerCase() !== 'select') return false;
    const sel = el.selectedOptions && el.selectedOptions[0];
    const t = norm(sel?.text || '');
    return !t || /select|choose|--/i.test(sel?.text || '');
  };
  const isEmpty = (el) => {
    if (!isVisible(el) || el.disabled || el.readOnly) return false; // treat as already handled
    const tag = el.tagName.toLowerCase();
    const type = (el.type || '').toLowerCase();
    if (['button','submit','reset','search','hidden','file'].includes(type)) return false;
    if (['checkbox','radio'].includes(type)) return !el.checked;
    if (tag === 'select') return isSelectPlaceholder(el);
    return !(el.value || '').trim();
  };
  const labelFor = (el, root) =>
    el.getAttribute('aria-label') ||
    (el.id && (root.querySelector(`label[for="${el.id}"]`)?.innerText || '')) ||
    el.placeholder || '';

  const fillText = (el, val) => {
    el.focus();
    el.value = String(val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const selectByText = (el, val) => {
    if (!el || el.tagName.toLowerCase() !== 'select') return false;
    const want = norm(val);
    const opts = Array.from(el.options);
    let idx = opts.findIndex(o => norm(o.text) === want);
    if (idx < 0) idx = opts.findIndex(o => norm(o.text).includes(want));
    if (idx >= 0) { el.selectedIndex = idx; el.dispatchEvent(new Event('change', { bubbles: true })); return true; }
    return false;
  };

  function profileGuess(label, profile) {
    const L = norm(label);
    if (!profile) return null;
    if (L.includes('email')) return profile.email || null;
    if (L.includes('phone') && !L.includes('code')) return profile.phone || null;
    if (/(first name|given name)/i.test(label)) return (profile.name || '').trim().split(/\s+/)[0] || null;
    if (/(last name|family name|surname)/i.test(label)) {
      const parts = (profile.name || '').trim().split(/\s+/);
      return parts.length > 1 ? parts[parts.length - 1] : null;
    }
    if (/(city|location)/i.test(label)) return profile.location || null;
    if (/authorized to work/i.test(label))
      return profile.answers?.authorized_to_work_us === true ? 'Yes' :
             profile.answers?.authorized_to_work_us === false ? 'No' : null;
    if (/visa|sponsorship/i.test(label))
      return profile.answers?.requires_visa === true ? 'Yes' :
             profile.answers?.requires_visa === false ? 'No' : null;
    if (/years.*experience/i.test(label)) return String(profile.answers?.years_experience || '');
    if (/language/i.test(label)) return 'English';
    if (/country code/i.test(label)) {
      const ph = String(profile.phone || '');
      if (/^\+?1/.test(ph) || /united states|usa|u\.s\./i.test(profile.location || '')) return 'United States (+1)';
    }
    // FAQs (free-form Q→A saved from past prompts)
    const faqs = profile.faqs || {};
    for (const [q, a] of Object.entries(faqs)) {
      if (norm(q) === L) return a;
    }
    return null;
  }

  // persist new Q→A (for auto-fill next time)
  api.persistAnswersToProfile = async function ({ backend, faqsMap = {} }) {
    try {
      await fetch(`${backend}/api/profile/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faqs: faqsMap })
      });
    } catch {}
  };

  // MAIN: only handle *empty* inputs inside the modal; use profile → LLM; prompt only if truly unknown
  api.autoFillGeneric = async function ({ backend, jobDesc = '', root = document }) {
    const scope = root || document;

    // 1) collect ONLY EMPTY inputs inside modal
    const inputs = Array.from(scope.querySelectorAll('input, textarea, select')).filter(isVisible);
    const qs = [];
    const seen = new Set();
    for (const el of inputs) {
      if (!isEmpty(el)) continue;                 // <<< ignore prefilled / disabled / hidden
      const label = labelFor(el, scope);
      if (!label.trim()) continue;
      const key = norm(label);
      if (seen.has(key)) continue;
      seen.add(key);
      const type = el.tagName.toLowerCase() === 'select' ? 'select' : (el.type || 'text');
      qs.push({ el, label, type });
    }
    if (!qs.length) return { missing: [] };

    // 2) get profile once
    let profile = api._profile;
    if (!profile) {
      try {
        const { profile: p } = await fetch(`${backend}/api/profile`).then(r => r.json());
        api._profile = profile = p || {};
      } catch { profile = {}; }
    }

    // 3) pass 1: profile/FAQ fills (no LLM)
    const askLLM = [];
    for (const q of qs) {
      const guess = profileGuess(q.label, profile);
      if (guess != null && String(guess).trim()) {
        if (q.type === 'select') {
          if (!selectByText(q.el, guess)) askLLM.push(q); // couldn't match option; try LLM
        } else {
          fillText(q.el, guess);
        }
      } else {
        askLLM.push(q);
      }
      await sleep(25);
    }
    if (!askLLM.length) return { missing: [] };

    // 4) pass 2: LLM for the still-empty
    let llmAnswers = [];
    try {
      const r = await fetch(`${backend}/api/qa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions: askLLM.map(({ label }) => ({ question: label })),
          job_desc: jobDesc
        })
      });
      const data = await r.json();
      llmAnswers = Array.isArray(data.answers) ? data.answers : [];
    } catch {}

    // 5) apply LLM answers; only prompt for truly unknowns / unmatchable selects
    const needUser = [];
    for (let i = 0; i < askLLM.length; i++) {
      const q = askLLM[i];
      const a = llmAnswers[i] || {};
      const val = (a.needs_user ? '' : a.answer) || '';
      if (val) {
        if (q.type === 'select') {
          if (!selectByText(q.el, val)) needUser.push({ label: q.label, type: q.type });
        } else {
          fillText(q.el, val);
        }
      } else {
        needUser.push({ label: q.label, type: q.type, needs_user: true });
      }
      await sleep(25);
    }

    return { missing: needUser }; // overlay will be asked only for these
  };
})();
