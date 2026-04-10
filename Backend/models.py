"""
models.py
SQLAlchemy ORM models + Pydantic schemas for the Gene Pipeline app.
Database: PostgreSQL (via asyncpg / psycopg2)
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field
from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


# ─────────────────────────────────────────────
#  ORM Models
# ─────────────────────────────────────────────

class AnalysisRecord(Base):
    """Stores every pipeline run – real ClinVar lookups AND novel inputs."""

    __tablename__ = "analysis_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    clinvar_id = Column(String(64), nullable=True, index=True)
    gene_name = Column(String(64), nullable=True)
    condition = Column(String(256), nullable=True)

    # Sequences
    input_dna = Column(Text, nullable=False)
    translated_protein = Column(Text, nullable=False)
    corrected_protein = Column(Text, nullable=False)
    corrected_dna = Column(Text, nullable=False)

    # Risk classification
    risk_level = Column(String(16), nullable=False)   # HIGH / MEDIUM / LOW
    risk_score = Column(Float, nullable=False)

    # XAI metrics (JSON blob)
    xai_metrics = Column(JSON, nullable=True)

    # Structure URLs
    before_structure_url = Column(String(512), nullable=True)
    after_structure_url = Column(String(512), nullable=True)

    # Pipeline metadata
    pipeline_duration_ms = Column(Float, nullable=True)
    is_seeded = Column(Boolean, default=False)         # True = ClinVar known entry

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ClinVarEntry(Base):
    """Reference table – pre-loaded ClinVar test data (20 % test split)."""

    __tablename__ = "clinvar_entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    clinvar_id = Column(String(64), unique=True, nullable=False, index=True)
    gene_name = Column(String(64), nullable=False)
    condition = Column(String(256), nullable=False)
    original_dna = Column(Text, nullable=False)
    original_risk = Column(String(16), nullable=False)
    variant_class = Column(String(64), nullable=True)   # pathogenic / VUS / benign
    chromosome = Column(String(8), nullable=True)
    position = Column(Integer, nullable=True)
    reference_allele = Column(String(16), nullable=True)
    alternate_allele = Column(String(16), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ─────────────────────────────────────────────
#  Pydantic Schemas
# ─────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    """Request body for POST /api/v1/analyze"""

    dna_sequence: Optional[str] = Field(
        None,
        description="Raw DNA string (A/T/C/G). Supply either this OR clinvar_id.",
        example="ATGGATTTATCTGCTCTTCGCGTTGAAGAAGTACAAAATGTCATTAATGCTATGCAGAAAATCTTAGAGT",
    )
    clinvar_id: Optional[str] = Field(
        None,
        description="ClinVar accession, e.g. VCV000000001",
        example="VCV000000001",
    )

    class Config:
        json_schema_extra = {
            "example": {"clinvar_id": "VCV000000001"}
        }


# ── Sub-schemas for the response ──────────────────────────────────────────────

class SpikeInfoSchema(BaseModel):
    position: int
    residue: str
    perplexity: float
    z_score: float


class ESM3Schema(BaseModel):
    perplexity_scores: List[float]
    spikes: List[SpikeInfoSchema]
    mean_perplexity: float
    instability_index: float


class RFDiffusionSchema(BaseModel):
    healed_residues: List[int]
    confidence_per_residue: List[float]
    backbone_rmsd: float
    healing_iterations: int


class ProteinMPNNSchema(BaseModel):
    optimised_protein: str
    sequence_recovery: float
    design_confidence: float
    plddt_scores: List[float]


class XAIMetricsSchema(BaseModel):
    # Doctor metrics
    confidence_score: float
    probability_pathogenic: float
    spike_positions: List[int]
    p_value: float
    corrected_residue_count: int
    model_agreement_score: float
    # Patient / shared metrics
    risk_level: str
    risk_score: float
    healed_percentage: float
    patient_summary: str
    doctor_summary: str
    patient_recommendation: str
    doctor_recommendation: str


class AnalyzeResponse(BaseModel):
    """Full pipeline response returned to the React frontend."""

    record_id: str
    clinvar_id: Optional[str]
    gene_name: Optional[str]
    condition: Optional[str]

    input_dna: str
    translated_protein: str
    corrected_protein: str
    corrected_dna: str

    esm3: ESM3Schema
    rfdiffusion: RFDiffusionSchema
    protein_mpnn: ProteinMPNNSchema
    xai: XAIMetricsSchema

    before_structure_url: str
    after_structure_url: str
    pipeline_duration_ms: float
    is_seeded: bool

    class Config:
        from_attributes = True


class ClinVarListItem(BaseModel):
    clinvar_id: str
    gene_name: str
    condition: str
    original_risk: str

    class Config:
        from_attributes = True


class HealthResponse(BaseModel):
    status: str
    db_connected: bool
    version: str = "1.0.0"
