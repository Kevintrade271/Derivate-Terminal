"""
Real-time Spot Price provider.
Fetches high-frequency quotes for underlying tickers (SPY, QQQ, ^SPX, ^NDX, etc.)
with in-memory caching (TTL 3s) to eliminate API rate limits.
"""
import time
import requests
import threading
from typing import Optional

_spot_cache: dict[str, tuple[float, float]] = {}  # ticker -> (timestamp, price)
_spot_lock = threading.Lock()

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
}


def get_realtime_spot(ticker: str) -> float:
    """
    Get the latest spot price for a ticker.
    Cached for 3 seconds to permit rapid concurrent calculations.
    """
    clean_sym = ticker.upper().strip()
    now = time.time()

    with _spot_lock:
        if clean_sym in _spot_cache:
            ts, price = _spot_cache[clean_sym]
            if now - ts < 3 and price > 0:
                return price

    # 1. Try Yahoo Finance rapid chart meta
    try:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{clean_sym}?interval=1m&range=1d"
        r = requests.get(url, headers=HEADERS, timeout=3)
        if r.status_code == 200:
            data = r.json()
            result = data.get("chart", {}).get("result", [])
            if result:
                meta = result[0].get("meta", {})
                price = float(meta.get("regularMarketPrice") or meta.get("chartPreviousClose") or 0.0)
                if price > 0:
                    with _spot_lock:
                        _spot_cache[clean_sym] = (now, price)
                    return price
    except Exception:
        pass

    # 2. Fallback to CBOE quotes cache if available
    try:
        from services.cboe_data import get_spot_and_quotes
        price, _ = get_spot_and_quotes(clean_sym)
        if price > 0:
            with _spot_lock:
                _spot_cache[clean_sym] = (now, price)
            return price
    except Exception:
        pass

    # 3. Fallback to yfinance
    try:
        import yfinance as yf
        asset = yf.Ticker(clean_sym)
        hist = asset.history(period="1d")
        if not hist.empty:
            price = float(hist["Close"].iloc[-1])
            with _spot_lock:
                _spot_cache[clean_sym] = (now, price)
            return price
    except Exception:
        pass

    return 0.0
