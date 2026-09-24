# LexGuard

LexGuard is an AI-powered legal document intelligence MVP for PromptWars. It turns a contract into a clause map, attention areas, obligations, review checklist and document-grounded Q&A. It is an informational tool, not a replacement for a lawyer.

## Stack

- React + Vite + TypeScript frontend
- FastAPI + PyMuPDF backend
- Google Gemini for structured analysis and Q&A

## Run locally

```powershell
npm install --prefix frontend
Copy-Item backend\.env.example backend\.env
# Add GEMINI_API_KEY to backend\.env for live AI
npm run dev
```

In a second terminal:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
uvicorn backend.main:app --reload --port 8000
```

The frontend is available at `http://localhost:5173`. The interactive demo works without an API key and is the fastest way to explore the product.

## API

- `POST /api/analyze` accepts a PDF or TXT upload (maximum 10 MB).
- `POST /api/ask` accepts `document_text` and `question`.
- `GET /health` provides a deployment health check.

Gemini is called only from the backend; the API key is never sent to the browser. AI prompts require grounded, structured JSON and explicitly instruct the model to identify missing information rather than fabricate it.

## Responsible AI

LexGuard provides informational assistance only and does not provide legal advice. Always consult a qualified legal professional for decisions with legal, financial, employment, housing or other material consequences.
