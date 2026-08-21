"""
Options API router — all derivatives endpoints.
"""
import datetime
from fastapi import APIRouter, Query, HTTPException, Depends

from models.schemas import (
    TickerQuery,
    GEXResponse,
    DEXResponse,
    OIResponse,
    OIStrike,
    IVSkewResponse,
    IVPoint,
    SpotResponse,
    SpotCandle,
    GEXTermResponse,
    VannaCharmResponse,
)
from services.gex_service import get_gex_profile, get_gex_term_structure
from services.dex_service import get_dex_profile
from services.vanna_charm_service import get_vanna_charm_profile

import yfinance as yf
import pandas as pd

router = APIRouter(prefix="/api", tags=["options"])


@router.get("/gex", response_model=GEXResponse)
def gex_endpoint(query: TickerQuery = Depends()):
    """Calculate Gamma Exposure per strike."""
    try:
        return get_gex_profile(query.ticker, query.expiries)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/gex-term", response_model=GEXTermResponse)
def gex_term_endpoint(query: TickerQuery = Depends()):
    """Calculate Gamma Exposure Term Structure (by Expiration)."""
    try:
        # Request more expirations (e.g. 15) to see the term structure properly
        return get_gex_term_structure(query.ticker, max(15, query.expiries))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dex", response_model=DEXResponse)
def dex_endpoint(
    ticker: str = Query(default="^SPX", pattern=r"^[\^A-Z0-9=]{1,10}$"),
    expiries: int = Query(default=5, ge=1, le=20),
):
    """Delta Exposure (DEX) profile by strike."""
    try:
        return get_dex_profile(ticker=ticker, expiry_count=expiries)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Error calculating DEX")


@router.get("/oi", response_model=OIResponse)
def oi_endpoint(
    ticker: str = Query(default="^SPX", pattern=r"^[\^A-Z0-9=]{1,10}$"),
    expiries: int = Query(default=3, ge=1, le=20),
):
    """Open Interest by strike — Calls vs Puts."""
    try:
        asset = yf.Ticker(ticker)
        hist = asset.history(period="1d")
        if hist.empty:
            raise HTTPException(status_code=404, detail=f"No price data for {ticker}")
        spot_price = float(hist["Close"].iloc[-1])

        options_dates = asset.options
        if not options_dates:
            raise HTTPException(status_code=404, detail=f"No options data for {ticker}")

        dates_to_fetch = options_dates[: min(expiries, len(options_dates))]
        all_calls = []
        all_puts = []

        for date_str in dates_to_fetch:
            try:
                chain = asset.option_chain(date_str)
                all_calls.append(chain.calls[["strike", "openInterest"]])
                all_puts.append(chain.puts[["strike", "openInterest"]])
            except Exception:
                continue

        if not all_calls:
            raise HTTPException(status_code=404, detail="Could not fetch option chain data")

        df_calls = pd.concat(all_calls).groupby("strike")["openInterest"].sum().reset_index()
        df_puts = pd.concat(all_puts).groupby("strike")["openInterest"].sum().reset_index()

        # Filter range
        lower = spot_price * 0.85
        upper = spot_price * 1.15
        df_calls = df_calls[(df_calls["strike"] > lower) & (df_calls["strike"] < upper)]
        df_puts = df_puts[(df_puts["strike"] > lower) & (df_puts["strike"] < upper)]

        # Merge
        merged = pd.merge(df_calls, df_puts, on="strike", how="outer", suffixes=("_call", "_put"))
        merged = merged.fillna(0)

        total_call_oi = int(merged["openInterest_call"].sum())
        total_put_oi = int(merged["openInterest_put"].sum())

        oi_list = [
            OIStrike(
                strike=float(row["strike"]),
                call_oi=int(row["openInterest_call"]),
                put_oi=int(row["openInterest_put"]),
            )
            for _, row in merged.iterrows()
        ]

        return OIResponse(
            spot_price=round(spot_price, 2),
            total_call_oi=total_call_oi,
            total_put_oi=total_put_oi,
            put_call_ratio=round(total_put_oi / max(total_call_oi, 1), 4),
            oi_by_strike=oi_list,
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error calculating Open Interest")


@router.get("/iv-skew", response_model=IVSkewResponse)
def iv_skew_endpoint(
    ticker: str = Query(default="^SPX", pattern=r"^[\^A-Z0-9=]{1,10}$"),
    expiry: int = Query(default=0, ge=0, le=50, description="Expiry index (0 = nearest)"),
):
    """Implied Volatility skew for a single expiration."""
    try:
        asset = yf.Ticker(ticker)
        hist = asset.history(period="1d")
        if hist.empty:
            raise HTTPException(status_code=404, detail=f"No price data for {ticker}")
        spot_price = float(hist["Close"].iloc[-1])

        options_dates = asset.options
        if not options_dates or expiry >= len(options_dates):
            raise HTTPException(status_code=404, detail="Expiry index out of range")

        date_str = options_dates[expiry]
        chain = asset.option_chain(date_str)

        lower = spot_price * 0.90
        upper = spot_price * 1.10

        calls = chain.calls[["strike", "impliedVolatility"]].copy()
        calls = calls[(calls["strike"] > lower) & (calls["strike"] < upper)]

        puts = chain.puts[["strike", "impliedVolatility"]].copy()
        puts = puts[(puts["strike"] > lower) & (puts["strike"] < upper)]

        merged = pd.merge(calls, puts, on="strike", how="outer", suffixes=("_call", "_put"))
        merged = merged.sort_values("strike")

        iv_points = [
            IVPoint(
                strike=float(row["strike"]),
                call_iv=round(float(row["impliedVolatility_call"]), 4) if pd.notna(row.get("impliedVolatility_call")) else None,
                put_iv=round(float(row["impliedVolatility_put"]), 4) if pd.notna(row.get("impliedVolatility_put")) else None,
            )
            for _, row in merged.iterrows()
        ]

        return IVSkewResponse(
            spot_price=round(spot_price, 2),
            expiry_date=date_str,
            iv_points=iv_points,
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error calculating IV Skew")


@router.get("/spot", response_model=SpotResponse)
def spot_endpoint(
    ticker: str = Query(default="^SPX", pattern=r"^[\^A-Z0-9=]{1,10}$"),
    tf: str = Query(default="1d", pattern=r"^(1d|1h|15m|5m)$"),
):
    """Current spot price and recent candle history."""
    try:
        asset = yf.Ticker(ticker)
        
        tf_map = {
            "1d": {"period": "6mo", "interval": "1d"},
            "1h": {"period": "1mo", "interval": "1h"},
            "15m": {"period": "5d", "interval": "15m"},
            "5m": {"period": "1d", "interval": "5m"},
        }
        params = tf_map[tf]
        hist = asset.history(period=params["period"], interval=params["interval"])
        if hist.empty:
            raise HTTPException(status_code=404, detail=f"No price data for {ticker}")

        current = float(hist["Close"].iloc[-1])
        prev = float(hist["Close"].iloc[-2]) if len(hist) > 1 else current
        change_pct = round(((current - prev) / prev) * 100, 2)

        candles = [
            SpotCandle(
                time=idx.strftime("%Y-%m-%d") if tf == "1d" else int(idx.timestamp()),
                open=round(float(row["Open"]), 2),
                high=round(float(row["High"]), 2),
                low=round(float(row["Low"]), 2),
                close=round(float(row["Close"]), 2),
            )
            for idx, row in hist.iterrows()
        ]

        return SpotResponse(
            ticker=ticker,
            price=round(current, 2),
            change_pct=change_pct,
            candles=candles,
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error fetching spot data")

@router.get("/vanna-charm", response_model=VannaCharmResponse)
def vanna_charm_endpoint(query: TickerQuery = Depends()):
    """Calculate Vanna and Charm Exposure per strike."""
    try:
        return get_vanna_charm_profile(query.ticker, query.expiries)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
