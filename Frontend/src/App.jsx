/**
 * App.jsx
 * Generative AI for Predictive Gene Pattern Modification
 * ─────────────────────────────────────────────────────
 * Aesthetic: Biopunk CLI — deep charcoal canvas, phosphor-green terminals,
 * monospace DNA typography, neon accents, scanline atmosphere.
 */

import React, { useEffect, useState } from 'react';
import { Dna, FlaskConical, Loader2, AlertCircle, ChevronRight, RotateCcw } from 'lucide-react';
import Dashboard from './components/Dashboard';
import { useAnalyze, useClinVarList } from './hooks/useApi';

/* ── Global font import (injected once) ───────────────────────────────────── */
const fontLink = document.createElement('link');
fontLink.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Space+Grotesk:wght@500;700&family=DM+Sans:wght@400;500&display=swap';
fontLink.rel  = 'stylesheet';
document.head.appendChild(fontLink);

/* ── Scanline / grid background CSS injected once ───────────────────────── */
const styleTag = document.createElement('style');
styleTag.textContent = `
  body { background: #030712; margin: 0; font-family: 'DM Sans', sans-serif; }
  .bg-grid {
    background-image:
      linear-gradient(rgba(34,197,94,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(34,197,94,0.03) 1px, transparent 1px);
    background-size: 40px 40px;
  }
  .scanline::after {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0,0,0,0.05) 2px,
      rgba(0,0,0,0.05) 4px
    );
    pointer-events: none;
  }
  .glow-green { text-shadow: 0 0 14px rgba(34,197,94,0.6); }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
  .cursor::after { content:'█'; animation: blink 1.1s step-end infinite; }
  @keyframes fadeUp {
    from { opacity:0; transform:translateY(16px) }
    to   { opacity:1; transform:translateY(0)    }
  }
  .fade-up { animation: fadeUp 0.5s ease both; }
  .fade-up-2 { animation: fadeUp 0.5s 0.1s ease both; }
  .fade-up-3 { animation: fadeUp 0.5s 0.2s ease both; }
`;
document.head.appendChild(styleTag);

/* ── Demo ClinVar entries (fallback if API unreachable) ──────────────────── */
const DEMO_CLINVAR = [
  { clinvar_id: 'VCV000000001', gene_name: 'BRCA1', condition: 'Hereditary Breast Cancer', original_risk: 'HIGH' },
  { clinvar_id: 'VCV000000002', gene_name: 'CFTR',  condition: 'Cystic Fibrosis',          original_risk: 'HIGH' },
  { clinvar_id: 'VCV000000003', gene_name: 'APOE',  condition: "Alzheimer's Risk",          original_risk: 'MEDIUM' },
  { clinvar_id: 'VCV000000004', gene_name: 'TP53',  condition: 'Li–Fraumeni Syndrome',     original_risk: 'HIGH' },
  { clinvar_id: 'VCV000000005', gene_name: 'HBB',   condition: 'Sickle Cell Anaemia',      original_risk: 'MEDIUM' },
];

const RISK_DOT = {
  HIGH:   'bg-red-500',
  MEDIUM: 'bg-blue-500',
  LOW:    'bg-green-500',
};

const PLACEHOLDER_DNA =
  'ATGGATTTATCTGCTCTTCGCGTTGAAGAAGTACAAAATGTCATTAATGCTATGCAGAAAATCTTAGAGTGTCCCATC';

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function App() {
  /* Input state */
  const [mode,      setMode]      = useState('clinvar');   // 'clinvar' | 'dna'
  const [clinvarId, setClinvarId] = useState('');
  const [dnaInput,  setDnaInput]  = useState('');

  /* API hooks */
  const { data, loading, error, analyze } = useAnalyze();
  const { list: clinvarList, fetchList }  = useClinVarList();

  useEffect(() => { fetchList(); }, [fetchList]);

  const entries = clinvarList.length ? clinvarList : DEMO_CLINVAR;

  const handleSubmit = () => {
    if (mode === 'clinvar' && clinvarId) {
      analyze({ clinvar_id: clinvarId });
    } else if (mode === 'dna' && dnaInput.trim()) {
      analyze({ dna_sequence: dnaInput.trim() });
    }
  };

  const handleReset = () => {
    window.location.reload();
  };

  const canSubmit = mode === 'clinvar' ? !!clinvarId : dnaInput.trim().length >= 6;

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-grid relative scanline" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* Atmospheric radial glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px]
                        bg-green-500/[0.04] blur-3xl rounded-full" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px]
                        bg-blue-500/[0.03] blur-3xl rounded-full" />
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <header className="text-center space-y-3 fade-up">
          <div className="inline-flex items-center gap-2 bg-green-950/50 border border-green-500/20
                          rounded-full px-4 py-1.5 text-xs font-mono text-green-400 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            SIMULATION MODE · ClinVar Dataset · ESM-3 × RFdiffusion × ProteinMPNN
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            <span className="text-green-400 glow-green">Generative AI</span>
            {' '}for Predictive{' '}
            <br className="hidden md:block" />
            Gene Pattern Modification
          </h1>

          <p className="text-gray-400 text-sm max-w-xl mx-auto">
            Submit a DNA sequence or a ClinVar ID to simulate the full bioinformatics
            repair pipeline — translation, instability detection, structural healing, and inverse folding.
          </p>
        </header>

        {/* ── Input Panel ─────────────────────────────────────────────── */}
        {!data && (
          <div className="rounded-2xl border border-white/8 bg-gray-900/80 backdrop-blur-md
                          shadow-2xl overflow-hidden fade-up-2">

            {/* Tab bar */}
            <div className="flex border-b border-white/5">
              {[
                { id: 'clinvar', label: 'ClinVar ID', icon: <FlaskConical size={14} /> },
                { id: 'dna',     label: 'DNA Sequence', icon: <Dna size={14} /> },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setMode(tab.id)}
                  className={`flex items-center gap-2 px-6 py-3.5 text-sm font-semibold transition-all ${
                    mode === tab.id
                      ? 'text-green-400 border-b-2 border-green-500 bg-white/[0.03]'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6 space-y-6">

              {/* ClinVar mode */}
              {mode === 'clinvar' && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">
                    Select a ClinVar accession from the test dataset
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {entries.map(entry => (
                      <button
                        key={entry.clinvar_id}
                        onClick={() => setClinvarId(entry.clinvar_id)}
                        className={`text-left rounded-xl border p-3.5 transition-all duration-150 ${
                          clinvarId === entry.clinvar_id
                            ? 'border-green-500/60 bg-green-950/40 shadow-md shadow-green-900/30'
                            : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-mono text-gray-400">{entry.clinvar_id}</span>
                          <span className={`w-2 h-2 rounded-full ${RISK_DOT[entry.original_risk] || 'bg-gray-500'}`} />
                        </div>
                        <p className="text-sm font-semibold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                          {entry.gene_name}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{entry.condition}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* DNA mode */}
              {mode === 'dna' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">
                      Paste DNA sequence (A/T/C/G only)
                    </p>
                    <button
                      onClick={() => setDnaInput(PLACEHOLDER_DNA)}
                      className="text-xs text-green-400 hover:text-green-300 font-mono underline transition-colors"
                    >
                      Load example
                    </button>
                  </div>
                  <textarea
                    value={dnaInput}
                    onChange={e => setDnaInput(e.target.value.toUpperCase().replace(/[^ATCG]/g, ''))}
                    placeholder="ATGGATTTATCTGCTCTTCGCGTT…"
                    rows={5}
                    className="w-full bg-gray-950 border border-white/8 rounded-xl px-4 py-3
                               font-mono text-sm text-green-300 placeholder-gray-700
                               focus:outline-none focus:border-green-500/40 focus:ring-1
                               focus:ring-green-500/20 resize-none transition-colors"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    spellCheck={false}
                  />
                  {dnaInput && (
                    <p className="text-xs font-mono text-gray-500">
                      {dnaInput.length} bp · ~{Math.floor(dnaInput.length / 3)} codons
                    </p>
                  )}
                </div>
              )}

              {/* Submit */}
              <div className="flex items-center gap-4 pt-2">
                <button
                  onClick={handleSubmit}
                  disabled={loading || !canSubmit}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-500
                             disabled:opacity-40 disabled:cursor-not-allowed
                             text-white font-semibold text-sm px-6 py-2.5 rounded-xl
                             transition-all duration-150 shadow-lg shadow-green-900/40
                             hover:shadow-green-700/40 active:scale-95"
                >
                  {loading
                    ? <><Loader2 size={16} className="animate-spin" /> Running Pipeline…</>
                    : <><ChevronRight size={16} /> Run Analysis</>
                  }
                </button>
                {loading && (
                  <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
                    <span className="cursor">ESM-3 → RFdiffusion → ProteinMPNN </span>
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/30
                                bg-red-950/40 px-4 py-3 text-sm text-red-400">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Pipeline steps indicator ─────────────────────────────────── */}
        {loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 fade-up">
            {[
              { label: 'Translating DNA', sub: 'Biopython' },
              { label: 'ESM-3 Scan',      sub: 'Perplexity analysis' },
              { label: 'RFdiffusion',     sub: 'Backbone healing' },
              { label: 'ProteinMPNN',     sub: 'Inverse folding' },
            ].map((step, i) => (
              <div key={i}
                   className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center"
                   style={{ animationDelay: `${i * 0.15}s` }}>
                <div className="w-6 h-6 border-2 border-green-500/30 border-t-green-400 rounded-full
                                animate-spin mx-auto mb-2" style={{ animationDelay: `${i * 0.3}s` }} />
                <p className="text-xs font-semibold text-white font-mono">{step.label}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{step.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Dashboard ────────────────────────────────────────────────── */}
        {data && !loading && (
          <div className="fade-up space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono text-gray-500">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Analysis complete · Record {data.record_id?.slice(0,8)}
              </div>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white
                           font-mono transition-colors border border-white/5 hover:border-white/10
                           bg-white/[0.02] hover:bg-white/[0.04] rounded-lg px-3 py-1.5"
              >
                <RotateCcw size={12} /> New Analysis
              </button>
            </div>
            <Dashboard data={data} />
          </div>
        )}

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <footer className="text-center text-xs text-gray-700 font-mono pb-4">
          GenAI Gene Pipeline · Wizard-of-Oz Simulation · Not for clinical use ·{' '}
          ESM-3 × RFdiffusion × ProteinMPNN × ClinVar Dataset
        </footer>
      </div>
    </div>
  );
}
