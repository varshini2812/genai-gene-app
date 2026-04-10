/**
 * XAIToggle.jsx
 * Dual-persona explainability panel.
 * Props:
 *   data     {object}  – xai metrics object from API
 *   persona  {string}  – 'patient' | 'doctor'
 *   onToggle {fn}      – (newPersona) => void
 */

import React from 'react';
import {
  User,
  Stethoscope,
  AlertTriangle,
  TrendingUp,
  Activity,
  Target,
  FlaskConical,
  Info,
} from 'lucide-react';

const RISK_CONFIG = {
  HIGH:   { bg: 'bg-red-950/60',   border: 'border-red-500/40',   text: 'text-red-400',   bar: 'bg-red-500',   label: 'High Risk' },
  MEDIUM: { bg: 'bg-blue-950/60',  border: 'border-blue-500/40',  text: 'text-blue-400',  bar: 'bg-blue-500',  label: 'Medium Risk' },
  LOW:    { bg: 'bg-green-950/60', border: 'border-green-500/40', text: 'text-green-400', bar: 'bg-green-500', label: 'Low Risk' },
};

function MetricCard({ icon: Icon, label, value, sub, accent = 'text-bio-400' }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.03] p-3 hover:bg-white/[0.05] transition-colors">
      <div className={`mt-0.5 ${accent}`}>
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-gray-500 font-mono uppercase tracking-wider">{label}</p>
        <p className={`text-sm font-semibold font-mono ${accent} mt-0.5 truncate`}>{value}</p>
        {sub && <p className="text-[11px] text-gray-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function XAIToggle({ data, persona, onToggle }) {
  if (!data) return null;

  const risk    = RISK_CONFIG[data.risk_level] || RISK_CONFIG.LOW;
  const isDoc   = persona === 'doctor';

  const summary    = isDoc ? data.doctor_summary    : data.patient_summary;
  const recommend  = isDoc ? data.doctor_recommendation : data.patient_recommendation;

  return (
    <div className="rounded-2xl border border-white/10 bg-gray-900/80 backdrop-blur-md overflow-hidden shadow-2xl">

      {/* ── Header / Toggle ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-bio-400" />
          <h3 className="text-sm font-semibold text-white font-display">
            Explainability Engine
          </h3>
          <span className="text-[10px] font-mono text-gray-500 bg-gray-800 rounded px-1.5 py-0.5">XAI</span>
        </div>

        {/* Toggle pill */}
        <div className="flex items-center gap-1 bg-gray-800 rounded-full p-1">
          <button
            onClick={() => onToggle('patient')}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all duration-200 ${
              !isDoc
                ? 'bg-bio-500 text-gray-950 shadow-md shadow-bio-500/30'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <User size={12} />
            Patient
          </button>
          <button
            onClick={() => onToggle('doctor')}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all duration-200 ${
              isDoc
                ? 'bg-bio-500 text-gray-950 shadow-md shadow-bio-500/30'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Stethoscope size={12} />
            Clinician
          </button>
        </div>
      </div>

      <div className="p-5 space-y-5">

        {/* ── Risk banner ─────────────────────────────────────────────── */}
        <div className={`rounded-xl border ${risk.border} ${risk.bg} p-4`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className={risk.text} />
              <span className={`text-sm font-bold font-mono ${risk.text}`}>{risk.label}</span>
            </div>
            <span className={`text-2xl font-bold font-mono ${risk.text}`}>
              {data.risk_score}<span className="text-sm font-normal text-gray-500">/100</span>
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full ${risk.bar} rounded-full transition-all duration-700`}
              style={{ width: `${data.risk_score}%` }}
            />
          </div>
        </div>

        {/* ── Metrics grid ────────────────────────────────────────────── */}
        {isDoc ? (
          <div className="grid grid-cols-2 gap-2">
            <MetricCard
              icon={TrendingUp}
              label="Confidence Score"
              value={`${(data.confidence_score * 100).toFixed(1)}%`}
              accent="text-bio-400"
            />
            <MetricCard
              icon={Target}
              label="Pathogenicity Prob."
              value={data.probability_pathogenic.toFixed(4)}
              sub="ACMG/AMP criteria"
              accent="text-purple-400"
            />
            <MetricCard
              icon={FlaskConical}
              label="p-value"
              value={data.p_value.toFixed(5)}
              sub={data.p_value < 0.05 ? 'Significant' : 'Not significant'}
              accent={data.p_value < 0.05 ? 'text-yellow-400' : 'text-gray-400'}
            />
            <MetricCard
              icon={Activity}
              label="Model Agreement"
              value={`${(data.model_agreement_score * 100).toFixed(1)}%`}
              sub="ESM-3 × RFdiff × MPNN"
              accent="text-cyan-400"
            />
            <MetricCard
              icon={AlertTriangle}
              label="Instability Spikes"
              value={`${data.spike_positions.length} residues`}
              sub={`Positions: ${data.spike_positions.slice(0,4).join(', ')}${data.spike_positions.length > 4 ? '…' : ''}`}
              accent="text-red-400"
            />
            <MetricCard
              icon={TrendingUp}
              label="Corrected Residues"
              value={`${data.corrected_residue_count}`}
              sub={`${data.healed_percentage}% of spikes resolved`}
              accent="text-green-400"
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <MetricCard
              icon={TrendingUp}
              label="AI Confidence"
              value={`${(data.confidence_score * 100).toFixed(0)}%`}
              accent="text-bio-400"
            />
            <MetricCard
              icon={Target}
              label="Regions Healed"
              value={`${data.healed_percentage}%`}
              sub="of flagged sites"
              accent="text-green-400"
            />
          </div>
        )}

        {/* ── Narrative summary ───────────────────────────────────────── */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="flex items-start gap-2 mb-2">
            <Info size={14} className="text-bio-400 mt-0.5 shrink-0" />
            <p className="text-[11px] font-mono uppercase tracking-wider text-gray-500">
              {isDoc ? 'Clinical Summary' : 'Your Results'}
            </p>
          </div>
          <p className={`text-sm leading-relaxed ${isDoc ? 'font-mono text-gray-300 text-[12px]' : 'text-gray-200'}`}>
            {summary}
          </p>
        </div>

        {/* ── Recommendation ──────────────────────────────────────────── */}
        <div className={`rounded-xl border ${risk.border} ${risk.bg} p-4`}>
          <p className={`text-[11px] font-mono uppercase tracking-wider mb-1 ${risk.text}`}>
            {isDoc ? 'Clinical Recommendation' : 'What to Do'}
          </p>
          <p className={`text-sm ${isDoc ? 'text-gray-300 font-mono text-[12px]' : 'text-gray-200'}`}>
            {recommend}
          </p>
        </div>
      </div>
    </div>
  );
}
