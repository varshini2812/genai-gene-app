/**
 * Dashboard.jsx
 * Full-width analysis result dashboard rendered after /api/v1/analyze returns.
 *
 * Sections
 * ─────────
 *  1. Risk header + pipeline timing
 *  2. Mol* Before / After 3D viewers
 *  3. ESM-3 Perplexity chart
 *  4. pLDDT confidence chart
 *  5. XAI toggle panel
 *  6. Sequence viewer (DNA + Protein)
 *  7. Download PDF button
 */

import React, { useRef, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell,
} from 'recharts';
import {
  Download, Zap, Dna, FlaskConical, ChevronDown, ChevronUp,
  Clock, Shield, Layers, BarChart2,
} from 'lucide-react';
import MolStarViewer from './MolStarViewer';
import XAIToggle     from './XAIToggle';

// ── Risk colours ────────────────────────────────────────────────────────────
const RISK_STYLE = {
  HIGH:   { text: 'text-red-400',   bg: 'bg-red-500/10',  border: 'border-red-500/30',  hex: '#ef4444' },
  MEDIUM: { text: 'text-blue-400',  bg: 'bg-blue-500/10', border: 'border-blue-500/30', hex: '#3b82f6' },
  LOW:    { text: 'text-green-400', bg: 'bg-green-500/10',border: 'border-green-500/30',hex: '#22c55e' },
};

// ── Tiny stat chip ───────────────────────────────────────────────────────────
function Chip({ label, value, icon: Icon, accent = 'text-bio-400' }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-white/5
                    bg-white/[0.03] px-4 py-3 min-w-[110px]">
      <div className={`mb-1 ${accent}`}><Icon size={16} /></div>
      <p className={`text-lg font-bold font-mono ${accent}`}>{value}</p>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}

// ── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-white/8 bg-gray-900/70 backdrop-blur-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-bio-400" />
          <span className="text-sm font-semibold text-white font-display">{title}</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" />
               : <ChevronDown size={16} className="text-gray-500" />}
      </button>
      {open && <div className="px-6 pb-6">{children}</div>}
    </div>
  );
}

// ── Custom tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-white/10 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-[11px] text-gray-400 font-mono mb-1">Residue #{label}</p>
      {payload.map(p => (
        <p key={p.name} className="text-xs font-mono" style={{ color: p.color }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(3) : p.value}</strong>
        </p>
      ))}
    </div>
  );
}

// ── Sequence display with spike highlighting ─────────────────────────────────
function SequenceViewer({ sequence, label, spikes = [], isProtein = false }) {
  const spikeSet = new Set(spikes);
  const chunks   = [];
  for (let i = 0; i < sequence.length; i += 60) chunks.push(sequence.slice(i, i+60));

  return (
    <div>
      <p className="text-[11px] font-mono uppercase tracking-widest text-gray-500 mb-2">{label}</p>
      <div className="font-mono text-[11px] leading-6 bg-gray-950 rounded-lg p-3 overflow-x-auto border border-white/5">
        {chunks.map((chunk, ci) => (
          <div key={ci} className="flex gap-3">
            <span className="text-gray-600 select-none w-10 shrink-0 text-right">
              {ci * 60 + 1}
            </span>
            <span>
              {chunk.split('').map((ch, j) => {
                const pos = ci * 60 + j;
                const isSpike = isProtein && spikeSet.has(pos);
                return (
                  <span
                    key={j}
                    className={isSpike
                      ? 'bg-red-500/30 text-red-300 rounded px-[1px]'
                      : 'text-bio-300'}
                  >
                    {ch}
                  </span>
                );
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PDF export helper ─────────────────────────────────────────────────────────
async function downloadPDF(dashboardRef, data) {
  try {
    const { default: jsPDF }     = await import('jspdf');
    const { default: html2canvas } = await import('html2canvas');

    const canvas = await html2canvas(dashboardRef.current, {
      backgroundColor: '#030712',
      scale: 1.5,
      useCORS: true,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfW    = pdf.internal.pageSize.getWidth();
    const pdfH    = (canvas.height * pdfW) / canvas.width;
    let   yPos    = 0;
    const pageH   = pdf.internal.pageSize.getHeight();

    while (yPos < pdfH) {
      if (yPos > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, -yPos, pdfW, pdfH);
      yPos += pageH;
    }

    const fname = `gene-analysis-${data.gene_name || 'unknown'}-${data.record_id?.slice(0,8) || 'report'}.pdf`;
    pdf.save(fname);
  } catch (e) {
    alert('PDF export requires html2canvas + jsPDF. Install via npm or open browser print dialog.');
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
//  Main Dashboard
// ═══════════════════════════════════════════════════════════════════════════════

export default function Dashboard({ data }) {
  const dashRef = useRef(null);
  const [persona, setPersona] = useState('patient');

  if (!data) return null;

  const risk  = RISK_STYLE[data.xai.risk_level] || RISK_STYLE.LOW;
  const riskLabel = { HIGH: 'High Risk', MEDIUM: 'Medium Risk', LOW: 'Low Risk' }[data.xai.risk_level];

  // Chart data
  const perplexityData = data.esm3.perplexity_scores
    .slice(0, 80)                  // show first 80 residues for readability
    .map((v, i) => ({ residue: i, perplexity: v }));

  const spikeSet = new Set(data.esm3.spikes.map(s => s.position));
  const meanPerp = data.esm3.mean_perplexity;
  const spikeThreshold = meanPerp + 1.8 * (
    Math.sqrt(perplexityData.reduce((a, b) => a + Math.pow(b.perplexity - meanPerp, 2), 0) / perplexityData.length)
  );

  const plddtData = data.protein_mpnn.plddt_scores
    .slice(0, 80)
    .map((v, i) => ({ residue: i, plddt: v, healed: data.rfdiffusion.healed_residues.includes(i) }));

  return (
    <div ref={dashRef} className="space-y-6">

      {/* ── Top summary bar ───────────────────────────────────────────── */}
      <div className={`rounded-2xl border ${risk.border} ${risk.bg} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className={`text-2xl font-bold font-mono ${risk.text}`}>{riskLabel}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-semibold border ${risk.border} ${risk.text}`}>
                {data.xai.risk_score}/100
              </span>
            </div>
            <p className="text-sm text-gray-300">
              <span className="font-semibold text-white">{data.gene_name}</span>
              {data.condition ? ` · ${data.condition}` : ''}
            </p>
            {data.clinvar_id && (
              <p className="text-xs text-gray-500 font-mono mt-0.5">{data.clinvar_id}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip label="Spikes" value={data.esm3.spikes.length}  icon={Zap}         accent="text-red-400" />
            <Chip label="Healed" value={data.rfdiffusion.healed_residues.length} icon={Shield} accent="text-green-400" />
            <Chip label="RMSD Å" value={data.rfdiffusion.backbone_rmsd.toFixed(2)} icon={Layers} accent="text-blue-400" />
            <Chip label="ms"     value={Math.round(data.pipeline_duration_ms)}  icon={Clock}  accent="text-gray-400" />
          </div>
        </div>
      </div>

      {/* ── 3D Structures ─────────────────────────────────────────────── */}
      <Section title="3D Protein Structures" icon={FlaskConical}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MolStarViewer
            structureUrl={data.before_structure_url}
            label={`Before — ${data.gene_name || 'Mutated'}`}
            isHealed={false}
          />
          <MolStarViewer
            structureUrl={data.after_structure_url}
            label={`After — AI Healed`}
            isHealed={true}
          />
        </div>
        <p className="text-xs text-gray-600 mt-3 font-mono text-center">
          Structure source: AlphaFold EBI / RCSB PDB · Powered by Mol* Viewer
        </p>
      </Section>

      {/* ── ESM-3 Perplexity chart ────────────────────────────────────── */}
      <Section title="ESM-3 Instability Scan" icon={BarChart2}>
        <p className="text-xs text-gray-500 mb-4">
          Perplexity per residue. Red spikes above the {spikeThreshold.toFixed(2)} threshold
          indicate structurally unstable regions targeted by RFdiffusion.
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={perplexityData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
            <defs>
              <linearGradient id="perpGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="residue" tick={{ fill: '#6b7280', fontSize: 10, fontFamily: 'monospace' }} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 10, fontFamily: 'monospace' }} domain={[0, 'auto']} />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine
              y={spikeThreshold}
              stroke="#facc15"
              strokeDasharray="4 4"
              label={{ value: 'Threshold', fill: '#facc15', fontSize: 10, fontFamily: 'monospace', position: 'insideTopRight' }}
            />
            <Area
              type="monotone"
              dataKey="perplexity"
              stroke="#ef4444"
              fill="url(#perpGrad)"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4, fill: '#ef4444' }}
            />
          </AreaChart>
        </ResponsiveContainer>
        <div className="mt-3 flex flex-wrap gap-2">
          {data.esm3.spikes.slice(0, 8).map(s => (
            <span key={s.position}
              className="text-[10px] font-mono bg-red-950/60 text-red-300 border border-red-500/30 rounded px-2 py-0.5">
              [{s.position}] {s.residue} z={s.z_score.toFixed(2)}
            </span>
          ))}
          {data.esm3.spikes.length > 8 && (
            <span className="text-[10px] font-mono text-gray-500">
              +{data.esm3.spikes.length - 8} more
            </span>
          )}
        </div>
      </Section>

      {/* ── pLDDT Confidence chart ────────────────────────────────────── */}
      <Section title="ProteinMPNN Confidence (pLDDT)" icon={BarChart2}>
        <p className="text-xs text-gray-500 mb-4">
          Per-residue confidence after inverse folding. Green bars = AI-healed residues.
          Higher is better (1.0 = fully confident).
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={plddtData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="residue" tick={{ fill: '#6b7280', fontSize: 10, fontFamily: 'monospace' }} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 10, fontFamily: 'monospace' }} domain={[0, 1]} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="plddt" maxBarSize={8} radius={[2,2,0,0]}>
              {plddtData.map((entry, i) => (
                <Cell key={i} fill={entry.healed ? '#22c55e' : '#3b82f6'} opacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-green-500" />
            <span className="text-xs text-gray-500 font-mono">AI-healed residue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-blue-500" />
            <span className="text-xs text-gray-500 font-mono">Stable residue</span>
          </div>
          <div className="ml-auto text-xs text-gray-500 font-mono">
            Seq. Recovery: <span className="text-bio-400 font-semibold">
              {(data.protein_mpnn.sequence_recovery * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </Section>

      {/* ── XAI Panel ─────────────────────────────────────────────────── */}
      <XAIToggle data={data.xai} persona={persona} onToggle={setPersona} />

      {/* ── Sequence Viewer ───────────────────────────────────────────── */}
      <Section title="Sequence Comparison" icon={Dna} defaultOpen={false}>
        <div className="space-y-5">
          <SequenceViewer
            sequence={data.translated_protein}
            label="Original Protein (mutated)"
            spikes={data.esm3.spikes.map(s => s.position)}
            isProtein
          />
          <SequenceViewer
            sequence={data.corrected_protein}
            label="Corrected Protein (AI-stabilised)"
            isProtein
          />
          <SequenceViewer
            sequence={data.input_dna}
            label="Input DNA"
          />
          <SequenceViewer
            sequence={data.corrected_dna}
            label="Codon-Optimised DNA (back-translated)"
          />
        </div>
      </Section>

      {/* ── Export button ─────────────────────────────────────────────── */}
      <div className="flex justify-end pb-2">
        <button
          onClick={() => downloadPDF(dashRef, data)}
          className="flex items-center gap-2 bg-bio-600 hover:bg-bio-500 text-white font-semibold
                     text-sm px-5 py-2.5 rounded-xl transition-all duration-150 shadow-lg shadow-bio-900/40
                     hover:shadow-bio-700/40 active:scale-95"
        >
          <Download size={16} />
          Download PDF Report
        </button>
      </div>

    </div>
  );
}
