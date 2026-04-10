/**
 * MolStarViewer.jsx
 * Wraps the Mol* (molstar) viewer via its published ESM bundle.
 * Loads structure from a URL (CIF / PDB) and applies a colour theme.
 *
 * Props:
 *   structureUrl   {string}  – URL to the .cif structure file
 *   label          {string}  – "Before" or "After"
 *   colorTheme     {string}  – molstar built-in theme, e.g. "b-factor" | "sequence-id"
 *   isHealed       {boolean} – After panel: apply green chain coloring hint
 */

import React, { useEffect, useRef, useState } from 'react';

const MOLSTAR_CDN = 'https://cdn.jsdelivr.net/npm/molstar@4.3.0/build/viewer/molstar.js';
const MOLSTAR_CSS = 'https://cdn.jsdelivr.net/npm/molstar@4.3.0/build/viewer/molstar.css';

let molstarLoading = false;
let molstarLoaded  = false;
const molstarCallbacks = [];

function loadMolstar(cb) {
  if (molstarLoaded) { cb(); return; }
  molstarCallbacks.push(cb);
  if (molstarLoading) return;
  molstarLoading = true;

  // CSS
  const link = document.createElement('link');
  link.rel  = 'stylesheet';
  link.href = MOLSTAR_CSS;
  document.head.appendChild(link);

  // JS
  const script = document.createElement('script');
  script.src  = MOLSTAR_CDN;
  script.async = true;
  script.onload = () => {
    molstarLoaded = true;
    molstarCallbacks.forEach(fn => fn());
    molstarCallbacks.length = 0;
  };
  document.head.appendChild(script);
}

export default function MolStarViewer({ structureUrl, label = 'Structure', isHealed = false }) {
  const containerRef = useRef(null);
  const viewerRef    = useRef(null);
  const [status, setStatus]   = useState('loading'); // loading | ready | error
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    if (!structureUrl) return;

    loadMolstar(async () => {
      try {
        const molstar = window.molstar;
        if (!molstar || !containerRef.current) return;

        // Destroy previous instance
        if (viewerRef.current) {
          viewerRef.current.dispose?.();
          viewerRef.current = null;
        }
        containerRef.current.innerHTML = '';

        const viewer = await molstar.Viewer.create(containerRef.current, {
          layoutIsExpanded: false,
          layoutShowControls: false,
          layoutShowRemoteState: false,
          layoutShowSequence: false,
          layoutShowLog: false,
          layoutShowLeftPanel: false,
          viewportShowExpand: false,
          viewportShowSelectionMode: false,
          viewportShowAnimation: false,
          collapseRightPanel: true,
        });

        viewerRef.current = viewer;

        await viewer.loadStructureFromUrl(
          structureUrl,
          structureUrl.endsWith('.cif') ? 'mmcif' : 'pdb',
          false
        );

        setStatus('ready');
      } catch (err) {
        console.warn('Mol* load error:', err);
        setFallback(true);
        setStatus('fallback');
      }
    });

    return () => {
      if (viewerRef.current) {
        viewerRef.current.dispose?.();
        viewerRef.current = null;
      }
    };
  }, [structureUrl]);

  const borderColor = isHealed ? 'border-green-500/50' : 'border-red-500/40';
  const badgeColor  = isHealed
    ? 'bg-green-900/60 text-green-300 border-green-500/40'
    : 'bg-red-900/60 text-red-300 border-red-500/40';
  const glowClass   = isHealed ? 'shadow-green-500/20' : 'shadow-red-500/20';

  return (
    <div className={`relative rounded-xl border ${borderColor} bg-gray-950 overflow-hidden shadow-xl ${glowClass}`}
         style={{ height: 380 }}>

      {/* Header bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2
                      bg-gray-950/90 backdrop-blur-sm border-b border-white/5">
        <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded border ${badgeColor}`}>
          {label}
        </span>
        {status === 'ready' && (
          <span className="text-xs text-gray-500 font-mono">Mol* Viewer</span>
        )}
      </div>

      {/* Mol* mount target */}
      <div ref={containerRef} className="w-full h-full pt-9" />

      {/* Loading overlay */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/95 z-20">
          <div className="relative mb-4">
            <div className="w-12 h-12 border-2 border-bio-500/30 rounded-full" />
            <div className="absolute inset-0 w-12 h-12 border-t-2 border-bio-400 rounded-full animate-spin" />
          </div>
          <p className="text-bio-400 font-mono text-xs tracking-widest animate-pulse">
            LOADING STRUCTURE…
          </p>
        </div>
      )}

      {/* Fallback when Mol* unavailable */}
      {status === 'fallback' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950 z-20 p-4">
          <FallbackStructure isHealed={isHealed} label={label} structureUrl={structureUrl} />
        </div>
      )}
    </div>
  );
}

/* ── SVG placeholder that renders when CDN unavailable ─────────────────── */
function FallbackStructure({ isHealed, label, structureUrl }) {
  const color = isHealed ? '#22c55e' : '#ef4444';
  const nodes = isHealed
    ? [[80,140],[150,90],[230,120],[300,80],[370,110],[440,75],[510,105],[560,140]]
    : [[80,160],[140,100],[190,145],[260,85],[310,130],[380,95],[440,155],[560,120]];

  const path = nodes
    .map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`))
    .join(' ');

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <svg viewBox="0 0 640 280" className="w-full h-48 opacity-80">
        <defs>
          <filter id={`glow-${label}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Backbone ribbon */}
        <path d={path} fill="none" stroke={color} strokeWidth="3"
              filter={`url(#glow-${label})`} />
        {/* Residue nodes */}
        {nodes.map(([x,y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="6" fill={color} opacity="0.8"
                    filter={`url(#glow-${label})`} />
            {!isHealed && i % 3 === 1 && (
              <circle cx={x} cy={y} r="11" fill="none"
                      stroke="#ef4444" strokeWidth="1.5" opacity="0.4" />
            )}
          </g>
        ))}
        {/* Side chains */}
        {nodes.slice(0, -1).map(([x,y], i) => {
          const [nx, ny] = nodes[i+1];
          const mx = (x + nx) / 2;
          const my = (y + ny) / 2 - 25;
          return (
            <line key={`sc-${i}`} x1={mx} y1={(y+ny)/2} x2={mx} y2={my}
                  stroke={color} strokeWidth="1.5" opacity="0.4" />
          );
        })}
      </svg>
      <p className="text-xs font-mono text-gray-500 mt-2 text-center">
        Schematic View — Install CDN for full Mol* 3D
      </p>
      {structureUrl && (
        <a href={structureUrl} target="_blank" rel="noopener noreferrer"
           className="mt-1 text-xs text-bio-400 underline hover:text-bio-300 transition-colors font-mono">
          ↗ Open in AlphaFold DB
        </a>
      )}
    </div>
  );
}
