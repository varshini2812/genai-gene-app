"""
main.py
FastAPI application – Generative AI for Predictive Gene Pattern Modification.

Endpoints
─────────
GET  /                        Health ping
GET  /api/v1/health           DB + service health
GET  /api/v1/clinvar          List seeded ClinVar entries
POST /api/v1/analyze          Run the simulation pipeline
GET  /api/v1/records          List recent analysis records
GET  /api/v1/records/{id}     Fetch one record by UUID
"""

from __future__ import annotations

import os
import uuid
from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from models import (
    AnalysisRecord,
    AnalyzeRequest,
    AnalyzeResponse,
    Base,
    ClinVarEntry,
    ClinVarListItem,
    HealthResponse,
    XAIMetricsSchema,
)
from simulation_logic import (
    CLINVAR_SEEDS,
    SAMPLE_DNA,
    AnalysisResult,
    run_pipeline,
)

# ─────────────────────────────────────────────
#  Database setup
# ─────────────────────────────────────────────

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:password@localhost:5432/gene_pipeline",
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create tables and seed ClinVar reference data."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        for cid, meta in CLINVAR_SEEDS.items():
            existing = db.query(ClinVarEntry).filter_by(clinvar_id=cid).first()
            if not existing:
                entry = ClinVarEntry(
                    clinvar_id=cid,
                    gene_name=meta["gene"],
                    condition=meta["condition"],
                    original_dna=SAMPLE_DNA.get(cid, "ATGATGATG"),
                    original_risk=meta["original_risk"],
                )
                db.add(entry)
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


# ─────────────────────────────────────────────
#  Application lifespan
# ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        init_db()
        print("✅  Database initialised and seeded.")
    except Exception as exc:
        print(f"⚠️  DB init failed (non-fatal in demo mode): {exc}")
    yield


# ─────────────────────────────────────────────
#  FastAPI app
# ─────────────────────────────────────────────

app = FastAPI(
    title="GenAI Gene Pipeline API",
    description=(
        "Wizard-of-Oz simulation of an ESM-3 → RFdiffusion → ProteinMPNN "
        "gene-repair pipeline, backed by ClinVar reference data."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
#  Helper: pipeline result → response schema
# ─────────────────────────────────────────────

def _result_to_response(result: AnalysisResult, record_id: str, is_seeded: bool) -> dict:
    return {
        "record_id": record_id,
        "clinvar_id": result.clinvar_id,
        "gene_name": result.gene_name,
        "condition": result.condition,
        "input_dna": result.input_dna,
        "translated_protein": result.translated_protein,
        "corrected_protein": result.corrected_protein,
        "corrected_dna": result.corrected_dna,
        "esm3": {
            "perplexity_scores": result.esm3.perplexity_scores,
            "spikes": [
                {
                    "position": s.position,
                    "residue": s.residue,
                    "perplexity": s.perplexity,
                    "z_score": s.z_score,
                }
                for s in result.esm3.spikes
            ],
            "mean_perplexity": result.esm3.mean_perplexity,
            "instability_index": result.esm3.instability_index,
        },
        "rfdiffusion": {
            "healed_residues": result.rfdiffusion.healed_residues,
            "confidence_per_residue": result.rfdiffusion.confidence_per_residue,
            "backbone_rmsd": result.rfdiffusion.backbone_rmsd,
            "healing_iterations": result.rfdiffusion.healing_iterations,
        },
        "protein_mpnn": {
            "optimised_protein": result.protein_mpnn.optimised_protein,
            "sequence_recovery": result.protein_mpnn.sequence_recovery,
            "design_confidence": result.protein_mpnn.design_confidence,
            "plddt_scores": result.protein_mpnn.plddt_scores,
        },
        "xai": {
            "confidence_score": result.xai.confidence_score,
            "probability_pathogenic": result.xai.probability_pathogenic,
            "spike_positions": result.xai.spike_positions,
            "p_value": result.xai.p_value,
            "corrected_residue_count": result.xai.corrected_residue_count,
            "model_agreement_score": result.xai.model_agreement_score,
            "risk_level": result.xai.risk_level,
            "risk_score": result.xai.risk_score,
            "healed_percentage": result.xai.healed_percentage,
            "patient_summary": result.xai.patient_summary,
            "doctor_summary": result.xai.doctor_summary,
            "patient_recommendation": result.xai.patient_recommendation,
            "doctor_recommendation": result.xai.doctor_recommendation,
        },
        "before_structure_url": result.before_structure_url,
        "after_structure_url": result.after_structure_url,
        "pipeline_duration_ms": result.pipeline_duration_ms,
        "is_seeded": is_seeded,
    }


# ─────────────────────────────────────────────
#  Routes
# ─────────────────────────────────────────────

@app.get("/", tags=["Root"])
def root():
    return {"message": "GenAI Gene Pipeline API is running", "docs": "/docs"}


@app.get("/api/v1/health", response_model=HealthResponse, tags=["Health"])
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    return HealthResponse(status="ok", db_connected=db_ok)


@app.get(
    "/api/v1/clinvar",
    response_model=List[ClinVarListItem],
    tags=["ClinVar"],
    summary="List all seeded ClinVar reference entries",
)
def list_clinvar(db: Session = Depends(get_db)):
    try:
        entries = db.query(ClinVarEntry).all()
        if entries:
            return entries
    except Exception:
        pass
    # Fallback: serve from in-memory seeds
    return [
        ClinVarListItem(
            clinvar_id=cid,
            gene_name=meta["gene"],
            condition=meta["condition"],
            original_risk=meta["original_risk"],
        )
        for cid, meta in CLINVAR_SEEDS.items()
    ]


@app.post(
    "/api/v1/analyze",
    response_model=AnalyzeResponse,
    status_code=status.HTTP_200_OK,
    tags=["Pipeline"],
    summary="Run the full simulation pipeline on a DNA sequence or ClinVar ID",
)
def analyze(payload: AnalyzeRequest, db: Session = Depends(get_db)):
    if not payload.dna_sequence and not payload.clinvar_id:
        raise HTTPException(
            status_code=422,
            detail="Provide either dna_sequence or clinvar_id.",
        )

    clinvar_id = payload.clinvar_id
    dna = payload.dna_sequence or ""
    is_seeded = clinvar_id in CLINVAR_SEEDS

    # Run pipeline
    result = run_pipeline(dna=dna, clinvar_id=clinvar_id)

    # Persist to DB (best-effort)
    record_id = str(uuid.uuid4())
    try:
        record = AnalysisRecord(
            id=uuid.UUID(record_id),
            clinvar_id=result.clinvar_id,
            gene_name=result.gene_name,
            condition=result.condition,
            input_dna=result.input_dna,
            translated_protein=result.translated_protein,
            corrected_protein=result.corrected_protein,
            corrected_dna=result.corrected_dna,
            risk_level=result.xai.risk_level,
            risk_score=result.xai.risk_score,
            xai_metrics={
                "confidence_score": result.xai.confidence_score,
                "probability_pathogenic": result.xai.probability_pathogenic,
                "spike_positions": result.xai.spike_positions,
                "p_value": result.xai.p_value,
                "corrected_residue_count": result.xai.corrected_residue_count,
                "model_agreement_score": result.xai.model_agreement_score,
            },
            before_structure_url=result.before_structure_url,
            after_structure_url=result.after_structure_url,
            pipeline_duration_ms=result.pipeline_duration_ms,
            is_seeded=is_seeded,
        )
        db.add(record)
        db.commit()
    except Exception as db_err:
        print(f"DB write skipped: {db_err}")

    return _result_to_response(result, record_id, is_seeded)


@app.get(
    "/api/v1/records",
    tags=["Records"],
    summary="List recent analysis records",
)
def list_records(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    try:
        records = (
            db.query(AnalysisRecord)
            .order_by(AnalysisRecord.created_at.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "record_id": str(r.id),
                "clinvar_id": r.clinvar_id,
                "gene_name": r.gene_name,
                "risk_level": r.risk_level,
                "risk_score": r.risk_score,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in records
        ]
    except Exception:
        return []


@app.get(
    "/api/v1/records/{record_id}",
    tags=["Records"],
    summary="Fetch a single analysis record by UUID",
)
def get_record(record_id: str, db: Session = Depends(get_db)):
    try:
        uid = uuid.UUID(record_id)
        record = db.query(AnalysisRecord).filter(AnalysisRecord.id == uid).first()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format.")
    if not record:
        raise HTTPException(status_code=404, detail="Record not found.")
    return record
