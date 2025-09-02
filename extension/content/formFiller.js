import { extractQuestions, fillText, selectChoice, log, sleep, text } from './common.js';


export async function autoFillGeneric({ backend, jobDesc = '' }) {
const qs = extractQuestions(document);
const questions = qs.map(q => ({ question: q.label }));
let answers = [];
try {
const r = await fetch(`${backend}/api/qa`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questions, job_desc: jobDesc }) });
const data = await r.json(); answers = data.answers || [];
} catch (e) { log('qa error', e); }


const missing = [];
for (let i = 0; i < qs.length; i++) {
const a = answers[i]; const q = qs[i];
if (!a || a.needs_user || !a.answer) { missing.push({ label: q.label, type: q.type }); continue; }
if (q.type === 'text' || q.type === 'email' || q.type === 'tel' || q.type === 'textarea') fillText(q.el, a.answer);
else selectChoice(q.el, a.answer);
await sleep(60);
}
return { missing };
}


export async function ensureCoverLetterPdfAndPrompt({ backend, role = '', company = '', jobDesc = '' }) {
const fileInputs = Array.from(document.querySelectorAll('input[type="file"]')).filter(i => i.offsetParent !== null);
const match = fileInputs.find(inp => {
const lbl = inp.getAttribute('aria-label') || (inp.id && (document.querySelector(`label[for="${inp.id}"]`)?.innerText || '')) || '';
const near = inp.closest('label,div,section');
const nearText = ((near ? near.innerText : '') + ' ' + lbl).toLowerCase();
return nearText.includes('cover letter');
});
const hasDropZone = Array.from(document.querySelectorAll('*')).some(el => (
el.offsetParent !== null && /cover\s?letter/i.test(text(el)) && /upload|attach|drop|drag/i.test(text(el))
));
if (!match && !hasDropZone) return false;


try {
const r = await fetch(`${backend}/api/cover-letter-pdf`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, company, job_desc: jobDesc }) });
const blob = await r.blob();
const fname = `CoverLetter-${(company||'Company').replace(/[^a-z0-9]+/gi,'_')}-${(role||'Role').replace(/[^a-z0-9]+/gi,'_')}.pdf`;
const url = URL.createObjectURL(blob);
const a = document.createElement('a'); a.href = url; a.download = fname; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 2000);


if (window.JobApplyXOverlay) {
await window.JobApplyXOverlay.notice(`This application requires a <b>cover letter PDF</b> upload. I generated <code>${fname}</code> and downloaded it for you. Please <b>attach that file</b> now, then click <b>Continue</b>.`);
}
return true;
} catch (e) { log('cover-letter pdf error', e); return false; }
}


export async function persistAnswersToProfile({ backend, answersMap = {}, faqsMap = {} }) {
try {
await fetch(`${backend}/api/profile/answers`, {
method: 'POST', headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ answers: {}, faqs: Object.keys(faqsMap).length ? faqsMap : answersMap })
});
} catch (e) { log('persist answers error', e); }
}


export async function queueMissing({ backend, missing = [], role = '', company = '', jobDesc = '' }) {
try {
await fetch(`${backend}/api/queue`, {
method: 'POST', headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ site: location.hostname, job_url: location.href, job_title: role, company, job_desc: jobDesc, missing })
});
} catch (e) { log('queue error', e); }
}