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
    IVTermResponse,
    GEXHeatmapResponse,
    DEXChangeResponse,
    TraceResponse,
)
from services.gex_service import (
    get_gex_profile,
    get_gex_term_structure,
    get_iv_term_structure,
    get_gex_heatmap,
)
from services.dex_service import get_dex_profile, get_dex_change_profile, get_trace_profile
from services.vanna_charm_service import get_vanna_charm_profile
from services.cboe_data import get_quotes

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


@router.get("/dex-change", response_model=DEXChangeResponse)
def dex_change_endpoint(
    ticker: str = Query(default="^SPX", pattern=r"^[\^A-Z0-9=]{1,10}$"),
    expiries: int = Query(default=5, ge=1, le=20),
    window: int = Query(default=300, ge=10, le=3600, description="Window in seconds for Delta Change baseline"),
):
    """Delta Change / Delta Flow by strike (Market Maker hedging impact)."""
    try:
        return get_dex_change_profile(ticker=ticker, expiry_count=expiries, window_seconds=window)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating Delta Change: {e}")


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

        cboe_ticker = ticker.replace("^", "")
        df = get_quotes(cboe_ticker)
        if not df.empty:
            unique_expiries = sorted(df["expiration"].unique())
            dates_to_use = unique_expiries[: min(expiries, len(unique_expiries))]
            df = df[df["expiration"].isin(dates_to_use)].copy()

            lower = spot_price * 0.85
            upper = spot_price * 1.15
            df = df[(df["strike"] > lower) & (df["strike"] < upper)]

            df_calls = df[df["optionType"] == "call"].groupby("strike")["openInterest"].sum().reset_index()
            df_calls.columns = ["strike", "openInterest_call"]

            df_puts = df[df["optionType"] == "put"].groupby("strike")["openInterest"].sum().reset_index()
            df_puts.columns = ["strike", "openInterest_put"]

            merged = pd.merge(df_calls, df_puts, on="strike", how="outer").fillna(0).sort_values("strike")
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

        # Fallback to yfinance if CBOE has no quotes
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

        lower = spot_price * 0.85
        upper = spot_price * 1.15
        df_calls = df_calls[(df_calls["strike"] > lower) & (df_calls["strike"] < upper)]
        df_puts = df_puts[(df_puts["strike"] > lower) & (df_puts["strike"] < upper)]

        merged = pd.merge(df_calls, df_puts, on="strike", how="outer", suffixes=("_call", "_put")).fillna(0).sort_values("strike")

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
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating Open Interest: {e}")


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
    tf: str = Query(default="1d", pattern=r"^(1d|1h|15m|5m|3m|1m)$"),
):
    """Current spot price, session open, and multi-day candle history (including 1m/3m/5m/15m)."""
    try:
        from services.realtime_spot import get_realtime_spot
        asset = yf.Ticker(ticker)
        
        if tf == "1m":
            hist = asset.history(period="2d", interval="1m")
        elif tf == "3m":
            hist_1m = asset.history(period="2d", interval="1m")
            if not hist_1m.empty:
                hist = hist_1m.resample("3min").agg({"Open": "first", "High": "max", "Low": "min", "Close": "last"}).dropna()
            else:
                hist = pd.DataFrame()
        elif tf == "5m":
            hist = asset.history(period="5d", interval="5m")
        elif tf == "15m":
            hist = asset.history(period="5d", interval="15m")
        elif tf == "1h":
            hist = asset.history(period="1mo", interval="1h")
        else:
            hist = asset.history(period="6mo", interval="1d")

        if hist.empty:
            raise HTTPException(status_code=404, detail=f"No price data for {ticker}")

        current = float(hist["Close"].iloc[-1])
        prev = float(hist["Close"].iloc[-2]) if len(hist) > 1 else current

        # Today's open calculation
        today_mask = hist.index.date == hist.index[-1].date
        today_candles = hist[today_mask]
        today_open = float(today_candles["Open"].iloc[0]) if not today_candles.empty else current

        # Inject real-time sub-second spot quote if available
        live_spot = get_realtime_spot(ticker)
        if live_spot > 0:
            current = live_spot

        change_pct = round(((current - prev) / max(prev, 1)) * 100, 2)

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

        # Update last candle with live spot tick
        if live_spot > 0 and candles:
            candles[-1].close = round(live_spot, 2)
            candles[-1].high = max(candles[-1].high, round(live_spot, 2))
            candles[-1].low = min(candles[-1].low, round(live_spot, 2))

        return SpotResponse(
            ticker=ticker,
            price=round(current, 2),
            change_pct=change_pct,
            today_open=round(today_open, 2),
            candles=candles,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching spot data: {e}")


@router.get("/trace", response_model=TraceResponse)
def trace_endpoint(
    ticker: str = Query(default="^SPX", pattern=r"^[\^A-Z0-9=]{1,10}$"),
    interval: str = Query(default="5m", pattern=r"^(1m|3m|5m|15m)$"),
):
    """SpotGamma-style TRACE: Cumulative Delta Flow & Divergence Signals."""
    try:
        return get_trace_profile(ticker=ticker, interval=interval)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating TRACE flow: {e}")

@router.get("/vanna-charm", response_model=VannaCharmResponse)
def vanna_charm_endpoint(query: TickerQuery = Depends()):
    """Calculate Vanna and Charm Exposure per strike."""
    try:
        return get_vanna_charm_profile(query.ticker, query.expiries)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/iv-term", response_model=IVTermResponse)
def iv_term_endpoint(
    ticker: str = Query(default="^SPX", pattern=r"^[\^A-Z0-9=]{1,10}$"),
    expiries: int = Query(default=10, ge=1, le=30),
):
    """ATM Implied Volatility term structure."""
    try:
        return get_iv_term_structure(ticker=ticker, expiry_count=expiries)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/gex-heatmap", response_model=GEXHeatmapResponse)
def gex_heatmap_endpoint(
    ticker: str = Query(default="^SPX", pattern=r"^[\^A-Z0-9=]{1,10}$"),
    expiries: int = Query(default=8, ge=1, le=20),
):
    """Gamma Exposure Heatmap (Strike x Expiration)."""
    try:
        return get_gex_heatmap(ticker=ticker, expiry_count=expiries)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

