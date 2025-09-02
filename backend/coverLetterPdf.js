import PDFDocument from 'pdfkit';
import { coverLetterPrompt } from './prompts.js';
import { generate } from './ollama.js';
import { getProfile } from './storage.js';


function safe(s){ return String(s||'').replace(/[^a-z0-9]+/gi,'_').replace(/^_+|_+$/g,''); }


export async function makeCoverLetterPdfStream({ role, company, jobDesc }){
const row = await getProfile();
const profile = JSON.parse(row.json);
const resumeText = row.resume_text || '';
const prompt = coverLetterPrompt({ profile, resumeText, role, company, jobDesc });
const letter = (await generate(prompt, {})).trim();


const doc = new PDFDocument({ size: 'LETTER', margin: 54 });
const chunks = [];
doc.on('data', c => chunks.push(c));


doc.fontSize(16).text(profile.name || '');
doc.moveDown(0.2);
const contact = [profile.email, profile.phone, profile.location].filter(Boolean).join(' • ');
if (contact) doc.fontSize(10).fillColor('#444').text(contact);
doc.moveDown(1);


doc.fillColor('#000').fontSize(12).text(letter, { align: 'left' });


doc.end();
await new Promise(r => doc.on('end', r));
const buffer = Buffer.concat(chunks);
const filename = `CoverLetter_${safe(company||'Company')}_${safe(role||'Role')}.pdf`;
return { buffer, filename };
}