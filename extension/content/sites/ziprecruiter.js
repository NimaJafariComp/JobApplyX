import { $all, click, log, sleep, text } from '../common.js';
import { autoFillGeneric, ensureCoverLetterPdfAndPrompt, persistAnswersToProfile, queueMissing } from '../formFiller.js';


export const ZipRecruiter = {
domainMatch: () => /ziprecruiter\.com/.test(location.host),
isListingPage() { return /jobs|search/i.test(location.pathname); },


async scanAndOpenEasyApply(targetRoles = []) {
const cards = $all('[data-testid*="jobCard"], article');
for (const card of cards) {
const t = text(card).toLowerCase();
const matchesRole = targetRoles.length === 0 || targetRoles.some(r => t.includes(r.toLowerCase()));
const easy = /1[- ]?click apply|quick apply|apply now/i.test(t);
if (matchesRole && easy) {
const link = card.querySelector('a[href*="/jobs/"]') || card.querySelector('a[href]');
if (link) { link.scrollIntoView({ block: 'center' }); await sleep(200); link.click(); await sleep(800); break; }
}
}
},


async applyIfEasy({ backend }) {
const candidates = Array.from(document.querySelectorAll('button, a')).filter(b => /apply/i.test(text(b)));
let applyBtn = candidates.find(b => !/company site|external/i.test(text(b)));
if (!applyBtn) return false; await click(applyBtn); await sleep(600);


const jobDesc = (document.querySelector('[data-testid*="jobDescription"], #jobDescription')?.innerText || '').slice(0, 5000);
const role = (document.querySelector('h1, [data-testid*="jobTitle"]')?.innerText || '').trim();
const company = (document.querySelector('[data-testid*="companyName"], a[href*="/company/"]')?.innerText || '').trim();


const { missing } = await autoFillGeneric({ backend, jobDesc });


if (missing.length && window.JobApplyXOverlay) {
try {
const answers = await window.JobApplyXOverlay.ask(missing);
for (const [label, val] of Object.entries(answers)) {
const el = Array.from(document.querySelectorAll('input,textarea,select')).find(e => (e.getAttribute('aria-label')||'').includes(label));
if (el) { el.focus(); el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
}
await persistAnswersToProfile({ backend, answersMap: answers });
} catch {
await queueMissing({ backend, missing, role, company, jobDesc });
return false;
}
}


await ensureCoverLetterPdfAndPrompt({ backend, role, company, jobDesc });


const submit = Array.from(document.querySelectorAll('button')).find(b => /submit|finish|send/i.test(text(b)) && !b.disabled);
if (submit) { await click(submit); await sleep(1000); return true; }
return false;
}
};