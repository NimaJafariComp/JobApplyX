import pdfParse from 'pdf-parse';
export async function parsePdfToText(buffer) { const data = await pdfParse(buffer); return data.text || ''; }