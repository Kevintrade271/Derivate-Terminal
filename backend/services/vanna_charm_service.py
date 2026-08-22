import datetime
import pandas as pd
import yfinance as yf

from services.greeks import calc_vanna, calc_charm
from models.schemas import VannaCharmResponse, VannaCharmStrike
from services.cboe_data import get_quotes, get_spot_and_quotes


RISK_FREE_RATE = 0.04
MULTIPLIER = 100
STRIKE_RANGE_PCT = 0.15


def get_vanna_charm_profile(ticker: str = "^SPX", expiry_count: int = 5) -> VannaCharmResponse:
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

    df["vanna"] = df.apply(
        lambda row: calc_vanna(
            spot_price, row["strike"], row["T"], RISK_FREE_RATE, row["impliedVolatility"], row["type"]
        ),
        axis=1,
    )

    df["charm"] = df.apply(
        lambda row: calc_charm(
            spot_price, row["strike"], row["T"], RISK_FREE_RATE, row["impliedVolatility"], row["type"]
        ),
        axis=1,
    )

    # Exposure = Greek * OI * Multiplier * Spot
    # For Vanna and Charm, dealers are short options, so we flip the sign of the exposure.
    # We do a simplified approach: just aggregate (Greek * OI * Multiplier * Spot) * -1
    df["VANNA_EXP"] = df["vanna"] * df["openInterest"] * MULTIPLIER * spot_price * -1
    df["CHARM_EXP"] = df["charm"] * df["openInterest"] * MULTIPLIER * spot_price * -1

    # For Puts, dealer is short put -> flip sign of put vanna/charm? 
    # Actually, dealer is short both calls and puts. 
    # Short call = -1 * call vanna
    # Short put = -1 * put vanna
    # This is correct.

    df["VANNA_B"] = df["VANNA_EXP"] / 1e9
    df["CHARM_B"] = df["CHARM_EXP"] / 1e9

    # Aggregate by strike
    df_calls = df[df["type"] == "call"].groupby("strike")[["VANNA_B", "CHARM_B"]].sum().reset_index()
    df_calls.columns = ["strike", "call_vanna", "call_charm"]

    df_puts = df[df["type"] == "put"].groupby("strike")[["VANNA_B", "CHARM_B"]].sum().reset_index()
    df_puts.columns = ["strike", "put_vanna", "put_charm"]

    agg_total = df.groupby("strike")[["VANNA_B", "CHARM_B"]].sum().reset_index()
    agg_total.columns = ["strike", "vanna_billions", "charm_billions"]

    merged = pd.merge(agg_total, df_calls, on="strike", how="outer").fillna(0)
    merged = pd.merge(merged, df_puts, on="strike", how="outer").fillna(0)

    total_vanna = float(merged["vanna_billions"].sum())
    total_charm = float(merged["charm_billions"].sum())

    strikes_list = [
        VannaCharmStrike(
            strike=float(row["strike"]),
            vanna_billions=round(float(row["vanna_billions"]), 4),
            charm_billions=round(float(row["charm_billions"]), 4),
            call_vanna=round(float(row["call_vanna"]), 4),
            put_vanna=round(float(row["put_vanna"]), 4),
            call_charm=round(float(row["call_charm"]), 4),
            put_charm=round(float(row["put_charm"]), 4),
        )
        for _, row in merged.iterrows()
    ]

    return VannaCharmResponse(
        ticker=ticker,
        spot_price=round(spot_price, 2),
        total_vanna=round(total_vanna, 4),
        total_charm=round(total_charm, 4),
        profiles=strikes_list,
    )
