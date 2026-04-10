"""
simulation_logic.py
Wizard-of-Oz bioinformatics pipeline:
  1. DNA → Protein  (Biopython)
  2. ESM-3 instability scan  (NumPy mock)
  3. RFdiffusion structural healing  (NumPy mock)
  4. ProteinMPNN inverse folding  (NumPy mock)
  5. Protein → Corrected DNA  (Biopython)
"""

from __future__ import annotations

import hashlib
import random
import re
import time
from dataclasses import dataclass, field
from typing import Optional

import numpy as np

try:
    from Bio.Seq import Seq
    BIOPYTHON_AVAILABLE = True
except ImportError:
    BIOPYTHON_AVAILABLE = False


# ─────────────────────────────────────────────
#  Codon tables
# ─────────────────────────────────────────────

CODON_TABLE: dict[str, str] = {
    "TTT": "F", "TTC": "F", "TTA": "L", "TTG": "L",
    "CTT": "L", "CTC": "L", "CTA": "L", "CTG": "L",
    "ATT": "I", "ATC": "I", "ATA": "I", "ATG": "M",
    "GTT": "V", "GTC": "V", "GTA": "V", "GTG": "V",
    "TCT": "S", "TCC": "S", "TCA": "S", "TCG": "S",
    "CCT": "P", "CCC": "P", "CCA": "P", "CCG": "P",
    "ACT": "T", "ACC": "T", "ACA": "T", "ACG": "T",
    "GCT": "A", "GCC": "A", "GCA": "A", "GCG": "A",
    "TAT": "Y", "TAC": "Y", "TAA": "*", "TAG": "*",
    "CAT": "H", "CAC": "H", "CAA": "Q", "CAG": "Q",
    "AAT": "N", "AAC": "N", "AAA": "K", "AAG": "K",
    "GAT": "D", "GAC": "D", "GAA": "E", "GAG": "E",
    "TGT": "C", "TGC": "C", "TGA": "*", "TGG": "W",
    "CGT": "R", "CGC": "R", "CGA": "R", "CGG": "R",
    "AGT": "S", "AGC": "S", "AGA": "R", "AGG": "R",
    "GGT": "G", "GGC": "G", "GGA": "G", "GGG": "G",
}

REVERSE_CODON_TABLE: dict[str, list[str]] = {}
for codon, aa in CODON_TABLE.items():
    if aa != "*":
        REVERSE_CODON_TABLE.setdefault(aa, []).append(codon)

# Preferred codons (human codon optimisation bias)
PREFERRED_CODONS: dict[str, str] = {
    "F": "TTC", "L": "CTG", "I": "ATC", "M": "ATG",
    "V": "GTG", "S": "AGC", "P": "CCC", "T": "ACC",
    "A": "GCC", "Y": "TAC", "H": "CAC", "Q": "CAG",
    "N": "AAC", "K": "AAG", "D": "GAC", "E": "GAG",
    "C": "TGC", "W": "TGG", "R": "AGA", "G": "GGC",
}

# ClinVar seed library – deterministic responses for demo
CLINVAR_SEEDS: dict[str, dict] = {
    "VCV000000001": {
        "gene": "BRCA1",
        "condition": "Hereditary Breast and Ovarian Cancer",
        "original_risk": "HIGH",
    },
    "VCV000000002": {
        "gene": "CFTR",
        "condition": "Cystic Fibrosis",
        "original_risk": "HIGH",
    },
    "VCV000000003": {
        "gene": "APOE",
        "condition": "Alzheimer's Disease Risk",
        "original_risk": "MEDIUM",
    },
    "VCV000000004": {
        "gene": "TP53",
        "condition": "Li–Fraumeni Syndrome",
        "original_risk": "HIGH",
    },
    "VCV000000005": {
        "gene": "HBB",
        "condition": "Sickle Cell Anaemia",
        "original_risk": "MEDIUM",
    },
}

# Sample DNA fragments per ClinVar entry
SAMPLE_DNA: dict[str, str] = {
    "VCV000000001": "ATGGATTTATCTGCTCTTCGCGTTGAAGAAGTACAAAATGTCATTAATGCTATGCAGAAAATCTTAGAGTGTCCCATC",
    "VCV000000002": "ATGCAGAGGCGATTTGGGGAGATGGAGCCTGTACCCAGGAAATGGAATCATTTCCAATGATGATGATGATGATGATG",
    "VCV000000003": "ATGAAAGCGTTTAGTCCAGCGGCCGCGCCGCCACCATGGCGGAGGTGCAGGCGGCCATGTACACGGCGGAGCAGGTG",
    "VCV000000004": "ATGGAGGAGCCGCAGTCAGATCCTAGCGAGCAGCTGAAGCGATGGGCGGCATGAACCGGAGGCCCATCCTCACCATC",
    "VCV000000005": "ATGGTGCACCTGACTCCTGAGGAGAAGTCTGCCGTTACTGCCCTGTGGGGCAAGGTGAACGTGGATGAAGTTGGTGG",
}


# ─────────────────────────────────────────────
#  Data classes
# ─────────────────────────────────────────────

@dataclass
class SpikeInfo:
    position: int
    residue: str
    perplexity: float
    z_score: float


@dataclass
class ESM3Result:
    perplexity_scores: list[float]
    spikes: list[SpikeInfo]
    mean_perplexity: float
    instability_index: float


@dataclass
class RFDiffusionResult:
    healed_residues: list[int]
    confidence_per_residue: list[float]
    backbone_rmsd: float
    healing_iterations: int


@dataclass
class ProteinMPNNResult:
    optimised_protein: str
    sequence_recovery: float
    design_confidence: float
    plddt_scores: list[float]


@dataclass
class XAIMetrics:
    # Doctor view
    confidence_score: float
    probability_pathogenic: float
    spike_positions: list[int]
    p_value: float
    corrected_residue_count: int
    model_agreement_score: float
    # Patient view
    risk_level: str           # HIGH / MEDIUM / LOW
    risk_score: float         # 0-100
    healed_percentage: float
    patient_summary: str
    doctor_summary: str
    patient_recommendation: str
    doctor_recommendation: str


@dataclass
class AnalysisResult:
    input_dna: str
    translated_protein: str
    corrected_protein: str
    corrected_dna: str
    esm3: ESM3Result
    rfdiffusion: RFDiffusionResult
    protein_mpnn: ProteinMPNNResult
    xai: XAIMetrics
    before_structure_url: str
    after_structure_url: str
    pipeline_duration_ms: float
    clinvar_id: Optional[str] = None
    gene_name: Optional[str] = None
    condition: Optional[str] = None


# ─────────────────────────────────────────────
#  Utility helpers
# ─────────────────────────────────────────────

def _seed_from_string(s: str) -> int:
    return int(hashlib.md5(s.encode()).hexdigest(), 16) % (2**31)


def clean_dna(seq: str) -> str:
    return re.sub(r"[^ATCG]", "", seq.upper())


def dna_to_protein(dna: str) -> str:
    """Translate DNA → protein, stopping at first stop codon."""
    if BIOPYTHON_AVAILABLE:
        trimmed = dna[: (len(dna) // 3) * 3]
        protein = str(Seq(trimmed).translate(to_stop=True))
        return protein if protein else "M"

    # Fallback: manual codon table
    protein = []
    for i in range(0, len(dna) - 2, 3):
        codon = dna[i : i + 3]
        aa = CODON_TABLE.get(codon, "X")
        if aa == "*":
            break
        protein.append(aa)
    return "".join(protein) or "M"


def protein_to_dna(protein: str) -> str:
    """Back-translate protein → codon-optimised DNA."""
    codons = []
    for aa in protein:
        codons.append(PREFERRED_CODONS.get(aa, REVERSE_CODON_TABLE.get(aa, ["NNN"])[0]))
    return "".join(codons)


# ─────────────────────────────────────────────
#  Step 2 – ESM-3 instability scan (mock)
# ─────────────────────────────────────────────

def simulate_esm3(protein: str, rng: np.random.Generator) -> ESM3Result:
    n = len(protein)
    base = rng.normal(loc=3.5, scale=0.6, size=n).clip(1.0, 10.0)
    spike_mask = rng.random(n) < 0.12          # ~12 % residues are spiky
    base[spike_mask] += rng.uniform(3.0, 6.0, size=spike_mask.sum())
    base = base.clip(1.0, 15.0)

    mean = float(base.mean())
    std = float(base.std()) or 1.0
    z_scores = (base - mean) / std

    spike_threshold = mean + 1.8 * std
    spikes = [
        SpikeInfo(
            position=i,
            residue=protein[i],
            perplexity=round(float(base[i]), 3),
            z_score=round(float(z_scores[i]), 3),
        )
        for i in range(n)
        if base[i] > spike_threshold
    ]

    instability = float(np.mean([s.perplexity for s in spikes]) if spikes else mean)

    return ESM3Result(
        perplexity_scores=[round(float(v), 3) for v in base],
        spikes=spikes,
        mean_perplexity=round(mean, 4),
        instability_index=round(instability, 4),
    )


# ─────────────────────────────────────────────
#  Step 3 – RFdiffusion structural healing (mock)
# ─────────────────────────────────────────────

def simulate_rfdiffusion(
    protein: str, esm3: ESM3Result, rng: np.random.Generator
) -> RFDiffusionResult:
    n = len(protein)
    spike_positions = {s.position for s in esm3.spikes}

    conf = rng.uniform(0.72, 0.98, size=n)
    for pos in spike_positions:
        conf[pos] = rng.uniform(0.55, 0.75)   # spiky residues start lower

    healed = [p for p in spike_positions if conf[p] > 0.62]
    backbone_rmsd = round(float(rng.uniform(0.4, 1.8)), 3)
    iters = int(rng.integers(8, 25))

    return RFDiffusionResult(
        healed_residues=sorted(healed),
        confidence_per_residue=[round(float(v), 4) for v in conf],
        backbone_rmsd=backbone_rmsd,
        healing_iterations=iters,
    )


# ─────────────────────────────────────────────
#  Step 4 – ProteinMPNN inverse folding (mock)
# ─────────────────────────────────────────────

AMINO_ACIDS = list("ACDEFGHIKLMNPQRSTVWY")


def simulate_protein_mpnn(
    protein: str,
    rfdiffusion: RFDiffusionResult,
    esm3: ESM3Result,
    rng: np.random.Generator,
) -> ProteinMPNNResult:
    n = len(protein)
    optimised = list(protein)
    healed_set = set(rfdiffusion.healed_residues)

    # Substitute residues at healed positions
    for pos in healed_set:
        if pos < n:
            optimised[pos] = rng.choice(AMINO_ACIDS)

    plddt = rng.uniform(0.65, 0.97, size=n)
    for pos in healed_set:
        if pos < n:
            plddt[pos] = min(float(plddt[pos]) + 0.12, 1.0)

    seq_recovery = round(float(rng.uniform(0.82, 0.96)), 4)
    design_conf = round(float(rng.uniform(0.78, 0.97)), 4)

    return ProteinMPNNResult(
        optimised_protein="".join(optimised),
        sequence_recovery=seq_recovery,
        design_confidence=design_conf,
        plddt_scores=[round(float(v), 4) for v in plddt],
    )


# ─────────────────────────────────────────────
#  XAI explainer
# ─────────────────────────────────────────────

def _risk_level(instability: float, n_spikes: int, protein_len: int) -> tuple[str, float]:
    spike_ratio = n_spikes / max(protein_len, 1)
    raw = (instability / 15.0) * 50 + spike_ratio * 50
    score = min(round(raw, 1), 100.0)
    if score >= 60:
        return "HIGH", score
    elif score >= 35:
        return "MEDIUM", score
    return "LOW", score


def build_xai(
    esm3: ESM3Result,
    rfdiffusion: RFDiffusionResult,
    mpnn: ProteinMPNNResult,
    protein_len: int,
    rng: np.random.Generator,
    gene: str = "Unknown Gene",
    condition: str = "Unknown Condition",
) -> XAIMetrics:
    risk_level, risk_score = _risk_level(
        esm3.instability_index, len(esm3.spikes), protein_len
    )

    healed_pct = round(
        len(rfdiffusion.healed_residues) / max(len(esm3.spikes), 1) * 100, 1
    )
    conf = round(float(mpnn.design_confidence), 4)
    prob_path = round(float(rng.uniform(0.55, 0.95) if risk_level == "HIGH" else
                           rng.uniform(0.3, 0.6) if risk_level == "MEDIUM" else
                           rng.uniform(0.05, 0.3)), 4)
    p_val = round(float(rng.uniform(0.001, 0.05)), 5)
    model_agreement = round(float(rng.uniform(0.80, 0.97)), 4)

    # ── Patient language ──────────────────────────────────────────────
    risk_emoji = {"HIGH": "🔴", "MEDIUM": "🔵", "LOW": "🟢"}[risk_level]
    risk_plain = {"HIGH": "high", "MEDIUM": "moderate", "LOW": "low"}[risk_level]

    patient_summary = (
        f"Our AI analysed your {gene} gene sequence associated with {condition}. "
        f"The system detected a {risk_plain} level of concern in the protein structure "
        f"({risk_emoji} Risk Score: {risk_score}/100). "
        f"After applying our AI repair process, {healed_pct}% of the flagged regions "
        f"were successfully stabilised. This is a simulation — always consult your doctor."
    )
    patient_rec = (
        "We recommend discussing these results with a certified genetic counsellor."
        if risk_level in ("HIGH", "MEDIUM")
        else "The sequence appears largely stable. Routine monitoring is advised."
    )

    # ── Doctor language ───────────────────────────────────────────────
    spike_positions = [s.position for s in esm3.spikes]
    doctor_summary = (
        f"ESM-3 perplexity scan of {gene} ({condition}) identified {len(esm3.spikes)} "
        f"high-perplexity residues (mean Δperplexity = {esm3.instability_index:.3f}; "
        f"z-score threshold = 1.8σ) at positions {spike_positions[:8]}{'...' if len(spike_positions) > 8 else ''}. "
        f"RFdiffusion backbone refine (RMSD = {rfdiffusion.backbone_rmsd:.3f} Å, "
        f"{rfdiffusion.healing_iterations} iter) resolved {len(rfdiffusion.healed_residues)} sites. "
        f"ProteinMPNN inverse folding: sequence recovery = {mpnn.sequence_recovery:.2%}, "
        f"design confidence = {mpnn.design_confidence:.2%}. "
        f"Pathogenicity probability = {prob_path:.4f} (p = {p_val:.5f}); "
        f"three-model agreement = {model_agreement:.2%}."
    )
    doctor_rec = (
        "Variant classified as likely pathogenic per ACMG/AMP 2015 criteria. "
        "Cascade genetic testing and clinical correlation advised."
        if risk_level == "HIGH"
        else (
            "Variant of uncertain significance (VUS). Functional studies recommended."
            if risk_level == "MEDIUM"
            else "Likely benign. Standard surveillance interval sufficient."
        )
    )

    return XAIMetrics(
        confidence_score=conf,
        probability_pathogenic=prob_path,
        spike_positions=spike_positions,
        p_value=p_val,
        corrected_residue_count=len(rfdiffusion.healed_residues),
        model_agreement_score=model_agreement,
        risk_level=risk_level,
        risk_score=risk_score,
        healed_percentage=healed_pct,
        patient_summary=patient_summary,
        doctor_summary=doctor_summary,
        patient_recommendation=patient_rec,
        doctor_recommendation=doctor_rec,
    )


# ─────────────────────────────────────────────
#  Structure URL helper (AlphaFold DB)
# ─────────────────────────────────────────────

AF_STRUCTURES: dict[str, str] = {
    "VCV000000001": "https://alphafold.ebi.ac.uk/files/AF-P38398-F1-model_v4.cif",
    "VCV000000002": "https://alphafold.ebi.ac.uk/files/AF-P13569-F1-model_v4.cif",
    "VCV000000003": "https://alphafold.ebi.ac.uk/files/AF-P02649-F1-model_v4.cif",
    "VCV000000004": "https://alphafold.ebi.ac.uk/files/AF-P04637-F1-model_v4.cif",
    "VCV000000005": "https://alphafold.ebi.ac.uk/files/AF-P68871-F1-model_v4.cif",
}

# Fallback public structure for novel inputs
FALLBACK_STRUCTURE = "https://files.rcsb.org/view/1CRN.cif"


def get_structure_urls(clinvar_id: Optional[str]) -> tuple[str, str]:
    base = AF_STRUCTURES.get(clinvar_id or "", FALLBACK_STRUCTURE)
    return base, base   # same URL; viewer colour-codes by b-factor/quality


# ─────────────────────────────────────────────
#  Main pipeline entry point
# ─────────────────────────────────────────────

def run_pipeline(
    dna: str,
    clinvar_id: Optional[str] = None,
) -> AnalysisResult:
    t0 = time.perf_counter()

    seed_str = clinvar_id or dna[:32]
    rng = np.random.default_rng(_seed_from_string(seed_str))

    # Resolve metadata
    meta = CLINVAR_SEEDS.get(clinvar_id or "", {})
    gene = meta.get("gene", "Novel Sequence")
    condition = meta.get("condition", "Unclassified Variant")

    # Use seeded DNA if ClinVar known
    if clinvar_id and clinvar_id in SAMPLE_DNA:
        dna = SAMPLE_DNA[clinvar_id]

    dna = clean_dna(dna)
    if len(dna) < 6:
        dna = "ATGGCCATGGCGCCCAGAACTGAGATCAATAGTACCCGTATTAACGGGTGA"

    # 1. Translate
    protein = dna_to_protein(dna)
    if not protein:
        protein = "MAMAP"

    # 2. ESM-3 scan
    esm3 = simulate_esm3(protein, rng)

    # 3. RFdiffusion healing
    rfdiffusion = simulate_rfdiffusion(protein, esm3, rng)

    # 4. ProteinMPNN optimisation
    mpnn = simulate_protein_mpnn(protein, rfdiffusion, esm3, rng)

    # 5. Back-translate
    corrected_dna = protein_to_dna(mpnn.optimised_protein)

    # 6. XAI
    xai = build_xai(esm3, rfdiffusion, mpnn, len(protein), rng, gene, condition)

    # 7. Structure URLs
    before_url, after_url = get_structure_urls(clinvar_id)

    duration_ms = round((time.perf_counter() - t0) * 1000, 2)

    return AnalysisResult(
        input_dna=dna,
        translated_protein=protein,
        corrected_protein=mpnn.optimised_protein,
        corrected_dna=corrected_dna,
        esm3=esm3,
        rfdiffusion=rfdiffusion,
        protein_mpnn=mpnn,
        xai=xai,
        before_structure_url=before_url,
        after_structure_url=after_url,
        pipeline_duration_ms=duration_ms,
        clinvar_id=clinvar_id,
        gene_name=gene,
        condition=condition,
    )
