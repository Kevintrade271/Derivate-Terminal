"""
Pydantic schemas for request validation and response serialisation.
"""
import re
from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Shared
# ---------------------------------------------------------------------------
TICKER_PATTERN = re.compile(r"^[\^A-Z0-9=]{1,10}$")


class TickerQuery(BaseModel):
    """Validated query parameters for options endpoints."""
    ticker: str = Field(default="^SPX", description="Ticker symbol (e.g. ^SPX, SPY)")
    expiries: int = Field(default=5, ge=1, le=20, description="Number of expiry dates to include")

    @field_validator("ticker")
    @classmethod
    def validate_ticker(cls, v: str) -> str:
        v = v.upper().strip()
        if not TICKER_PATTERN.match(v):
            raise ValueError("Ticker must be 1-10 uppercase alphanumeric characters, optionally starting with ^")
        return v


# ---------------------------------------------------------------------------
# GEX
# ---------------------------------------------------------------------------
class GEXStrike(BaseModel):
    strike: float
    gex_billions: float
    gex_0dte_billions: float = 0.0


class GEXResponse(BaseModel):
    spot_price: float
    call_wall_strike: float
    call_wall_gex: float
    put_wall_strike: float
    put_wall_gex: float
    zero_gamma: float
    vol_trigger: float
    total_gex: float
    total_gex_0dte: float
    absolute_gamma: float
    regime: str  # "POSITIVE" or "NEGATIVE"
    gex_by_strike: list[GEXStrike]


# ---------------------------------------------------------------------------
# GEX Term Structure
# ---------------------------------------------------------------------------
class GEXTermExpiry(BaseModel):
    expiry_date: str
    total_gex_billions: float
    call_gex_billions: float
    put_gex_billions: float

class GEXTermResponse(BaseModel):
    ticker: str
    spot_price: float
    term_structure: list[GEXTermExpiry]


# ---------------------------------------------------------------------------
# DEX
# ---------------------------------------------------------------------------
class DEXStrike(BaseModel):
    strike: float
    dex_billions: float
    call_dex_billions: float
    put_dex_billions: float


class DEXResponse(BaseModel):
    spot_price: float
    max_delta_strike: float
    max_delta_value: float
    total_dex: float
    dex_by_strike: list[DEXStrike]

# ---------------------------------------------------------------------------
# Vanna and Charm
# ---------------------------------------------------------------------------
class VannaCharmStrike(BaseModel):
    strike: float
    vanna_billions: float
    charm_billions: float
    call_vanna: float
    put_vanna: float
    call_charm: float
    put_charm: float

class VannaCharmResponse(BaseModel):
    ticker: str
    spot_price: float
    total_vanna: float
    total_charm: float
    profiles: list[VannaCharmStrike]


# ---------------------------------------------------------------------------
# Open Interest
# ---------------------------------------------------------------------------
class OIStrike(BaseModel):
    strike: float
    call_oi: int
    put_oi: int


class OIResponse(BaseModel):
    spot_price: float
    total_call_oi: int
    total_put_oi: int
    put_call_ratio: float
    oi_by_strike: list[OIStrike]


# ---------------------------------------------------------------------------
# IV Skew
# ---------------------------------------------------------------------------
class IVPoint(BaseModel):
    strike: float
    call_iv: float | None = None
    put_iv: float | None = None


class IVSkewResponse(BaseModel):
    spot_price: float
    expiry_date: str
    iv_points: list[IVPoint]


# ---------------------------------------------------------------------------
# Spot / Price
# ---------------------------------------------------------------------------
class SpotCandle(BaseModel):
    time: int | str  # ISO date string or Unix timestamp
    open: float
    high: float
    low: float
    close: float


class SpotResponse(BaseModel):
    ticker: str
    price: float
    change_pct: float
    candles: list[SpotCandle]
