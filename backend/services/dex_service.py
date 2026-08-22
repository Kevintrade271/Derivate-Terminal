import time
import datetime
import pandas as pd
import yfinance as yf

from services.greeks import calc_delta
from models.schemas import DEXResponse, DEXStrike, DEXChangeResponse, DEXChangeStrike, TraceResponse, TracePoint
from services.cboe_data import get_quotes, get_spot_and_quotes
from services.realtime_spot import get_realtime_spot


RISK_FREE_RATE = 0.04
MULTIPLIER = 100
STRIKE_RANGE_PCT = 0.15

# Rolling spot history for delta change baseline: ticker -> list of (timestamp, spot_price)
_spot_history: dict[str, list[tuple[float, float]]] = {}


def get_dex_profile(ticker: str = "^SPX", expiry_count: int = 5) -> DEXResponse:
    """
    Calculate the full Delta Exposure profile for a given ticker.

    DEX = Delta * OI * 100 * Spot
    Calls contribute positive DEX, Puts contribute negative DEX.
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

    lower = spot_price * (1 - STRIKE_RANGE_PCT)
    upper = spot_price * (1 + STRIKE_RANGE_PCT)
    df = df[(df["strike"] > lower) & (df["strike"] < upper)].copy()

    # Calculate delta for each row
    df["delta"] = df.apply(
        lambda row: calc_delta(
            spot_price, row["strike"], row["T"], RISK_FREE_RATE, row["impliedVolatility"], row["type"]
        ),
        axis=1,
    )

    # DEX = Delta * OI * Multiplier * Spot
    df["DEX"] = df["delta"].abs() * df["openInterest"] * MULTIPLIER * spot_price
    df.loc[df["type"] == "put", "DEX"] = -df.loc[df["type"] == "put", "DEX"]
    df["DEX_B"] = df["DEX"] / 1e9

    # Aggregate by strike
    df_calls = df[df["type"] == "call"].groupby("strike")["DEX_B"].sum().reset_index()
    df_calls.columns = ["strike", "call_dex_billions"]

    df_puts = df[df["type"] == "put"].groupby("strike")["DEX_B"].sum().reset_index()
    df_puts.columns = ["strike", "put_dex_billions"]

    dex_agg = df.groupby("strike")["DEX_B"].sum().reset_index()
    dex_agg.columns = ["strike", "dex_billions"]

    dex_merged = pd.merge(dex_agg, df_calls, on="strike", how="outer").fillna(0)
    dex_merged = pd.merge(dex_merged, df_puts, on="strike", how="outer").fillna(0)

    total_dex = float(dex_merged["dex_billions"].sum())
    max_delta_idx = dex_merged["dex_billions"].abs().idxmax()
    max_delta = dex_merged.loc[max_delta_idx]

    strikes_list = [
        DEXStrike(
            strike=float(row["strike"]), 
            dex_billions=round(float(row["dex_billions"]), 4),
            call_dex_billions=round(float(row["call_dex_billions"]), 4),
            put_dex_billions=round(float(row["put_dex_billions"]), 4),
        )
        for _, row in dex_merged.iterrows()
    ]

    return DEXResponse(
        spot_price=round(spot_price, 2),
        max_delta_strike=float(max_delta["strike"]),
        max_delta_value=round(float(max_delta["dex_billions"]), 4),
        total_dex=round(total_dex, 4),
        dex_by_strike=strikes_list,
    )


def get_dex_change_profile(ticker: str = "^SPX", expiry_count: int = 5, window_seconds: int = 300) -> DEXChangeResponse:
    """
    Calculate real-time Delta Change and Delta Flow per strike (Market Maker hedging impact).
    Compares current real-time spot against the baseline from `window_seconds` ago.
    """
    clean_ticker = ticker.upper().strip()
    current_spot = get_realtime_spot(clean_ticker)
    
    cboe_spot, df = get_spot_and_quotes(clean_ticker)
    if current_spot <= 0:
        current_spot = cboe_spot
    if df.empty or current_spot <= 0:
        raise ValueError(f"No options data available for {ticker}")

    now = time.time()
    if clean_ticker not in _spot_history:
        _spot_history[clean_ticker] = []

    history = _spot_history[clean_ticker]
    history.append((now, current_spot))
    # Keep only last 1 hour of history
    _spot_history[clean_ticker] = [(t, p) for t, p in history if now - t <= 3600]

    # Find baseline spot price from window_seconds ago (default 5m)
    cutoff = now - window_seconds
    past_points = [p for t, p in _spot_history[clean_ticker] if t <= cutoff]
    if past_points:
        previous_spot = past_points[-1]
    elif len(_spot_history[clean_ticker]) > 1:
        previous_spot = _spot_history[clean_ticker][0][1]
    else:
        # Initial reference: -0.2% price move baseline if single tick
        previous_spot = current_spot * 0.998

    spot_change_pct = round(((current_spot - previous_spot) / max(previous_spot, 1)) * 100, 3)

    df["T"] = (df["dte"] / 365.0).clip(lower=1/365.0)
    df = df.rename(columns={"optionType": "type"})

    unique_expiries = sorted(df["expiration"].unique())
    dates_to_use = unique_expiries[: min(expiry_count, len(unique_expiries))]
    df = df[df["expiration"].isin(dates_to_use)].copy()

    lower = current_spot * (1 - STRIKE_RANGE_PCT)
    upper = current_spot * (1 + STRIKE_RANGE_PCT)
    df = df[(df["strike"] > lower) & (df["strike"] < upper)].copy()

    # Vectorized / Apply delta for Current and Previous spot
    df["delta_curr"] = df.apply(
        lambda r: calc_delta(current_spot, r["strike"], r["T"], RISK_FREE_RATE, r["impliedVolatility"], r["type"]),
        axis=1,
    )
    df["delta_prev"] = df.apply(
        lambda r: calc_delta(previous_spot, r["strike"], r["T"], RISK_FREE_RATE, r["impliedVolatility"], r["type"]),
        axis=1,
    )

    # Current DEX and Previous DEX in billions
    df["dex_curr"] = df["delta_curr"].abs() * df["openInterest"] * MULTIPLIER * current_spot
    df.loc[df["type"] == "put", "dex_curr"] = -df.loc[df["type"] == "put", "dex_curr"]

    df["dex_prev"] = df["delta_prev"].abs() * df["openInterest"] * MULTIPLIER * previous_spot
    df.loc[df["type"] == "put", "dex_prev"] = -df.loc[df["type"] == "put", "dex_prev"]

    # Delta Change = DEX_curr - DEX_prev
    df["delta_change_b"] = (df["dex_curr"] - df["dex_prev"]) / 1e9

    # Aggregate by strike
    calls_change = df[df["type"] == "call"].groupby("strike")["delta_change_b"].sum().reset_index()
    calls_change.columns = ["strike", "call_delta_change"]

    puts_change = df[df["type"] == "put"].groupby("strike")["delta_change_b"].sum().reset_index()
    puts_change.columns = ["strike", "put_delta_change"]

    total_change = df.groupby("strike")["delta_change_b"].sum().reset_index()
    total_change.columns = ["strike", "delta_change_billions"]

    merged = pd.merge(total_change, calls_change, on="strike", how="outer").fillna(0)
    merged = pd.merge(merged, puts_change, on="strike", how="outer").fillna(0)

    net_delta_flow = float(merged["delta_change_billions"].sum())
    call_flow = float(merged["call_delta_change"].sum())
    put_flow = float(merged["put_delta_change"].sum())

    action_summary = "NET BUYING PRESSURE (SHORT COVERING)" if net_delta_flow >= 0 else "NET SELLING PRESSURE (DELTA HEDGING)"

    strikes_list = [
        DEXChangeStrike(
            strike=float(row["strike"]),
            delta_change_billions=round(float(row["delta_change_billions"]), 4),
            call_delta_change=round(float(row["call_delta_change"]), 4),
            put_delta_change=round(float(row["put_delta_change"]), 4),
            action="BUYING" if row["delta_change_billions"] >= 0 else "SELLING",
        )
        for _, row in merged.sort_values("strike").iterrows()
    ]

    return DEXChangeResponse(
        ticker=ticker,
        spot_price=round(current_spot, 2),
        previous_spot_price=round(previous_spot, 2),
        spot_change_pct=spot_change_pct,
        net_delta_flow_billions=round(net_delta_flow, 4),
        call_delta_flow_billions=round(call_flow, 4),
        put_delta_flow_billions=round(put_flow, 4),
        action_summary=action_summary,
        delta_change_by_strike=strikes_list,
    )


def get_trace_profile(ticker: str = "^SPX", interval: str = "5m") -> TraceResponse:
    """
    Calculate SpotGamma-style TRACE (Cumulative Delta Flow) across today's session.
    Measures intraday dealer hedging pressure and detects divergence signals.
    """
    clean_ticker = ticker.upper().strip()
    spot_price, df = get_spot_and_quotes(clean_ticker)
    if df.empty or spot_price <= 0:
        raise ValueError(f"No options data available for {ticker}")

    # Fetch intraday candles
    asset = yf.Ticker(clean_ticker)
    hist = asset.history(period="2d", interval=interval)
    if hist.empty:
        raise ValueError(f"No intraday price data for {ticker}")

    # Filter to today's session or last 60 candles
    today_candles = hist[hist.index.date == hist.index[-1].date]
    if len(today_candles) < 3:
        today_candles = hist.tail(60)

    # Filter options chain to 5 nearest expiries and +/- 15% range
    df["T"] = (df["dte"] / 365.0).clip(lower=1/365.0)
    df = df.rename(columns={"optionType": "type"})
    unique_expiries = sorted(df["expiration"].unique())
    dates_to_use = unique_expiries[: min(5, len(unique_expiries))]
    df = df[df["expiration"].isin(dates_to_use)].copy()
    lower = spot_price * (1 - STRIKE_RANGE_PCT)
    upper = spot_price * (1 + STRIKE_RANGE_PCT)
    df = df[(df["strike"] > lower) & (df["strike"] < upper)].copy()

    # Pre-extract arrays for fast Black-Scholes calculation
    strikes = df["strike"].values
    t_vals = df["T"].values
    ivs = df["impliedVolatility"].values
    types = df["type"].values
    ois = df["openInterest"].values
    is_call = (types == "call")

    def calc_dex_at_price(s: float) -> float:
        deltas = [
            calc_delta(s, strikes[i], t_vals[i], RISK_FREE_RATE, ivs[i], types[i])
            for i in range(len(strikes))
        ]
        deltas = pd.Series(deltas)
        dex_vals = deltas.abs() * ois * MULTIPLIER * s
        dex_vals[~is_call] = -dex_vals[~is_call]
        return float(dex_vals.sum())

    base_dex = calc_dex_at_price(float(today_candles["Open"].iloc[0]))
    points: list[TracePoint] = []
    prev_dex = base_dex

    for idx, row in today_candles.iterrows():
        c_price = float(row["Close"])
        c_time = int(idx.timestamp())
        c_dex = calc_dex_at_price(c_price)
        
        delta_flow_m = (c_dex - prev_dex) / 1e6
        cum_flow_m = (c_dex - base_dex) / 1e6
        prev_dex = c_dex

        points.append(
            TracePoint(
                time=c_time,
                price=round(c_price, 2),
                delta_flow_m=round(delta_flow_m, 2),
                cumulative_flow_m=round(cum_flow_m, 2),
            )
        )

    net_trace = points[-1].cumulative_flow_m if points else 0.0
    regime = "BULLISH_FLOW" if net_trace >= 0 else "BEARISH_FLOW"

    divergence_signal = None
    if len(points) >= 8:
        prices = [p.price for p in points[-8:]]
        flows = [p.cumulative_flow_m for p in points[-8:]]
        if prices[-1] <= min(prices[:-1]) and flows[-1] > flows[0] + 5:
            divergence_signal = "BULLISH DIVERGENCE (V-REVERSAL)"
        elif prices[-1] >= max(prices[:-1]) and flows[-1] < flows[0] - 5:
            divergence_signal = "BEARISH DIVERGENCE (EXHAUSTION)"

    return TraceResponse(
        ticker=ticker,
        spot_price=round(spot_price, 2),
        net_trace_flow_m=round(net_trace, 2),
        regime=regime,
        divergence_signal=divergence_signal,
        points=points,
    )
