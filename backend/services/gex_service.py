"""
GEX (Gamma Exposure) calculation service.
Refactored from calc_gex.py — uses yfinance to fetch option chains,
calculates per-strike gamma exposure, and identifies key levels.
"""
import datetime
import pandas as pd
import yfinance as yf

from services.greeks import calc_gamma
from models.schemas import GEXResponse, GEXStrike


# Risk-free rate (approximate US 3-month T-bill yield)
RISK_FREE_RATE = 0.04
# Multiplier for SPX options (100 shares per contract)
MULTIPLIER = 100
# Filter strikes within this percentage of spot
STRIKE_RANGE_PCT = 0.15


def get_gex_profile(ticker: str = "^SPX", expiry_count: int = 5) -> GEXResponse:
    """
    Calculate the full Gamma Exposure profile for a given ticker.

    Returns a GEXResponse with:
    - gex_by_strike: per-strike net GEX in billions
    - call_wall / put_wall / zero_gamma key levels
    - regime classification (POSITIVE / NEGATIVE)
    """
    asset = yf.Ticker(ticker)
    hist = asset.history(period="1d")
    if hist.empty:
        raise ValueError(f"No price data available for {ticker}")
    spot_price = float(hist["Close"].iloc[-1])

    options_dates = asset.options
    if not options_dates:
        raise ValueError(f"No options data available for {ticker}")

    today = datetime.datetime.today()
    all_rows: list[pd.DataFrame] = []

    dates_to_fetch = options_dates[: min(expiry_count, len(options_dates))]

    for date_str in dates_to_fetch:
        try:
            chain = asset.option_chain(date_str)
        except Exception:
            continue

        exp_date = datetime.datetime.strptime(date_str, "%Y-%m-%d")
        T = max((exp_date - today).days + 1, 1) / 365.0

        for frame, opt_type in [(chain.calls, "call"), (chain.puts, "put")]:
            df = frame.copy()
            df["T"] = T
            df["type"] = opt_type
            df["is_0dte"] = (date_str == options_dates[0])
            all_rows.append(df)

    if not all_rows:
        raise ValueError("Could not fetch any option chain data")

    df = pd.concat(all_rows, ignore_index=True)

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

    strikes_list = [
        GEXStrike(
            strike=float(row["strike"]), 
            gex_billions=round(float(row["gex_billions"]), 4),
            gex_0dte_billions=round(float(row["gex_0dte_billions"]), 4)
        )
        for _, row in gex_merged.iterrows()
    ]

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
        gex_by_strike=strikes_list,
    )

def get_gex_term_structure(ticker: str = "^SPX", expiry_count: int = 15):
    """
    Calculate the Gamma Exposure term structure (GEX grouped by expiration date).
    """
    from models.schemas import GEXTermResponse, GEXTermExpiry
    asset = yf.Ticker(ticker)
    hist = asset.history(period="1d")
    if hist.empty:
        raise ValueError(f"No price data available for {ticker}")
    spot_price = float(hist["Close"].iloc[-1])

    options_dates = asset.options
    if not options_dates:
        raise ValueError(f"No options data available for {ticker}")

    today = datetime.datetime.today()
    all_rows: list[pd.DataFrame] = []

    dates_to_fetch = options_dates[: min(expiry_count, len(options_dates))]

    for date_str in dates_to_fetch:
        try:
            chain = asset.option_chain(date_str)
        except Exception:
            continue

        exp_date = datetime.datetime.strptime(date_str, "%Y-%m-%d")
        T = max((exp_date - today).days + 1, 1) / 365.0

        for frame, opt_type in [(chain.calls, "call"), (chain.puts, "put")]:
            df = frame.copy()
            df["T"] = T
            df["type"] = opt_type
            df["expiry_date"] = date_str
            all_rows.append(df)

    if not all_rows:
        raise ValueError("Could not fetch any option chain data")

    df = pd.concat(all_rows, ignore_index=True)

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
