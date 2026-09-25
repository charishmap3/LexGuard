import json
import logging
import os
import re
from pathlib import Path
from typing import Any

import fitz
import google.generativeai as genai
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(Path(__file__).with_name(".env"))
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("lexguard")
app = FastAPI(title="LexGuard API", version="0.1.0")
allowed_origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
    "https://lexguard-1u7k.onrender.com",
]
configured_origin = os.getenv("FRONTEND_ORIGIN")
if configured_origin and configured_origin not in allowed_origins:
    allowed_origins.append(configured_origin)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_FILE_SIZE = 10 * 1024 * 1024
MODEL = "gemini-2.5-flash"
ANALYSIS_SCHEMA = {
    "document_type": "string",
    "executive_summary": "string",
    "overall_attention": "Low | Medium | High",
    "key_clauses": [{"title": "string", "category": "string", "importance": "Low | Medium | High", "plain_language": "string", "original_text": "string", "why_it_matters": "string"}],
    "risks": [{"title": "string", "severity": "Low | Medium | High", "description": "string", "source_clause": "string"}],
    "obligations": [{"party": "string", "obligation": "string", "deadline": "string", "consequence": "string"}],
    "important_dates": [{"event": "string", "date": "string", "source": "string"}],
    "termination_conditions": ["string"],
    "renewal_conditions": ["string"],
    "questions_for_lawyer": ["string"],
}
COMPARISON_SCHEMA = {
    "summary": "string",
    "changes": [{"category": "string", "clause": "string", "old_text": "string", "new_text": "string", "change_type": "Added | Removed | Modified", "importance": "Low | Medium | High", "explanation": "string"}],
    "new_risks": ["string"],
    "removed_risks": ["string"],
    "questions_to_review": ["string"],
}


def extract_text(data: bytes, filename: str) -> str:
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Files must be smaller than 10 MB.")
    if filename.lower().endswith(".txt"):
        return normalize_extracted_text(data.decode("utf-8", errors="replace"))
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=415, detail="Only PDF and TXT files are supported.")
    try:
        with fitz.open(stream=data, filetype="pdf") as document:
            return normalize_extracted_text("\n\n".join(page.get_text() for page in document))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Unable to extract text from this document.") from exc


def normalize_extracted_text(text: str) -> str:
    # Some PDFs encode the rupee glyph as an uppercase I. Keep the amount intact.
    return re.sub(r"(?i)(salary(?:\s+of|\s*:\s*)\s*)I(?=\d)", r"\1₹", text)


def extract_monthly_salary(text: str) -> str | None:
    match = re.search(
        r"(?i)(?:gross\s+monthly\s+salary|monthly\s+salary|salary)"
        r"[^\n]{0,100}?(?:₹|INR|I)\s*([\d,]+)",
        text,
    )
    if not match:
        return None
    return f"₹{match.group(1).rstrip(',')}"


def ask_gemini(instruction: str, schema: dict[str, Any] = ANALYSIS_SCHEMA) -> dict[str, Any]:
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        logger.error("Gemini request blocked: GEMINI_API_KEY is missing")
        raise HTTPException(status_code=503, detail="Gemini is not configured. Add GEMINI_API_KEY to backend/.env.")
    logger.info("[GEMINI] request started")
    genai.configure(api_key=key)
    model = genai.GenerativeModel(MODEL)
    prompt = f"""You are LexGuard, an informational legal document analysis assistant. You are not a lawyer.
Use ONLY the supplied document. Never invent facts, clauses, dates, rights, obligations, penalties, or legal conclusions.
If something is absent, write exactly "Not specified in the document." Use neutral plain language and cite source text/sections.
Return valid JSON only, matching this shape:
{json.dumps(schema)}

TASK:
{instruction}"""
    try:
        response = model.generate_content(prompt, generation_config={"response_mime_type": "application/json", "temperature": 0.1})
        logger.info("[GEMINI] response received")
        result = json.loads(response.text)
        logger.info("[GEMINI] JSON parsing successful")
        return result
    except (ValueError, json.JSONDecodeError) as exc:
        logger.exception("Gemini response parsing failed")
        raise HTTPException(status_code=502, detail="The AI returned an invalid analysis. Please try again.") from exc
    except Exception as exc:
        logger.exception("Gemini request failed")
        raise HTTPException(status_code=502, detail="AI analysis failed. Please try again.") from exc


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/analyze")
async def analyze(file: UploadFile = File(...)) -> dict[str, Any]:
    filename = file.filename or ""
    logger.info("[UPLOAD] %s", filename)
    text = extract_text(await file.read(), filename)
    logger.info("[UPLOAD] extracted character count: %d", len(text))
    if len(text.strip()) < 40:
        raise HTTPException(status_code=422, detail="This document does not contain enough text to analyze.")
    return ask_gemini(f"Analyze this legal document and return the requested structured analysis.\n\nDOCUMENT:\n{text[:120000]}")


@app.post("/api/compare")
async def compare(file_a: UploadFile = File(...), file_b: UploadFile = File(...)) -> dict[str, Any]:
    name_a, name_b = file_a.filename or "", file_b.filename or ""
    logger.info("[UPLOAD] comparison documents: %s and %s", name_a, name_b)
    text_a = extract_text(await file_a.read(), name_a)
    text_b = extract_text(await file_b.read(), name_b)
    logger.info("[UPLOAD] extracted character counts: %d and %d", len(text_a), len(text_b))
    if len(text_a.strip()) < 40 or len(text_b.strip()) < 40:
        raise HTTPException(status_code=422, detail="Both documents must contain enough text to compare.")
    result = ask_gemini(f"""Compare these two versions of a legal document. Describe only supported textual changes neutrally.
Preserve every numeric amount exactly as it appears in the supplied documents. Do not reformat, rescale, or infer currency amounts.
Document A (previous version):
{text_a[:90000]}

Document B (new version):
{text_b[:90000]}""", COMPARISON_SCHEMA)
    salary_a = extract_monthly_salary(text_a)
    salary_b = extract_monthly_salary(text_b)
    if salary_a and salary_b:
        for change in result.get("changes", []):
            change_label = f"{change.get('clause', '')} {change.get('category', '')}".lower()
            if "salary" in change_label or "compensation" in change_label:
                change["old_text"] = salary_a
                change["new_text"] = salary_b
                break
    return result


@app.post("/api/ask")
async def ask(file: UploadFile = File(...), question: str = Form(...)) -> dict[str, str]:
    if not question.strip():
        raise HTTPException(status_code=400, detail="Ask a question to continue.")
    filename = file.filename or ""
    logger.info("[Q&A] document received: %s", filename)
    document_text = extract_text(await file.read(), filename)
    logger.info("[Q&A] extracted character count: %d", len(document_text))
    if len(document_text.strip()) < 40:
        raise HTTPException(status_code=422, detail="This document does not contain enough text to answer questions.")
    result = ask_gemini(f"""Answer this question using only the document. Include the source section when possible.
Question: {question}
Document:
{document_text[:120000]}""", {"answer": "string"})
    return {"answer": result.get("answer", "The document does not contain enough information to answer that confidently.")}
