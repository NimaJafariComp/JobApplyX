import { $all, click, log, sleep, text } from '../common.js';
import { autoFillGeneric, ensureCoverLetterPdfAndPrompt, persistAnswersToProfile, queueMissing } from '../formFiller.js';


export const Indeed = {
domainMatch: () => /indeed\.com/.test(location.host),
isListingPage() { return /jobs/.test(location.pathname); },


async scanAndOpenEasyApply(targetRoles = []) {
const cards = $all('a[id^="job_"], div[data-testid="jobCard"]');
for (const card of cards) {
const t = text(card).toLowerCase();
const matchesRole = targetRoles.length === 0 || targetRoles.some(r => t.includes(r.toLowerCase()));
const easy = /easily apply|quick apply|apply now/i.test(t);
if (matchesRole && easy) {
card.scrollIntoView({ block: 'center' }); await sleep(200);
(card.querySelector('a[href]') || card).click();
await sleep(700); break;
}
}
},


async applyIfEasy({ backend }) {
const btn = document.querySelector('button:where([aria-label*="Apply" i],[id*="apply" i]), a:where([aria-label*="Apply" i])');
if (!btn) return false;
const label = (btn.getAttribute('aria-label') || text(btn)).toLowerCase();
if (/company site|external/i.test(label)) return false;
await click(btn); await sleep(700);


const jobDesc = (document.querySelector('[data-testid="jobDescriptionText"]')?.innerText || '').slice(0, 5000);
const role = (document.querySelector('h1')?.innerText || '').trim();
const company = (document.querySelector('[data-company-name], [data-testid="companyName"]')?.innerText || '').trim();


const { missing } = await autoFillGeneric({ backend, jobDesc });


if (missing.length && window.JobApplyXOverlay) {
try {
const answers = await window.JobApplyXOverlay.ask(missing);
// Fill & persist
for (const [label, val] of Object.entries(answers)) {
const el = Array.from(document.querySelectorAll('input,textarea,select')).find(e => (e.getAttribute('aria-label')||'').includes(label) || (e.id && (document.querySelector(`label[for="${e.id}"]`)?.innerText||'').includes(label)));
if (el) { el.focus(); el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
}
await persistAnswersToProfile({ backend, answersMap: answers });
} catch (e) {
await queueMissing({ backend, missing, role, company, jobDesc });
return false;
}
}


await ensureCoverLetterPdfAndPrompt({ backend, role, company, jobDesc });


const submit = document.querySelector('button:where([type="submit"], [aria-label*="Submit" i]):not([disabled])');
if (submit) { await click(submit); await sleep(1000); return true; }
return false;
}
};