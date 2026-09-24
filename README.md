# Resume Creator — Resumify Editor + Gemini AI Resume Intelligence

A single React/Vite resume creator combining the resume editor/templates with Gemini-powered structured resume extraction and job-description tailoring.

## Features

- 6 resume templates
- Live preview and editing
- PDF, DOCX, TXT and JSON resume import
- Gemini structured extraction for PDF/DOCX content
- PDF resumes are sent to Gemini as PDFs so document structure is preserved better than plain-text-only parsing
- Every experience bullet and project is preserved as a separate editable field where present
- Gemini JD tailoring with factual guardrails
- PDF export using the selected template
- Styled DOCX export
- JSON export/import
- No personal GitHub badge in the resume templates

## Gemini setup

The app uses the Google Gemini API. Gemini structured outputs are designed for data extraction, and Gemini 2.5 Flash-Lite supports PDF input and structured outputs.

Create `.env` from `.env.example` and set:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_PARSER_MODEL=gemini-2.5-flash-lite
GEMINI_TAILOR_MODEL=gemini-2.5-flash
PORT=8787
```

The API key is only used by the local Node server and is never sent to the browser as a configuration value.

## Run in development

Terminal 1:

```bash
npm install
npm run dev:server
```

Terminal 2:

```bash
npm run dev
```

Open the Vite URL, normally `http://localhost:8080`.

## Production

```bash
npm install
npm run build
npm start
```

Then open `http://localhost:8787`.

## Parsing behavior

Resume import is extraction, not rewriting. The Gemini schema requires personal details, summary, experience, education, projects, skills and custom sections. The prompt explicitly tells Gemini to preserve wording, project descriptions, technologies, bullets, dates and links and to leave missing values empty. The server also validates the returned JSON shape before it reaches the editor.

If Gemini has no available quota or the API key is missing, the UI reports the API error immediately instead of silently falling back after a long wait.

## AI tailoring

JD tailoring is separate from importing. It may rewrite the summary and experience bullets and reorder existing skills for relevance, but it is instructed not to invent qualifications.

Never commit `.env` or an API key.


## Imported/original template behavior

When a PDF or DOCX resume is uploaded, the application stores the original uploaded document as **Original Uploaded Resume** and selects it automatically. The original file is preserved unchanged for reference/download. The parsed content is simultaneously loaded into the editor.

Built-in templates remain available under the template selector. Choosing any built-in template switches the editable preview/export to that template without deleting the original upload. This is intentional: arbitrary PDF/DOCX layouts cannot be losslessly reconstructed as editable HTML from parsed text alone.

Portfolio and LinkedIn in the personal header are rendered as real hyperlinks in the built-in templates and DOCX/PDF exports. The visible labels remain "Portfolio" and "LinkedIn"; the raw URLs do not need to be shown.

## Resume Agent

The editor now uses a general-purpose Resume Agent instead of a fixed JD-only tailoring workflow. In the Resume Agent panel, write natural-language instructions such as:

- `Tailor my resume to this job description. Keep everything factual.`
- `Make this one page and compact.`
- `Change the template to a clean corporate design.`
- `Use the attached resume as a visual reference and make mine look similar.`
- `Rewrite only my summary for this role.`
- `Tailor it to this JD, make it one page, and use the attached reference style.`

The agent returns a complete editable resume, a concise explanation of what it changed, and analysis/gaps when relevant. The original uploaded file remains preserved separately.

### AI providers

- Gemini: preferred when a PDF reference is supplied because the reference PDF can be sent natively for layout/style understanding.
- Groq: primary general text agent.
- Mistral: fallback.

Keep API keys only in `.env`; never put real keys in the source or ZIP.

## Reliability and responsive fixes
- PDF resume import first uses Gemini's native PDF understanding for layout-aware extraction.
- If Gemini is temporarily overloaded (503/429/5xx), the browser extracts PDF text locally and retries through Groq, with Mistral as fallback.
- Text/DOCX parsing uses Groq -> Mistral fallback when Gemini is unavailable.
- The editor workspace is responsive below the desktop split breakpoint and remains usable when the browser is narrowed to roughly half-screen width.

## Vercel deployment

This project supports Vercel with the React/Vite frontend and serverless API routes.

### Production
Deploy the repository to Vercel and add these Environment Variables in the Vercel project settings:

```text
GEMINI_API_KEY
GEMINI_PARSER_MODEL
GROQ_API_KEY
GROQ_MODEL
MISTRAL_API_KEY
MISTRAL_MODEL
```

The browser calls `/api/agent`, `/api/parse-resume`, and `/api/tailor`. Vercel runs those endpoints as serverless functions, so no separate `localhost:8787` server is needed after deployment.

### Local development
For local development, continue using:

```bash
npm run dev
npm run dev:server
```

The local Node server remains available for development only.
