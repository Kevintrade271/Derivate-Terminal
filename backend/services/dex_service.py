"""
DEX (Delta Exposure) calculation service.
Calculates per-strike delta exposure to estimate directional hedging pressure.
"""
import datetime
import pandas as pd
import yfinance as yf

from services.greeks import calc_delta
from models.schemas import DEXResponse, DEXStrike


RISK_FREE_RATE = 0.04
MULTIPLIER = 100
STRIKE_RANGE_PCT = 0.15


def get_dex_profile(ticker: str = "^SPX", expiry_count: int = 5) -> DEXResponse:
    """
    Calculate the full Delta Exposure profile for a given ticker.

    DEX = Delta * OI * 100 * Spot
    Calls contribute positive DEX, Puts contribute negative DEX.
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
            all_rows.append(df)

    if not all_rows:
        raise ValueError("Could not fetch any option chain data")

    df = pd.concat(all_rows, ignore_index=True)

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
    # For dealer perspective: dealers are short calls (negative delta) and short puts (positive delta)
    # So we flip: call DEX positive, put DEX negative (net dealer delta hedging)
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
