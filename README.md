# JobApplyX
ML powered auto Job apply
Here’s a **ready-to-paste README.md** with structure, explanation, config, and installation for **JobApplyX v1.2**.

---

# JobApplyX v1.2 (Ollama-powered Auto-Apply)

**JobApplyX** is a modular project with a **Chrome/Edge browser extension** and a **Node.js backend** that uses your **local Ollama** model to:

* Scan **LinkedIn**, **Indeed**, and **ZipRecruiter** for target roles
* Detect **Easy/Quick Apply** (skips external redirects)
* Parse job descriptions and **auto-answer screening questions** from your profile + resume
* **Generate tailored cover letters**; when a site requires a document, it **renders a PDF** and downloads it for you to attach
* If a question can’t be answered automatically, it **prompts you inline**, **saves your answer** into your profile JSON, and continues
* If you cancel, it **queues the job** server-side to finish later

> ⚖️ **Use responsibly.** Many job sites disallow automation in their Terms. Keep usage personal, local, and human-paced.
> 🔒 **File uploads:** Browsers block scripted `<input type="file">`. JobApplyX handles cover letters via **generate → PDF → download → prompt to attach**, and recommends keeping a resume already saved in each site account.

---

## Features

* **Sites**: LinkedIn (Easy Apply), Indeed, ZipRecruiter
* **Local LLM (Ollama)**: default `llama3.1:8b-instruct`
* **Auto-fill**: name, contact, eligibility, experience, etc.
* **Q\&A persistence**: new answers are merged into your **profile JSON** (both `answers` and `faqs`)
* **Cover letter PDFs**: rendered on the backend and downloaded for upload-only flows
* **Queue**: if you cancel a prompt, the job is saved to a backend queue for later

---

## Prerequisites

* **Node.js** 18+
* **Chrome** or **Microsoft Edge** (Manifest V3 support)
* **Ollama** installed locally and a model pulled (see below)

**Recommended Ollama models**

* Best balance: `llama3.1:8b-instruct`
* Lighter: `mistral:7b-instruct`, `phi3.5:3.8b-instruct`
* Quantized variants (e.g., `llama3.1:8b-instruct-q4_K_M`) are fine

---

## Project Structure

```
jobapplyx/
├─ README.md
├─ backend/                      # Node/Express API + SQLite + Ollama + PDF gen
│  ├─ package.json
│  ├─ server.js                  # REST API (profile, QA, cover-letter PDF, queue)
│  ├─ ollama.js                  # local Ollama chat/generate helpers
│  ├─ storage.js                 # SQLite persistence (profile + queue)
│  ├─ prompts.js                 # prompts for QA and cover letters
│  ├─ resumeParser.js            # PDF → text
│  ├─ coverLetterPdf.js          # PDFKit rendering
│  ├─ .env.example               # config template
│  └─ README.md
└─ extension/                    # Chrome/Edge extension (Manifest v3)
   ├─ manifest.json
   ├─ background.js
   ├─ popup.html
   ├─ popup.js
   ├─ options.html
   ├─ options.js
   └─ content/
      ├─ overlay.css
      ├─ overlay.js              # inline prompt/notice overlay
      ├─ common.js               # DOM utils
      ├─ formFiller.js           # QA call + fill + PDF flow + persistence
      ├─ runner.js               # site router + loop
      └─ sites/
         ├─ linkedin.js          # Easy Apply
         ├─ indeed.js
         └─ ziprecruiter.js
```

---

## Installation

### 1) Start Ollama

```bash
ollama pull llama3.1:8b-instruct
ollama serve
```

> Tip: If you’re RAM-constrained, pull a quantized variant (e.g., `llama3.1:8b-instruct-q4_K_M`) and update `OLLAMA_MODEL` in `.env`.

### 2) Backend setup

```bash
cd backend
cp .env.example .env
npm i
npm run dev
```

Backend defaults to **[http://localhost:3001](http://localhost:3001)**.

### 3) Load the Extension (Chrome or Edge)

1. Open `chrome://extensions` (or `edge://extensions`)
2. Toggle **Developer mode**
3. Click **Load unpacked** and select the `extension/` folder

### 4) Configure

Open the extension **Options**:

* **Backend URL**: `http://localhost:3001` (or your custom address)
* **Roles**: e.g., `software engineer, frontend developer`
* **Locations**: e.g., `Remote, Los Angeles`
* **Profile JSON**: paste your details (see example below)
* **Resume**: paste text here (or upload PDF via `POST /api/resume`)

> Keep a **resume saved** in your LinkedIn/Indeed/ZipRecruiter accounts for easy selection in their “upload resume” controls.

---

## Configuration

### Backend `.env`

```ini
PORT=3001
OLLAMA_BASE=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b-instruct
```

* `PORT` — API port
* `OLLAMA_BASE` — your local Ollama endpoint
* `OLLAMA_MODEL` — which model to use (match what you `ollama pull`’d)

### Profile JSON (example)

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+1 (555) 123-4567",
  "location": "Los Angeles, CA",
  "roles": ["software engineer", "frontend developer"],
  "locations": ["Remote", "Los Angeles"],
  "skills": ["JavaScript","TypeScript","React","Node","Express","SQL","AWS"],
  "work_history": [
    { "title":"Frontend Engineer", "company":"Acme", "from":"2021-02", "to":"2024-08",
      "bullets":["Built React apps","Led accessibility"] }
  ],
  "answers": {
    "authorized_to_work_us": true,
    "requires_visa": false,
    "years_experience": 5
  },
  "faqs": {
    "Are you authorized to work in the US?": "Yes",
    "Do you require visa sponsorship?": "No"
  }
}
```

**Auto-learning:** when the extension prompts you for a **new** question, your answer is **merged** into the backend profile:

* `faqs["<full question>"] = "your answer"`
* `answers[slug("<full question>")] = "your answer"` (slugged key for easier reuse)

This way, future applications re-use your response automatically.

---

## Usage

1. Navigate to a **LinkedIn**, **Indeed**, or **ZipRecruiter** search page.
2. Click the extension icon → toggle **On**.
3. The runner scans listings and opens an **Easy/Quick Apply** job that matches your roles.
4. It scrapes the description → sends questions to the backend QA endpoint → fills the form.
5. If something’s missing, a small **overlay** asks you once, saves your answer, and proceeds.
6. If the site requires a **cover letter upload**, the backend **generates a tailored letter**, renders a **PDF**, downloads it, and the overlay prompts you to **attach** it before continuing.
7. On success, it navigates back and repeats with human-ish pacing.

---

## API (quick reference)

* `GET /api/health` — ping
* `GET /api/profile` — current profile + resume text
* `PUT /api/profile` — replace profile JSON
* `POST /api/profile/answers` — **merge** new answers (`answers{}` and/or `faqs{}`)
* `POST /api/resume` — upload resume (`multipart/form-data` with `file` **or** JSON `{ text }`)
* `POST /api/qa` — JSON `{ questions:[{question}], job_desc }` → model answers
* `POST /api/cover-letter` — JSON `{ role, company, job_desc }` → letter text
* `POST /api/cover-letter-pdf` — JSON `{ role, company, job_desc }` → **PDF download**
* `GET /api/queue` — list queued items
* `POST /api/queue` — add to queue
* `PUT /api/queue/:id` — update (e.g., mark `answered` with `payload.answers/faqs`)

---

## Troubleshooting

* **No model responses**: verify `ollama serve` and try `curl http://localhost:11434/api/tags`.
* **CORS / 404**: confirm backend at `http://localhost:3001` and extension Options URL.
* **Can’t auto-attach files**: expected. Use the **PDF prompt flow**; attach manually, then Continue.
* **Selectors changed**: update regex-based button finders in `extension/content/sites/*.js`.
* **Slow machine**: switch to a smaller/quantized model in `.env`.
* **Stability**: set `temperature: 0` in `backend/ollama.js` for consistent answers.

---

## Notes & Safeguards

* The project **avoids CAPTCHA bypass** or security circumvention.
* Keep the backend bound to `localhost`. If you expose it, add **auth**.
* Increase random delays in `runner.js` / site modules if you hit rate limits.

---

## Roadmap (suggested)

* Lightweight queue admin page (view/edit/answer queued items)
* Additional sites (Greenhouse/Lever native forms)
* Exportable CSV log of applications

---

**Happy applying!**
