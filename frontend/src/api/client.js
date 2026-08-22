/**
 * API client — fetch wrapper for the FastAPI backend.
 * All requests go to localhost:8000.
 */

const API_BASE = 'http://127.0.0.1:8000/api';

async function fetchJSON(endpoint, params = {}) {
  const url = new URL(`${API_BASE}${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API error: ${response.status}`);
  }

  return response.json();
}

export function fetchGEX(ticker = '^SPX', expiries = 5) {
  return fetchJSON('/gex', { ticker, expiries });
}

export function fetchGexTerm(ticker = '^SPX', expiries = 15) {
  return fetchJSON('/gex-term', { ticker, expiries });
}

export function fetchDEX(ticker = '^SPX', expiries = 5) {
  return fetchJSON('/dex', { ticker, expiries });
}

export function fetchVannaCharm(ticker = '^SPX', expiries = 5) {
  return fetchJSON('/vanna-charm', { ticker, expiries });
}

export function fetchOI(ticker = '^SPX', expiries = 3) {
  return fetchJSON('/oi', { ticker, expiries });
}

export function fetchIVSkew(ticker = '^SPX', expiry = 0) {
  return fetchJSON('/iv-skew', { ticker, expiry });
}

export function fetchSpot(ticker = '^SPX', tf = '1d') {
  return fetchJSON('/spot', { ticker, tf });
}

export function fetchHistory(ticker = '^SPX') {
  return fetchJSON(`/history/${ticker}`);
}

export async function triggerHistoryUpdate(ticker = '^SPX') {
  const url = new URL(`${API_BASE}/history/${ticker}/update`);
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Accept': 'application/json' },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API error: ${response.status}`);
  }
  return response.json();
}

export function fetchIVTerm(ticker = '^SPX', expiries = 10) {
  return fetchJSON('/iv-term', { ticker, expiries });
}

export function fetchGEXHeatmap(ticker = '^SPX', expiries = 8) {
  return fetchJSON('/gex-heatmap', { ticker, expiries });
}

export function fetchDEXChange(ticker = '^SPX', expiries = 5, window = 300) {
  return fetchJSON('/dex-change', { ticker, expiries, window });
}

export function fetchTrace(ticker = '^SPX', interval = '5m') {
  return fetchJSON('/trace', { ticker, interval });
}
