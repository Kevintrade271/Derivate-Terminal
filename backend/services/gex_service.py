import time
import datetime
import pandas as pd
import yfinance as yf

from services.greeks import calc_gamma
from models.schemas import GEXResponse, GEXStrike
from services.cboe_data import get_quotes, get_spot_and_quotes


# Risk-free rate (approximate US 3-month T-bill yield)
RISK_FREE_RATE = 0.04
# Multiplier for SPX options (100 shares per contract)
MULTIPLIER = 100
# Filter strikes within this percentage of spot
STRIKE_RANGE_PCT = 0.15

# Rolling strike trace snapshots: ticker -> list of (timestamp, {strike: gex_billions})
_gex_trace_snapshots: dict[str, list[tuple[float, dict[float, float]]]] = {}
# Daily extrema per strike: ticker -> {strike: {"min": float, "max": float}}
_gex_daily_extrema: dict[str, dict[float, dict[str, float]]] = {}


def get_gex_profile(ticker: str = "^SPX", expiry_count: int = 5) -> GEXResponse:
    """
    Calculate the full Gamma Exposure profile for a given ticker.

    Returns a GEXResponse with:
    - gex_by_strike: per-strike net GEX in billions
    - call_wall / put_wall / zero_gamma key levels
    - regime classification (POSITIVE / NEGATIVE)
    """
    spot_price, df = get_spot_and_quotes(ticker)
    if df.empty or spot_price <= 0:
        raise ValueError(f"No options data available from CBOE for {ticker}")

    df["T"] = df["dte"] / 365.0
    df["T"] = df["T"].clip(lower=1/365.0)
    df = df.rename(columns={"optionType": "type"})

    unique_expiries = sorted(df["expiration"].unique())
    dates_to_use = unique_expiries[: min(expiry_count, len(unique_expiries))]
    df = df[df["expiration"].isin(dates_to_use)].copy()
    
    df["is_0dte"] = (df["expiration"] == unique_expiries[0])

    # Filter strikes within range
    lower = spot_price * (1 - STRIKE_RANGE_PCT)
    upper = spot_price * (1 + STRIKE_RANGE_PCT)
    df = df[(df["strike"] > lower) & (df["strike"] < upper)].copy()

    # Calculate gamma for each row
    df["gamma"] = df.apply(
        lambda row: calc_gamma(spot_price, row["strike"], row["T"], RISK_FREE_RATE, row["impliedVolatility"]),
        axis=1,
    )

    # GEX = Gamma * OI * 100 * Spot^2 * 0.01
    df["GEX"] = df["gamma"] * df["openInterest"] * MULTIPLIER * (spot_price**2) * 0.01

    # Puts contribute negative GEX (dealers are short puts)
    df.loc[df["type"] == "put", "GEX"] = -df.loc[df["type"] == "put", "GEX"]

    df["GEX_B"] = df["GEX"] / 1e9

    # Aggregate by strike
    df_0dte = df[df["is_0dte"]]
    gex_0dte_agg = df_0dte.groupby("strike")["GEX_B"].sum().reset_index()
    gex_0dte_agg.columns = ["strike", "gex_0dte_billions"]

    gex_agg = df.groupby("strike")["GEX_B"].sum().reset_index()
    gex_agg.columns = ["strike", "gex_billions"]

    gex_merged = pd.merge(gex_agg, gex_0dte_agg, on="strike", how="left").fillna(0)

    # Per-strike absolute gamma and volumes
    if "volume" not in df.columns:
        df["volume"] = 0.0
    
    df["volume"] = df["volume"].fillna(0)
    
    abs_gamma_agg = df.groupby("strike")["GEX_B"].apply(lambda x: x.abs().sum()).reset_index()
    abs_gamma_agg.columns = ["strike", "absolute_gamma"]
    
    call_vol_agg = df[df["type"] == "call"].groupby("strike")["volume"].sum().reset_index()
    call_vol_agg.columns = ["strike", "call_volume"]
    
    put_vol_agg = df[df["type"] == "put"].groupby("strike")["volume"].sum().reset_index()
    put_vol_agg.columns = ["strike", "put_volume"]

    gex_merged = pd.merge(gex_merged, abs_gamma_agg, on="strike", how="left")
    gex_merged = pd.merge(gex_merged, call_vol_agg, on="strike", how="left")
    gex_merged = pd.merge(gex_merged, put_vol_agg, on="strike", how="left").fillna(0)

    # Key levels
    call_wall_idx = gex_merged["gex_billions"].idxmax()
    put_wall_idx = gex_merged["gex_billions"].idxmin()
    call_wall = gex_merged.loc[call_wall_idx]
    put_wall = gex_merged.loc[put_wall_idx]

    total_gex = float(gex_merged["gex_billions"].sum())
    total_gex_0dte = float(gex_merged["gex_0dte_billions"].sum())
    absolute_gamma = float(df["GEX_B"].abs().sum())

    # Estimate zero-gamma level (where cumulative GEX crosses zero)
    sorted_gex = gex_merged.sort_values("strike").copy()
    sorted_gex["cum_gex"] = sorted_gex["gex_billions"].cumsum()
    zero_cross = sorted_gex.iloc[(sorted_gex["cum_gex"]).abs().argsort()[:1]]
    zero_gamma = float(zero_cross["strike"].values[0])

    # Estimate Vol Trigger: Strike where cumulative Put GEX > cumulative Call GEX (top-down)
    df_puts = df[df["type"] == "put"].groupby("strike")["GEX_B"].sum().reset_index()
    df_calls = df[df["type"] == "call"].groupby("strike")["GEX_B"].sum().reset_index()
    
    merged_pc = pd.merge(df_calls, df_puts, on="strike", how="outer", suffixes=("_call", "_put")).fillna(0)
    merged_pc = merged_pc.sort_values("strike", ascending=False)
    merged_pc["cum_call"] = merged_pc["GEX_B_call"].cumsum()
    merged_pc["cum_put"] = merged_pc["GEX_B_put"].abs().cumsum()
    
    trigger_rows = merged_pc[merged_pc["cum_put"] > merged_pc["cum_call"]]
    vol_trigger = float(trigger_rows.iloc[0]["strike"]) if not trigger_rows.empty else zero_gamma

    regime = "POSITIVE" if total_gex > 0 else "NEGATIVE"

    # Record current GEX snapshot for Strike TRACE
    now = time.time()
    clean_sym = ticker.upper().strip()
    curr_map = {float(row["strike"]): round(float(row["gex_billions"]), 4) for _, row in gex_merged.iterrows()}

    if clean_sym not in _gex_trace_snapshots:
        _gex_trace_snapshots[clean_sym] = []
    _gex_trace_snapshots[clean_sym].append((now, curr_map))
    # Keep last 2 hours of snapshots
    _gex_trace_snapshots[clean_sym] = [(t, m) for t, m in _gex_trace_snapshots[clean_sym] if now - t <= 7200]

    # Update daily extrema
    if clean_sym not in _gex_daily_extrema:
        _gex_daily_extrema[clean_sym] = {}
    for k, v in curr_map.items():
        if k not in _gex_daily_extrema[clean_sym]:
            _gex_daily_extrema[clean_sym][k] = {"min": v, "max": v}
        else:
            _gex_daily_extrema[clean_sym][k]["min"] = min(_gex_daily_extrema[clean_sym][k]["min"], v)
            _gex_daily_extrema[clean_sym][k]["max"] = max(_gex_daily_extrema[clean_sym][k]["max"], v)

    def get_past_snapshot(seconds_ago: int) -> dict[float, float]:
        target = now - seconds_ago
        candidates = [(abs(t - target), m) for t, m in _gex_trace_snapshots[clean_sym] if t <= now - (seconds_ago * 0.4)]
        if candidates:
            candidates.sort(key=lambda x: x[0])
            return candidates[0][1]
        return {}

    snap_10m = get_past_snapshot(600)
    snap_30m = get_past_snapshot(1800)
    snap_60m = get_past_snapshot(3600)
    extrema_map = _gex_daily_extrema.get(clean_sym, {})

    strikes_list = [
        GEXStrike(
            strike=float(row["strike"]), 
            gex_billions=round(float(row["gex_billions"]), 4),
            gex_0dte_billions=round(float(row["gex_0dte_billions"]), 4),
            absolute_gamma=round(float(row["absolute_gamma"]), 4),
            call_volume=float(row["call_volume"]),
            put_volume=float(row["put_volume"]),
            gex_10m_ago=snap_10m.get(float(row["strike"])),
            gex_30m_ago=snap_30m.get(float(row["strike"])),
            gex_60m_ago=snap_60m.get(float(row["strike"])),
            daily_min_gex=extrema_map.get(float(row["strike"]), {}).get("min"),
            daily_max_gex=extrema_map.get(float(row["strike"]), {}).get("max"),
        )
        for _, row in gex_merged.iterrows()
    ]

    hedging_velocity_1pct = round(total_gex * 0.01, 4)
    zero_gamma_distance_pts = round(spot_price - zero_gamma, 2)
    zero_gamma_distance_pct = round(((spot_price - zero_gamma) / spot_price) * 100.0, 2) if spot_price > 0 else 0.0
    gamma_regime_state = "STABILIZING (PIN)" if total_gex >= 0 else "ACCELERATING (TREND)"

    return GEXResponse(
        spot_price=round(spot_price, 2),
        call_wall_strike=float(call_wall["strike"]),
        call_wall_gex=round(float(call_wall["gex_billions"]), 4),
        put_wall_strike=float(put_wall["strike"]),
        put_wall_gex=round(float(put_wall["gex_billions"]), 4),
        zero_gamma=zero_gamma,
        vol_trigger=vol_trigger,
        total_gex=round(total_gex, 4),
        total_gex_0dte=round(total_gex_0dte, 4),
        absolute_gamma=round(absolute_gamma, 4),
        regime=regime,
        hedging_velocity_1pct=hedging_velocity_1pct,
        zero_gamma_distance_pts=zero_gamma_distance_pts,
        zero_gamma_distance_pct=zero_gamma_distance_pct,
        gamma_regime_state=gamma_regime_state,
        gex_by_strike=strikes_list,
    )

def get_gex_term_structure(ticker: str = "^SPX", expiry_count: int = 15):
    """
    Calculate the Gamma Exposure term structure (GEX grouped by expiration date).
    """
    from models.schemas import GEXTermResponse, GEXTermExpiry
    spot_price, df = get_spot_and_quotes(ticker)
    if df.empty or spot_price <= 0:
        raise ValueError(f"No options data available from CBOE for {ticker}")

    df["T"] = df["dte"] / 365.0
    df["T"] = df["T"].clip(lower=1/365.0)
    df = df.rename(columns={"optionType": "type", "expiration": "expiry_date"})

    unique_expiries = sorted(df["expiry_date"].unique())
    dates_to_use = unique_expiries[: min(expiry_count, len(unique_expiries))]
    df = df[df["expiry_date"].isin(dates_to_use)].copy()

    # Filter strikes within range
    lower = spot_price * (1 - STRIKE_RANGE_PCT)
    upper = spot_price * (1 + STRIKE_RANGE_PCT)
    df = df[(df["strike"] > lower) & (df["strike"] < upper)].copy()

    df["gamma"] = df.apply(
        lambda row: calc_gamma(spot_price, row["strike"], row["T"], RISK_FREE_RATE, row["impliedVolatility"]),
        axis=1,
    )

    df["GEX"] = df["gamma"] * df["openInterest"] * MULTIPLIER * (spot_price**2) * 0.01
    df.loc[df["type"] == "put", "GEX"] = -df.loc[df["type"] == "put", "GEX"]
    df["GEX_B"] = df["GEX"] / 1e9

    # Group by expiry date
    term_structure = []
    
    grouped = df.groupby("expiry_date")
    for exp, group in grouped:
        total_gex = group["GEX_B"].sum()
        call_gex = group[group["type"] == "call"]["GEX_B"].sum()
        put_gex = group[group["type"] == "put"]["GEX_B"].sum()
        
        term_structure.append(
            GEXTermExpiry(
                expiry_date=exp,
                total_gex_billions=round(float(total_gex), 4),
                call_gex_billions=round(float(call_gex), 4),
                put_gex_billions=round(float(put_gex), 4)
            )
        )
        
    return GEXTermResponse(
        ticker=ticker,
        spot_price=round(spot_price, 2),
        term_structure=term_structure
    )


def get_iv_term_structure(ticker: str = "^SPX", expiry_count: int = 10):
    """
    Calculate the ATM Implied Volatility term structure across expirations.
    """
    from models.schemas import IVTermResponse, IVTermPoint
    spot_price, df = get_spot_and_quotes(ticker)
    if df.empty or spot_price <= 0:
        raise ValueError(f"No options data available from CBOE for {ticker}")

    unique_expiries = sorted(df["expiration"].unique())
    dates_to_use = unique_expiries[: min(expiry_count, len(unique_expiries))]
    
    term_structure = []
    for exp in dates_to_use:
        sub_df = df[df["expiration"] == exp]
        if sub_df.empty:
            continue
        dte = int(sub_df["dte"].iloc[0])
        sub_df = sub_df.copy()
        sub_df["diff"] = (sub_df["strike"] - spot_price).abs()
        min_diff = sub_df["diff"].min()
        atm_rows = sub_df[sub_df["diff"] == min_diff]
        valid_ivs = atm_rows["impliedVolatility"][atm_rows["impliedVolatility"] > 0]
        atm_iv = float(valid_ivs.mean()) if not valid_ivs.empty else 0.0
        
        term_structure.append(
            IVTermPoint(
                expiry_date=exp,
                dte=dte,
                atm_iv=round(atm_iv, 4),
            )
        )
        
    return IVTermResponse(
        spot_price=round(spot_price, 2),
        ticker=ticker,
        term_structure=term_structure,
    )


def get_gex_heatmap(ticker: str = "^SPX", expiry_count: int = 8):
    """
    Calculate Gamma Exposure matrix (Strike x Expiration).
    """
    from models.schemas import GEXHeatmapResponse, GEXHeatmapCell
    spot_price, df = get_spot_and_quotes(ticker)
    if df.empty or spot_price <= 0:
        raise ValueError(f"No options data available from CBOE for {ticker}")

    unique_expiries = sorted(df["expiration"].unique())
    dates_to_use = unique_expiries[: min(expiry_count, len(unique_expiries))]
    df = df[df["expiration"].isin(dates_to_use)].copy()

    df["T"] = (df["dte"] / 365.0).clip(lower=1/365.0)
    df = df.rename(columns={"optionType": "type", "expiration": "expiry_date"})

    lower = spot_price * (1 - STRIKE_RANGE_PCT)
    upper = spot_price * (1 + STRIKE_RANGE_PCT)
    df = df[(df["strike"] > lower) & (df["strike"] < upper)].copy()

    df["gamma"] = df.apply(
        lambda row: calc_gamma(spot_price, row["strike"], row["T"], RISK_FREE_RATE, row["impliedVolatility"]),
        axis=1,
    )

    df["GEX"] = df["gamma"] * df["openInterest"] * MULTIPLIER * (spot_price**2) * 0.01
    df.loc[df["type"] == "put", "GEX"] = -df.loc[df["type"] == "put", "GEX"]
    df["GEX_B"] = df["GEX"] / 1e9

    grouped = df.groupby(["strike", "expiry_date"])["GEX_B"].sum().reset_index()

    strikes_list = sorted([float(s) for s in grouped["strike"].unique()])
    expiries_list = sorted([str(e) for e in grouped["expiry_date"].unique()])

    cells = [
        GEXHeatmapCell(
            strike=float(row["strike"]),
            expiry_date=str(row["expiry_date"]),
            gex_billions=round(float(row["GEX_B"]), 4),
        )
        for _, row in grouped.iterrows()
    ]

    return GEXHeatmapResponse(
        spot_price=round(spot_price, 2),
        ticker=ticker,
        strikes=strikes_list,
        expiries=expiries_list,
        cells=cells,
    )

