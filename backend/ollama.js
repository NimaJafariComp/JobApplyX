import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();


const OLLAMA_BASE = process.env.OLLAMA_BASE || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b-instruct';


export async function chat(messages, opts = {}) {
const body = { model: MODEL, messages, stream: false, options: { temperature: 0.2, ...(opts.options || {}) } };
const { data } = await axios.post(`${OLLAMA_BASE}/api/chat`, body, { headers: { 'Content-Type': 'application/json' } });
return data.message?.content || data.response || '';
}


export async function generate(prompt, opts = {}) {
const body = { model: MODEL, prompt, stream: false, options: { temperature: 0.2, ...(opts.options || {}) } };
const { data } = await axios.post(`${OLLAMA_BASE}/api/generate`, body, { headers: { 'Content-Type': 'application/json' } });
return data.response || '';
}