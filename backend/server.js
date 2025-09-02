import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { initDb, getProfile, setProfile, setResumeText, addQueue, listQueue, getQueue, updateQueue } from './storage.js';
import { chat, generate } from './ollama.js';
import { SYSTEM_PROFILE_SUMMARY, coverLetterPrompt, qaPrompt, extractJobFactsPrompt } from './prompts.js';
import { parsePdfToText } from './resumeParser.js';
import { makeCoverLetterPdfStream } from './coverLetterPdf.js';
import { matchScorePrompt } from './prompts.js';
import { addAppliedLog, listAppliedLogs } from './storage.js';



dotenv.config();
const PORT = process.env.PORT || 3001;


const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));


const upload = multer({ storage: multer.memoryStorage() });


await initDb();


// helpers
function slug(q){ return String(q||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,''); }
async function mergeAnswersIntoProfile({ answers = {}, faqs = {} }){
const row = await getProfile();
const profile = JSON.parse(row.json);
profile.answers = profile.answers || {};
profile.faqs = profile.faqs || {};
for (const [k,v] of Object.entries(answers)) profile.answers[k] = v;
for (const [q,a] of Object.entries(faqs)) { profile.answers[slug(q)] = a; profile.faqs[q] = a; }
await setProfile(profile);
return profile;
}


// Health
app.get('/api/health', (req, res) => res.json({ ok: true }));


// Profile CRUD
app.get('/api/profile', async (req, res) => {
const row = await getProfile();
res.json({ profile: JSON.parse(row.json), resume_text: row.resume_text || '' });
});
app.put('/api/profile', async (req, res) => {
const { profile } = req.body; if (!profile) return res.status(400).json({ error: 'profile required' });
await setProfile(profile); res.json({ ok: true });
});

// Merge new answers/FAQs into profile JSON
app.post('/api/profile/answers', async (req, res) => {
  try {
    const { answers = {}, faqs = {} } = req.body || {};
    const row = await getProfile();
    const profile = JSON.parse(row.json || '{}');
    profile.answers = { ...(profile.answers || {}), ...answers };
    profile.faqs    = { ...(profile.faqs || {}), ...faqs };
    await setProfile(profile);
    res.json({ ok: true, profile });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// Merge new answers/faqs into profile
app.post('/api/profile/answers', async (req, res) => {
try {
const { answers = {}, faqs = {} } = req.body || {};
const profile = await mergeAnswersIntoProfile({ answers, faqs });
res.json({ ok: true, answers: profile.answers, faqs: profile.faqs });
} catch (e) { res.status(500).json({ error: e.message }); }
});


// Resume upload (PDF or text)
app.post('/api/resume', upload.single('file'), async (req, res) => {
try {
let text = '';
if (req.file) {
const isPdf = /pdf/i.test(req.file.mimetype) || req.file.originalname.toLowerCase().endsWith('.pdf');
text = isPdf ? await parsePdfToText(req.file.buffer) : req.file.buffer.toString('utf8');
} else if (req.body.text) { text = String(req.body.text); }
else { return res.status(400).json({ error: 'Upload a PDF or send {text}' }); }
await setResumeText(text); res.json({ ok: true, chars: text.length });
} catch (e) { res.status(500).json({ error: e.message }); }
});

// Match score (resume/profile vs job)
app.post('/api/match', async (req, res) => {
  try {
    const { job_desc = '' } = req.body || {};
    const row = await getProfile();
    const profile = JSON.parse(row.json);
    const resumeText = row.resume_text || '';
    const prompt = matchScorePrompt({ profile, resumeText, jobDesc: job_desc });
    const response = await generate(prompt, {});
    let parsed = {};
    try { parsed = JSON.parse(response); } catch {}
    res.json({ score: Number(parsed.score) || 0, details: parsed });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Applied logs
app.post('/api/logs/applied', async (req, res) => {
  try {
    const { site, job_url, job_title, company, match_score } = req.body || {};
    if (!site || !job_url) return res.status(400).json({ error: 'site and job_url required' });
    await addAppliedLog({ site, job_url, job_title, company, match_score });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/logs/applied', async (req, res) => {
  const items = await listAppliedLogs(200);
  res.json({ items });
});


app.listen(PORT, () => console.log(`JobApplyX backend on http://localhost:${PORT}`));