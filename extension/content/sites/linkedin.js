import { $all, click, sleep, text } from '../common.js';
import { autoFillGeneric, ensureCoverLetterPdfAndPrompt, persistAnswersToProfile, queueMissing } from '../formFiller.js';


function btn(re){ return Array.from(document.querySelectorAll('button, a[role="button"], a')).filter(e => e.offsetParent !== null && !e.disabled).find(el => re.test(text(el))); }
async function tap(re){ const b = btn(re); if (!b) return false; b.scrollIntoView({block:'center'}); await sleep(200+Math.random()*200); b.click(); await sleep(600+Math.random()*400); return true; }


export const LinkedIn = {
domainMatch: () => /(^|\.)linkedin\.com$/.test(location.hostname) && location.pathname.startsWith('/jobs'),
isListingPage(){ return /\/jobs\/search/.test(location.pathname); },


async scanAndOpenEasyApply(targetRoles=[]){
for (const link of $all('a[href*="/jobs/view/"]')) {
const t = text(link).toLowerCase();
if (targetRoles.length && !targetRoles.some(r => t.includes(r.toLowerCase()))) continue;
link.scrollIntoView({ block: 'center' }); await sleep(150); link.click(); await sleep(1000+Math.random()*400);
const easy = btn(/easy apply/i); if (easy) { easy.click(); await sleep(800); return; }
}
},


async applyIfEasy({ backend }){
if (btn(/apply on company|apply externally/i)) return false;
if (!btn(/easy apply/i)) return false; await tap(/easy apply/i);


for (let step = 0; step < 6; step++) {
const jobDesc = (document.querySelector('#job-details, .jobs-description__container, .show-more-less-html__markup')?.innerText || '').slice(0, 5000);
const role = (document.querySelector('h1.jobs-unified-top-card__job-title')?.innerText || document.querySelector('h1')?.innerText || '').trim();
const company = (document.querySelector('.jobs-unified-top-card__company-name a, .jobs-unified-top-card__subtitle-primarily')?.innerText || '').trim();


const { missing } = await autoFillGeneric({ backend, jobDesc });


if (missing.length && window.JobApplyXOverlay) {
try {
const answers = await window.JobApplyXOverlay.ask(missing);
for (const [label, val] of Object.entries(answers)) {
const el = Array.from(document.querySelectorAll('input, textarea, select')).find(e => {
const lab = e.getAttribute('aria-label') || (e.id && (document.querySelector(`label[for="${e.id}"]`)?.innerText || '')) || '';
return lab.toLowerCase().includes(String(label).toLowerCase());
});
if (el) { el.focus(); el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
}
await persistAnswersToProfile({ backend, answersMap: answers });
} catch {
await queueMissing({ backend, missing, role, company, jobDesc });
return false;
}
}


await ensureCoverLetterPdfAndPrompt({ backend, role, company, jobDesc });


if (await tap(/submit application|submit/i)) { await sleep(1200); return true; }
if (!(await tap(/next|continue|review/i))) break;
await sleep(600+Math.random()*600);
}
return false;
}
};