/**
 * useApi.js
 * Custom hooks for the Gene Pipeline API.
 */

import { useState, useCallback } from 'react';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

export function useAnalyze() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const analyze = useCallback(async ({ dna_sequence, clinvar_id }) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const resp = await fetch(`${API_BASE}/api/v1/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dna_sequence, clinvar_id }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || 'Analysis failed');
      }
      const json = await resp.json();
      setData(json);
      return json;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, analyze };
}

export function useClinVarList() {
  const [list,    setList]    = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/v1/clinvar`);
      if (resp.ok) {
        const json = await resp.json();
        setList(json);
      }
    } catch { /* fallback already in backend */ }
    finally { setLoading(false); }
  }, []);

  return { list, loading, fetchList };
}
