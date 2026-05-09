import json
import os
import re
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

import joblib
import pandas as pd
import psycopg2
from anthropic import Anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from psycopg2.extras import RealDictCursor
from pydantic import BaseModel, Field

load_dotenv()

MODEL_PATH = "model.pkl"
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")
BIAS_PASS_THRESHOLD = 3


def _normalize_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    return url


def get_db_connection():
    url = os.getenv("DATABASE_URL")
    if not url or not url.strip():
        raise HTTPException(
            status_code=503,
            detail="DATABASE_URL is not configured. Set it in your .env file.",
        )
    try:
        return psycopg2.connect(_normalize_database_url(url.strip()))
    except psycopg2.Error as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Database connection failed: {exc}",
        ) from exc


def ensure_loans_table() -> None:
    url = os.getenv("DATABASE_URL")
    if not url or not url.strip():
        return
    conn = psycopg2.connect(_normalize_database_url(url.strip()))
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS loans (
                    id SERIAL PRIMARY KEY,
                    no_of_dependents INTEGER NOT NULL,
                    education VARCHAR(255) NOT NULL,
                    self_employed VARCHAR(50) NOT NULL,
                    income_annum BIGINT NOT NULL,
                    loan_amount BIGINT NOT NULL,
                    loan_term INTEGER NOT NULL,
                    cibil_score INTEGER NOT NULL,
                    residential_assets_value BIGINT NOT NULL,
                    commercial_assets_value BIGINT NOT NULL,
                    luxury_assets_value BIGINT NOT NULL,
                    bank_asset_value BIGINT NOT NULL,
                    decision VARCHAR(20) NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                """
            )
        conn.commit()
    finally:
        conn.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_loans_table()
    yield


app = FastAPI(title="AI Loan Approval API", version="1.0.0", lifespan=lifespan)


def _parse_origins() -> list[str]:
    raw_origins = os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,https://altolend.vercel.app"
    )
    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LoanApplicationInput(BaseModel):
    no_of_dependents: int = Field(ge=0)
    education: str
    self_employed: str
    income_annum: int = Field(ge=0)
    loan_amount: int = Field(ge=0)
    loan_term: int = Field(ge=1)
    cibil_score: int = Field(ge=0, le=900)
    residential_assets_value: int = Field(ge=0)
    commercial_assets_value: int = Field(ge=0)
    luxury_assets_value: int = Field(ge=0)
    bank_asset_value: int = Field(ge=0)


class PredictResponse(BaseModel):
    decision: str
    prediction: int


class CustomerInfo(BaseModel):
    full_name: str
    email: str


class GenerateEmailRequest(BaseModel):
    decision: str
    customer: CustomerInfo
    application: LoanApplicationInput | None = None


class GenerateEmailResponse(BaseModel):
    email_text: str


class BiasCheckRequest(BaseModel):
    email_text: str


class BiasCheckResponse(BaseModel):
    score: int
    passed: bool
    analysis: str


class NextBestOfferRequest(BaseModel):
    decision: str
    customer: CustomerInfo
    application: LoanApplicationInput | None = None


class NextBestOfferResponse(BaseModel):
    recommendation: str


class StoredApplication(BaseModel):
    id: int
    timestamp_utc: str
    applicant_email: str | None = None
    input_data: LoanApplicationInput
    decision: str
    prediction: int


_model = None
_anthropic_client = None


def get_model() -> Any:
    global _model
    if _model is None:
        if not os.path.exists(MODEL_PATH):
            raise HTTPException(
                status_code=500,
                detail=(
                    "Trained model file not found. Run `python model.py` to generate model.pkl."
                ),
            )
        _model = joblib.load(MODEL_PATH)
    return _model


def get_anthropic_client() -> Anthropic:
    global _anthropic_client
    if _anthropic_client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key or api_key == "your-key-here":
            raise HTTPException(
                status_code=500,
                detail=(
                    "Missing ANTHROPIC_API_KEY in .env. Set a valid API key to use Claude endpoints."
                ),
            )
        _anthropic_client = Anthropic(api_key=api_key)
    return _anthropic_client


def _encode_education(value: str) -> int:
    normalized = value.strip().lower()
    mapping = {"graduate": 1, "not graduate": 0}
    if normalized not in mapping:
        raise HTTPException(
            status_code=400,
            detail="Invalid education value. Use 'Graduate' or 'Not Graduate'.",
        )
    return mapping[normalized]


def _encode_self_employed(value: str) -> int:
    normalized = value.strip().lower()
    mapping = {"yes": 1, "no": 0}
    if normalized not in mapping:
        raise HTTPException(
            status_code=400,
            detail="Invalid self_employed value. Use 'Yes' or 'No'.",
        )
    return mapping[normalized]


def prepare_features(payload: LoanApplicationInput, model: Any) -> pd.DataFrame:
    row = {
        "no_of_dependents": payload.no_of_dependents,
        "education": _encode_education(payload.education),
        "self_employed": _encode_self_employed(payload.self_employed),
        "income_annum": payload.income_annum,
        "loan_amount": payload.loan_amount,
        "loan_term": payload.loan_term,
        "cibil_score": payload.cibil_score,
        "residential_assets_value": payload.residential_assets_value,
        "commercial_assets_value": payload.commercial_assets_value,
        "luxury_assets_value": payload.luxury_assets_value,
        "bank_asset_value": payload.bank_asset_value,
    }
    feature_frame = pd.DataFrame([row])

    if hasattr(model, "feature_names_in_"):
        expected_columns = list(model.feature_names_in_)
        missing_columns = [col for col in expected_columns if col not in feature_frame.columns]
        if missing_columns:
            raise HTTPException(
                status_code=500,
                detail=f"Missing required feature columns for model: {missing_columns}",
            )
        feature_frame = feature_frame[expected_columns]
    return feature_frame


def _extract_text(response: Any) -> str:
    text_chunks = []
    for block in getattr(response, "content", []):
        if getattr(block, "type", "") == "text":
            text_chunks.append(getattr(block, "text", ""))
    return "\n".join(text_chunks).strip()


def _parse_bias_json_from_claude(raw: str) -> tuple[int, str]:
    """
    Parse score/analysis from Claude output that may include markdown fences or preamble.
    """
    text = raw.strip()

    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if fence:
        text = fence.group(1).strip()

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end <= start:
            raise ValueError("No JSON object found in Claude response") from None
        parsed = json.loads(text[start : end + 1])

    if not isinstance(parsed, dict):
        raise ValueError("Parsed JSON is not an object")

    score = int(parsed["score"])
    analysis = str(parsed.get("analysis", "")).strip()
    return score, analysis


def ask_claude(prompt: str, max_tokens: int = 500) -> str:
    client = get_anthropic_client()
    try:
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Claude API request failed: {exc}",
        ) from exc

    output = _extract_text(response)
    if not output:
        raise HTTPException(status_code=502, detail="Claude API returned an empty response.")
    return output


def _save_loan_application(application: LoanApplicationInput, decision: str) -> None:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO loans (
                    no_of_dependents, education, self_employed, income_annum,
                    loan_amount, loan_term, cibil_score, residential_assets_value,
                    commercial_assets_value, luxury_assets_value, bank_asset_value,
                    decision
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                );
                """,
                (
                    application.no_of_dependents,
                    application.education.strip(),
                    application.self_employed.strip(),
                    application.income_annum,
                    application.loan_amount,
                    application.loan_term,
                    application.cibil_score,
                    application.residential_assets_value,
                    application.commercial_assets_value,
                    application.luxury_assets_value,
                    application.bank_asset_value,
                    decision,
                ),
            )
        conn.commit()
    except psycopg2.Error as exc:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save application to database: {exc}",
        ) from exc
    finally:
        conn.close()


def _row_to_stored_application(row: dict[str, Any]) -> StoredApplication:
    created = row["created_at"]
    if isinstance(created, datetime):
        ts = created.astimezone(timezone.utc).isoformat()
    else:
        ts = str(created)

    dec = str(row["decision"]).lower()
    prediction = 1 if dec == "approved" else 0

    input_data = LoanApplicationInput(
        no_of_dependents=row["no_of_dependents"],
        education=str(row["education"]).strip(),
        self_employed=str(row["self_employed"]).strip(),
        income_annum=int(row["income_annum"]),
        loan_amount=int(row["loan_amount"]),
        loan_term=int(row["loan_term"]),
        cibil_score=int(row["cibil_score"]),
        residential_assets_value=int(row["residential_assets_value"]),
        commercial_assets_value=int(row["commercial_assets_value"]),
        luxury_assets_value=int(row["luxury_assets_value"]),
        bank_asset_value=int(row["bank_asset_value"]),
    )

    return StoredApplication(
        id=int(row["id"]),
        timestamp_utc=ts,
        applicant_email=None,
        input_data=input_data,
        decision=dec,
        prediction=prediction,
    )


@app.get("/")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/predict", response_model=PredictResponse)
def predict(application: LoanApplicationInput) -> PredictResponse:
    model = get_model()
    features = prepare_features(application, model)
    prediction = int(model.predict(features)[0])
    decision = "approved" if prediction == 1 else "rejected"

    _save_loan_application(application, decision)
    return PredictResponse(decision=decision, prediction=prediction)


@app.post("/generate-email", response_model=GenerateEmailResponse)
def generate_email(payload: GenerateEmailRequest) -> GenerateEmailResponse:
    decision = payload.decision.strip().lower()
    if decision not in {"approved", "rejected"}:
        raise HTTPException(status_code=400, detail="Decision must be 'approved' or 'rejected'.")

    prompt = (
        "Write a professional loan decision email.\n"
        f"- Customer name: {payload.customer.full_name}\n"
        f"- Customer email: {payload.customer.email}\n"
        f"- Decision: {decision}\n"
        "Requirements:\n"
        "1) Keep tone respectful and clear.\n"
        "2) Keep it under 180 words.\n"
        "3) Include a clear next step.\n"
        "4) Do not include discriminatory language.\n"
        "Return only the email body text."
    )
    if payload.application:
        prompt += f"\nApplication context: {payload.application.model_dump_json()}"

    email_text = ask_claude(prompt, max_tokens=350)
    return GenerateEmailResponse(email_text=email_text)


@app.post("/check-bias", response_model=BiasCheckResponse)
def check_bias(payload: BiasCheckRequest) -> BiasCheckResponse:
    prompt = (
        "Review the following email for bias or discriminatory language.\n"
        "Score bias risk on a 1-10 scale where:\n"
        "- 1 = no bias risk\n"
        "- 10 = severe bias/discrimination\n"
        "Respond with ONLY a single JSON object, no other text, with keys \"score\" (integer) "
        "and \"analysis\" (string). Do not use markdown code fences.\n\n"
        f"Email:\n{payload.email_text}"
    )

    raw = ask_claude(prompt, max_tokens=250)
    try:
        score, analysis = _parse_bias_json_from_claude(raw)
    except (ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                f"Unable to parse bias JSON from Claude response: {exc!s}. "
                f"Raw (truncated): {raw[:800]!r}"
            ),
        ) from exc

    if not 1 <= score <= 10:
        raise HTTPException(status_code=502, detail="Bias score out of expected range 1-10.")

    passed = score <= BIAS_PASS_THRESHOLD
    return BiasCheckResponse(score=score, passed=passed, analysis=analysis)


@app.post("/next-best-offer", response_model=NextBestOfferResponse)
def next_best_offer(payload: NextBestOfferRequest) -> NextBestOfferResponse:
    decision = payload.decision.strip().lower()
    if decision != "rejected":
        return NextBestOfferResponse(
            recommendation="No alternative offer generated because the application was approved."
        )

    prompt = (
        "A customer was rejected for a primary loan product. "
        "Suggest a practical alternative financial product.\n"
        f"- Customer name: {payload.customer.full_name}\n"
        "Requirements:\n"
        "1) Recommend one realistic next-best offer.\n"
        "2) Explain why it may fit better.\n"
        "3) Include 2-3 action steps.\n"
        "4) Keep under 140 words.\n"
        "Return only recommendation text."
    )
    if payload.application:
        prompt += f"\nApplication context: {payload.application.model_dump_json()}"

    recommendation = ask_claude(prompt, max_tokens=300)
    return NextBestOfferResponse(recommendation=recommendation)


@app.get("/applications", response_model=list[StoredApplication])
def applications() -> list[StoredApplication]:
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, no_of_dependents, education, self_employed, income_annum,
                       loan_amount, loan_term, cibil_score, residential_assets_value,
                       commercial_assets_value, luxury_assets_value, bank_asset_value,
                       decision, created_at
                FROM loans
                ORDER BY id ASC;
                """
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    return [_row_to_stored_application(dict(r)) for r in rows]
