# 🧬 Generative AI for Predictive Gene Pattern Modification

A full-stack **Wizard-of-Oz** bioinformatics simulation that models the complete
ESM-3 → RFdiffusion → ProteinMPNN gene-repair pipeline, backed by ClinVar
reference data and served through a FastAPI + React interface.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         React Frontend                          │
│  App.jsx → InputWizard → Dashboard → XAIToggle + MolStarViewer  │
└───────────────────────────┬─────────────────────────────────────┘
                            │  POST /api/v1/analyze
┌───────────────────────────▼─────────────────────────────────────┐
│                       FastAPI Backend                           │
│  main.py → simulation_logic.py → models.py                      │
│   1. DNA → Protein (Biopython)                                  │
│   2. ESM-3  perplexity scan (NumPy mock)                        │
│   3. RFdiffusion  backbone heal (NumPy mock)                    │
│   4. ProteinMPNN  inverse fold (NumPy mock)                     │
│   5. Protein → Codon-optimised DNA                              │
└───────────────────────────┬─────────────────────────────────────┘
                            │  SQLAlchemy ORM
┌───────────────────────────▼─────────────────────────────────────┐
│                       PostgreSQL                                │
│  analysis_records   clinvar_entries                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
genai-gene-app/
├── backend/
│   ├── main.py               # FastAPI app + all endpoints
│   ├── models.py             # SQLAlchemy ORM + Pydantic schemas
│   ├── simulation_logic.py   # Full pipeline simulation
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.jsx                        # Root + input wizard
│   │   ├── index.js / index.css
│   │   ├── components/
│   │   │   ├── Dashboard.jsx              # Full results dashboard
│   │   │   ├── XAIToggle.jsx              # Patient ↔ Doctor XAI panel
│   │   │   └── MolStarViewer.jsx          # Mol* 3D structure wrapper
│   │   └── hooks/
│   │       └── useApi.js                  # Fetch hooks
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── package.json
│   └── Dockerfile
└── docker-compose.yml
```

---

## Quick Start (Docker — recommended)

```bash
# 1. Clone / place the project
cd genai-gene-app

# 2. Spin up all three services
docker-compose up --build

# 3. Open the app
open http://localhost:3000

# API docs (Swagger)
open http://localhost:8000/docs
```

---

## Manual Setup

### Backend

```bash
cd backend

# 1. Create + activate venv
python3.11 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set environment variable
export DATABASE_URL="postgresql://postgres:password@localhost:5432/gene_pipeline"

# 4. (Optional) Start PostgreSQL via Docker
docker run -d --name gene-pg \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=gene_pipeline \
  -p 5432:5432 \
  postgres:16-alpine

# 5. Start FastAPI (tables auto-created + seeded on first run)
uvicorn main:app --reload --port 8000
```

> **No PostgreSQL?** The app runs fine without a DB — results are returned from
> in-memory simulation; the DB write step is gracefully skipped.

### Frontend

```bash
cd frontend

# 1. Install
npm install

# 2. Configure API base (optional — defaults to localhost:8000)
echo "REACT_APP_API_BASE=http://localhost:8000" > .env

# 3. Start
npm start
# → http://localhost:3000
```

---

## API Reference

| Method | Path                       | Description                                      |
|--------|----------------------------|--------------------------------------------------|
| GET    | `/`                        | Health ping                                      |
| GET    | `/api/v1/health`           | DB connection + service status                   |
| GET    | `/api/v1/clinvar`          | List seeded ClinVar reference entries            |
| POST   | `/api/v1/analyze`          | **Run simulation pipeline** (main endpoint)      |
| GET    | `/api/v1/records`          | List recent analysis records (DB)                |
| GET    | `/api/v1/records/{id}`     | Fetch single record by UUID                      |

### POST `/api/v1/analyze` — Request Body

```json
// Option A — ClinVar accession
{ "clinvar_id": "VCV000000001" }

// Option B — raw DNA
{ "dna_sequence": "ATGGATTTATCTGCT..." }
```

### Response (abbreviated)

```json
{
  "record_id": "3fa85f64-...",
  "gene_name": "BRCA1",
  "condition": "Hereditary Breast and Ovarian Cancer",
  "input_dna": "ATGGATTTATCTGCT...",
  "translated_protein": "MDLSALRVEEV...",
  "corrected_protein": "MDLSALRVEEV...",
  "corrected_dna": "ATGGACCTGTCC...",
  "esm3": {
    "perplexity_scores": [...],
    "spikes": [{ "position": 4, "residue": "E", "perplexity": 9.21, "z_score": 2.45 }],
    "mean_perplexity": 3.72,
    "instability_index": 8.94
  },
  "rfdiffusion": {
    "healed_residues": [4, 11, 18],
    "backbone_rmsd": 1.24,
    "healing_iterations": 14
  },
  "protein_mpnn": {
    "sequence_recovery": 0.9123,
    "design_confidence": 0.8877
  },
  "xai": {
    "risk_level": "HIGH",
    "risk_score": 74.3,
    "confidence_score": 0.8877,
    "probability_pathogenic": 0.8341,
    "p_value": 0.00412,
    "spike_positions": [4, 11, 18, 23],
    "model_agreement_score": 0.9104,
    "patient_summary": "Our AI analysed your BRCA1 gene...",
    "doctor_summary": "ESM-3 perplexity scan of BRCA1...",
    "patient_recommendation": "We recommend discussing...",
    "doctor_recommendation": "Variant classified as likely pathogenic..."
  },
  "before_structure_url": "https://alphafold.ebi.ac.uk/files/AF-P38398-F1-model_v4.cif",
  "after_structure_url":  "https://alphafold.ebi.ac.uk/files/AF-P38398-F1-model_v4.cif",
  "pipeline_duration_ms": 18.4
}
```

---

## Seeded ClinVar Test Data

| ClinVar ID     | Gene   | Condition                        | Risk   |
|----------------|--------|----------------------------------|--------|
| VCV000000001   | BRCA1  | Hereditary Breast & Ovarian Ca.  | HIGH   |
| VCV000000002   | CFTR   | Cystic Fibrosis                  | HIGH   |
| VCV000000003   | APOE   | Alzheimer's Disease Risk         | MEDIUM |
| VCV000000004   | TP53   | Li–Fraumeni Syndrome             | HIGH   |
| VCV000000005   | HBB    | Sickle Cell Anaemia              | MEDIUM |

---

## Frontend Features

| Feature                | Detail                                                      |
|------------------------|-------------------------------------------------------------|
| **3D Mol* Viewer**     | Before/After structures via AlphaFold EBI CIF URLs         |
| **Perplexity Chart**   | Recharts AreaChart with spike threshold reference line      |
| **pLDDT Bar Chart**    | Per-residue confidence, healed residues highlighted green   |
| **XAI Toggle**         | Patient ↔ Clinician persona with distinct language/metrics |
| **Risk Dashboard**     | Dynamic RED / BLUE / GREEN risk styling with score bar      |
| **Sequence Viewer**    | DNA + Protein with spike highlighting                       |
| **PDF Export**         | html2canvas + jsPDF full-page export                        |

---

## Simulated Pipeline Logic

```
DNA input
  │
  ▼  Biopython Seq.translate()
Protein sequence
  │
  ▼  NumPy: Gaussian perplexity per residue + z-score spike detection
ESM-3 result  →  spike positions, instability_index
  │
  ▼  NumPy: residue confidence + backbone RMSD simulation
RFdiffusion result  →  healed_residues, confidence_per_residue
  │
  ▼  NumPy: pLDDT scores, residue substitutions at healed sites
ProteinMPNN result  →  optimised_protein, design_confidence
  │
  ▼  PREFERRED_CODONS table (human codon bias)
Corrected DNA
  │
  ▼  XAI builder  →  patient + doctor explanations, risk classification
JSON response
```

The seed is deterministic (`hashlib.md5(clinvar_id)`) so the same ClinVar ID
always produces the same result — mimicking a real cached inference.

---

## Notes

- **Not for clinical use.** All model outputs are statistically plausible simulations.
- Structure URLs point to real AlphaFold EBI structures for authentic 3D visualisation.
- Mol* viewer loads from CDN; a schematic SVG fallback renders if CDN is unavailable.
- The DB layer is optional — the pipeline runs entirely in-memory without PostgreSQL.
