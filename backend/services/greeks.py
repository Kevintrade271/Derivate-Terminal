"""
Black-Scholes Greeks calculator.
All functions assume European-style options.
"""
import numpy as np
from scipy.stats import norm


def calc_d1(S: float, K: float, T: float, r: float, sigma: float) -> float:
    """Calculate d1 from the Black-Scholes formula."""
    return (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))


def calc_d2(S: float, K: float, T: float, r: float, sigma: float) -> float:
    """Calculate d2 from the Black-Scholes formula."""
    return calc_d1(S, K, T, r, sigma) - sigma * np.sqrt(T)


def calc_gamma(S: float, K: float, T: float, r: float, sigma: float) -> float:
    """
    Gamma: rate of change of delta w.r.t. underlying price.
    Same for calls and puts.
    """
    if T <= 0 or sigma <= 0 or np.isnan(sigma):
        return 0.0
    d1 = calc_d1(S, K, T, r, sigma)
    return norm.pdf(d1) / (S * sigma * np.sqrt(T))


def calc_delta(S: float, K: float, T: float, r: float, sigma: float, option_type: str) -> float:
    """
    Delta: rate of change of option price w.r.t. underlying price.
    option_type: 'call' or 'put'
    """
    if T <= 0 or sigma <= 0 or np.isnan(sigma):
        return 0.0
    d1 = calc_d1(S, K, T, r, sigma)
    if option_type == "call":
        return norm.cdf(d1)
    else:
        return norm.cdf(d1) - 1.0


def calc_vega(S: float, K: float, T: float, r: float, sigma: float) -> float:
    """
    Vega: sensitivity of option price to changes in IV.
    Same for calls and puts. Returned per 1% move in vol.
    """
    if T <= 0 or sigma <= 0 or np.isnan(sigma):
        return 0.0
    d1 = calc_d1(S, K, T, r, sigma)
    return S * norm.pdf(d1) * np.sqrt(T) * 0.01


def calc_theta(S: float, K: float, T: float, r: float, sigma: float, option_type: str) -> float:
    """
    Theta: time decay per calendar day.
    """
    if T <= 0 or sigma <= 0 or np.isnan(sigma):
        return 0.0
    d1 = calc_d1(S, K, T, r, sigma)
    d2 = calc_d2(S, K, T, r, sigma)

    common = -(S * norm.pdf(d1) * sigma) / (2 * np.sqrt(T))
    if option_type == "call":
        theta = common - r * K * np.exp(-r * T) * norm.cdf(d2)
    else:
        theta = common + r * K * np.exp(-r * T) * norm.cdf(-d2)

    # Convert from per-year to per-calendar-day
    return theta / 365.0


def calc_vanna(S: float, K: float, T: float, r: float, sigma: float, option_type: str) -> float:
    """
    Vanna: sensitivity of delta to changes in IV. (dDelta / dVol)
    Calculated via finite difference. Returned per 1% move in vol.
    """
    if T <= 0 or sigma <= 0 or np.isnan(sigma):
        return 0.0
    bump = 0.01
    delta_up = calc_delta(S, K, T, r, sigma + bump, option_type)
    delta_down = calc_delta(S, K, T, r, max(sigma - bump, 0.0001), option_type)
    return (delta_up - delta_down) / (2 * bump) * 0.01


def calc_charm(S: float, K: float, T: float, r: float, sigma: float, option_type: str) -> float:
    """
    Charm (Delta Decay): rate of change of delta over time. (dDelta / dT)
    Calculated via finite difference. Returned per 1 day passing.
    """
    if T <= 0 or sigma <= 0 or np.isnan(sigma):
        return 0.0
    bump = 1 / 365.0
    if T <= bump:
        return 0.0
    # As time passes, time to expiration (T) decreases
    delta_now = calc_delta(S, K, T, r, sigma, option_type)
    delta_tmr = calc_delta(S, K, max(T - bump, 0.0001), r, sigma, option_type)
    return (delta_tmr - delta_now)
