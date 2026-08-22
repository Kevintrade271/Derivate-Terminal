"""
Retrieves delayed quotes for option chain data from CBOE's API
    
It reuses the same code from OpenBB 
(https://github.com/OpenBB-finance/OpenBBTerminal)
"""

from datetime import datetime
import random
import requests
from typing import Tuple
import pandas as pd
import time
import threading

_quotes_cache = {}
_quotes_lock = threading.Lock()


TICKER_EXCEPTIONS: list[str] = ["NDX", "RUT"]


def get_user_agent() -> str:
    """Get a not very random user agent."""
    user_agent_strings = [
        "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10.10; rv:86.1) Gecko/20100101 Firefox/86.1",
        "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:86.1) Gecko/20100101 Firefox/86.1",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.10; rv:82.1) Gecko/20100101 Firefox/82.1",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.13; rv:86.0) Gecko/20100101 Firefox/86.0",
        "Mozilla/5.0 (Windows NT 10.0; WOW64; rv:86.0) Gecko/20100101 Firefox/86.0",
        "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10.10; rv:83.0) Gecko/20100101 Firefox/83.0",
        "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:84.0) Gecko/20100101 Firefox/84.0",
    ]

    return random.choice(user_agent_strings)  # nosec # noqa: S311


# Write an abstract helper to make requests from a url with potential headers and params
def request(
    url: str, method: str = "get", timeout: int = 30, **kwargs
) -> requests.Response:
    """Abstract helper to make requests from a url with potential headers and params.

    Parameters
    ----------
    url : str
        Url to make the request to
    method : str
        HTTP method to use.  Choose from:
        delete, get, head, patch, post, put, by default "get"
    timeout : int
        How many seconds to wait for the server to send data

    Returns
    -------
    requests.Response
        Request response object

    Raises
    ------
    ValueError
        If invalid method is passed
    """
    method = method.lower()
    if method not in ["delete", "get", "head", "patch", "post", "put"]:
        raise ValueError(f"Invalid method: {method}")
    # We want to add a user agent to the request, so check if there are any headers
    # If there are headers, check if there is a user agent, if not add one.
    # Some requests seem to work only with a specific user agent, so we want to be able to override it.
    headers = kwargs.pop("headers", {})
    timeout = timeout 

    if "User-Agent" not in headers:
        headers["User-Agent"] = get_user_agent()
    func = getattr(requests, method)
    return func(
        url,
        headers=headers,
        timeout=timeout,
        **kwargs,
    )


def get_cboe_directory() -> pd.DataFrame:
    """Gets the US Listings Directory for the CBOE.

    Returns
    -------
    pd.DataFrame: CBOE_DIRECTORY
        DataFrame of the CBOE listings directory

    Examples
    -------
    >>> from openbb_terminal.stocks.options import cboe_model
    >>> CBOE_DIRECTORY = cboe_model.get_cboe_directory()
    """
    try:
        CBOE_DIRECTORY: pd.DataFrame = pd.read_csv(
            "https://www.cboe.com/us/options/symboldir/equity_index_options/?download=csv"
        )
        CBOE_DIRECTORY = CBOE_DIRECTORY.rename(
            columns={
                " Stock Symbol": "Symbol",
                " DPM Name": "DPM Name",
                " Post/Station": "Post/Station",
            }
        ).set_index("Symbol")

        return CBOE_DIRECTORY

    except requests.exceptions.HTTPError:
        return pd.DataFrame()
    
    
def get_cboe_index_directory() -> pd.DataFrame:
    """Gets the US Listings Directory for the CBOE

    Returns
    -------
    pd.DataFrame: CBOE_INDEXES

    Examples
    -------
    >>> from openb_terminal.stocks.options import cboe_model
    >>> CBOE_INDEXES = cboe_model.get_cboe_index_directory()
    """

    try:
        CBOE_INDEXES: pd.DataFrame = pd.DataFrame(
            pd.read_json(
                "https://cdn.cboe.com/api/global/us_indices/definitions/all_indices.json"
            )
        )

        CBOE_INDEXES = CBOE_INDEXES.rename(
            columns={
                "calc_end_time": "Close Time",
                "calc_start_time": "Open Time",
                "currency": "Currency",
                "description": "Description",
                "display": "Display",
                "featured": "Featured",
                "featured_order": "Featured Order",
                "index_symbol": "Ticker",
                "mkt_data_delay": "Data Delay",
                "name": "Name",
                "tick_days": "Tick Days",
                "tick_frequency": "Frequency",
                "tick_period": "Period",
                "time_zone": "Time Zone",
            },
        )

        indices_order: list[str] = [
            "Ticker",
            "Name",
            "Description",
            "Currency",
            "Tick Days",
            "Frequency",
            "Period",
            "Time Zone",
        ]

        CBOE_INDEXES = pd.DataFrame(CBOE_INDEXES, columns=indices_order).set_index(
            "Ticker"
        )

        return CBOE_INDEXES

    except requests.exceptions.HTTPError:
        return pd.DataFrame()


# Default set of known CBOE Index symbols that require an underscore in the URL (e.g. _SPX.json)
DEFAULT_INDEXES: set[str] = {"SPX", "VIX", "RUT", "NDX", "DJX", "XSP", "OEX", "MXEA", "MXEF", "MRUT"}
_indexes_cache = None


def get_indexes_set() -> set[str]:
    """Returns the set of index symbols without blocking module import."""
    global _indexes_cache
    if _indexes_cache is None:
        _indexes_cache = set(DEFAULT_INDEXES)
    return _indexes_cache


INDEXES = DEFAULT_INDEXES
SYMBOLS = pd.DataFrame()


def get_ticker_info(symbol: str) -> Tuple[pd.DataFrame, list[str]]:
    """Gets basic info for the symbol and expiration dates

    Parameters
    ----------
    symbol: str
        The ticker to lookup

    Returns
    -------
    Tuple: [pd.DataFrame, pd.Series]
        ticker_details
        ticker_expirations

    Examples
    --------
    >>> from openbb_terminal.stocks.options import cboe_model
    >>> ticker_details,ticker_expirations = cboe_model.get_ticker_info('AAPL')
    >>> vix_details,vix_expirations = cboe_model.get_ticker_info('VIX')
    """

    stock = "stock"
    index = "index"
    symbol = symbol.upper()
    new_ticker: str = ""
    ticker_details = pd.DataFrame()
    ticker_expirations: list = []
    try:
        if symbol in TICKER_EXCEPTIONS:
            new_ticker = "^" + symbol
        elif symbol not in INDEXES:
            new_ticker = symbol

        elif symbol in INDEXES:
            new_ticker = "^" + symbol

            # Gets the data to return, and if none returns empty Tuple #

        symbol_info_url = (
            "https://www.cboe.com/education/tools/trade-optimizer/symbol-info/?symbol="
            f"{new_ticker}"
        )

        symbol_info = request(symbol_info_url)
        symbol_info_json = symbol_info.json()
        symbol_info_json = pd.Series(symbol_info.json())

        if symbol_info_json.success is False:
            ticker_details = pd.DataFrame()
            ticker_expirations = []
            print("No data found for the symbol: " f"{symbol}" "")
        else:
            symbol_details = pd.Series(symbol_info_json["details"])
            symbol_details = pd.DataFrame(symbol_details).transpose()
            symbol_details = symbol_details.reset_index()
            ticker_expirations = symbol_info_json["expirations"]

            # Cleans columns depending on if the security type is a stock or an index

            type_ = symbol_details.security_type

            if stock[0] in type_[0]:
                stock_details = symbol_details
                ticker_details = pd.DataFrame(stock_details).rename(
                    columns={
                        "current_price": "price",
                        "bid_size": "bidSize",
                        "ask_size": "askSize",
                        "iv30": "ivThirty",
                        "prev_day_close": "previousClose",
                        "price_change": "change",
                        "price_change_percent": "changePercent",
                        "iv30_change": "ivThirtyChange",
                        "iv30_percent_change": "ivThirtyChangePercent",
                        "last_trade_time": "lastTradeTimestamp",
                        "exchange_id": "exchangeID",
                        "tick": "tick",
                        "security_type": "type",
                    }
                )
                details_columns = [
                    "symbol",
                    "type",
                    "tick",
                    "bid",
                    "bidSize",
                    "askSize",
                    "ask",
                    "price",
                    "open",
                    "high",
                    "low",
                    "close",
                    "volume",
                    "previousClose",
                    "change",
                    "changePercent",
                    "ivThirty",
                    "ivThirtyChange",
                    "ivThirtyChangePercent",
                    "lastTradeTimestamp",
                ]
                ticker_details = (
                    pd.DataFrame(ticker_details, columns=details_columns)
                    .set_index(keys="symbol")
                    .dropna(axis=1)
                    .transpose()
                )

            if index[0] in type_[0]:
                index_details = symbol_details
                ticker_details = pd.DataFrame(index_details).rename(
                    columns={
                        "symbol": "symbol",
                        "security_type": "type",
                        "current_price": "price",
                        "price_change": "change",
                        "price_change_percent": "changePercent",
                        "prev_day_close": "previousClose",
                        "iv30": "ivThirty",
                        "iv30_change": "ivThirtyChange",
                        "iv30_change_percent": "ivThirtyChangePercent",
                        "last_trade_time": "lastTradeTimestamp",
                    }
                )

                index_columns = [
                    "symbol",
                    "type",
                    "tick",
                    "price",
                    "open",
                    "high",
                    "low",
                    "close",
                    "previousClose",
                    "change",
                    "changePercent",
                    "ivThirty",
                    "ivThirtyChange",
                    "ivThirtyChangePercent",
                    "lastTradeTimestamp",
                ]

                ticker_details = (
                    pd.DataFrame(ticker_details, columns=index_columns)
                    .set_index(keys="symbol")
                    .dropna(axis=1)
                    .transpose()
                ).rename(columns={f"{new_ticker}": f"{symbol}"})

    except requests.exceptions.HTTPError:
        print("There was an error with the request'\n")
        ticker_details = pd.DataFrame()
        ticker_expirations = list()
        return ticker_details, ticker_expirations

    return ticker_details, ticker_expirations

def get_ticker_iv(symbol: str) -> pd.DataFrame:
    """Gets annualized high/low historical and implied volatility over 30/60/90 day windows.

    Parameters
    ----------
    symbol: str
        The loaded ticker

    Returns
    -------
    pd.DataFrame: ticker_iv

    Examples
    --------
    >>> from openbb_terminal.stocks.options import cboe_model
    >>> ticker_iv = cboe_model.get_ticker_iv('AAPL')
    >>> ndx_iv = cboe_model.get_ticker_iv('NDX')
    """

    # Checks ticker to determine if ticker is an index or an exception that requires modifying the request's URLs
    try:
        if symbol in TICKER_EXCEPTIONS:
            quotes_iv_url = (
                "https://cdn.cboe.com/api/global/delayed_quotes/historical_data/_"
                f"{symbol}.json"
            )
        elif symbol not in INDEXES:
            quotes_iv_url = (
                "https://cdn.cboe.com/api/global/delayed_quotes/historical_data/"
                f"{symbol}.json"
            )

        elif symbol in INDEXES:
            quotes_iv_url = (
                "https://cdn.cboe.com/api/global/delayed_quotes/historical_data/_"
                f"{symbol}.json"
            )
        h_iv = request(quotes_iv_url)

        if h_iv.status_code != 200:
            print("No data found for the symbol: " f"{symbol}" "")
            return pd.DataFrame()

        data = h_iv.json()
        h_data = pd.DataFrame(data)[2:-1]["data"].rename(f"{symbol}")
        h_data.rename(
            {
                "hv30_annual_high": "hvThirtyOneYearHigh",
                "hv30_annual_low": "hvThirtyOneYearLow",
                "hv60_annual_high": "hvSixtyOneYearHigh",
                "hv60_annual_low": "hvsixtyOneYearLow",
                "hv90_annual_high": "hvNinetyOneYearHigh",
                "hv90_annual_low": "hvNinetyOneYearLow",
                "iv30_annual_high": "ivThirtyOneYearHigh",
                "iv30_annual_low": "ivThirtyOneYearLow",
                "iv60_annual_high": "ivSixtyOneYearHigh",
                "iv60_annual_low": "ivSixtyOneYearLow",
                "iv90_annual_high": "ivNinetyOneYearHigh",
                "iv90_annual_low": "ivNinetyOneYearLow",
            },
            inplace=True,
        )

        iv_order = [
            "ivThirtyOneYearHigh",
            "hvThirtyOneYearHigh",
            "ivThirtyOneYearLow",
            "hvThirtyOneYearLow",
            "ivSixtyOneYearHigh",
            "hvSixtyOneYearHigh",
            "ivSixtyOneYearLow",
            "hvsixtyOneYearLow",
            "ivNinetyOneYearHigh",
            "hvNinetyOneYearHigh",
            "ivNinetyOneYearLow",
            "hvNinetyOneYearLow",
        ]

        ticker_iv = pd.DataFrame(h_data).transpose()
    except requests.exceptions.HTTPError:
        print("There was an error with the request'\n")

    return pd.DataFrame(ticker_iv, columns=iv_order).transpose()

_quotes_cache = {}
_quotes_cache_lock = threading.Lock()
_symbol_fetch_locks = {}
_symbol_fetch_master_lock = threading.Lock()


def get_symbol_lock(symbol: str) -> threading.Lock:
    with _symbol_fetch_master_lock:
        if symbol not in _symbol_fetch_locks:
            _symbol_fetch_locks[symbol] = threading.Lock()
        return _symbol_fetch_locks[symbol]


def get_quotes(symbol: str) -> pd.DataFrame:
    """Gets the complete options chains for a ticker with single-flight coalescing and caching."""
    global _quotes_cache
    clean_sym = symbol.upper().replace("^", "")
    fetch_time = time.time()
    
    # 1. Quick check from cache
    with _quotes_cache_lock:
        if clean_sym in _quotes_cache:
            cache_time, spot, df = _quotes_cache[clean_sym]
            if fetch_time - cache_time < 60 and not df.empty:
                return df.copy()

    # 2. Acquire per-symbol single-flight lock (so ONLY 1 thread downloads SPY)
    sym_lock = get_symbol_lock(clean_sym)
    with sym_lock:
        # Double-check cache in case another thread just completed the download
        with _quotes_cache_lock:
            if clean_sym in _quotes_cache:
                cache_time, spot, df = _quotes_cache[clean_sym]
                if time.time() - cache_time < 60 and not df.empty:
                    return df.copy()

        # 3. Only the winning thread downloads from CBOE!
        try:
            if clean_sym in TICKER_EXCEPTIONS or clean_sym in DEFAULT_INDEXES:
                quotes_url = f"https://cdn.cboe.com/api/global/delayed_quotes/options/_{clean_sym}.json"
            else:
                quotes_url = f"https://cdn.cboe.com/api/global/delayed_quotes/options/{clean_sym}.json"

            print(f"[{time.strftime('%X')}] Fetching options chain for {clean_sym} from CBOE (single-flight)...", flush=True)
            r = request(quotes_url, timeout=20)
            if r.status_code != 200:
                print(f"No data found for symbol: {clean_sym} (HTTP {r.status_code})")
                return pd.DataFrame()

            r_json = r.json()
            raw_data = r_json.get("data", {})
            raw_options = raw_data.get("options", [])
            if not raw_options:
                return pd.DataFrame()

            spot_price = float(raw_data.get("current_price") or raw_data.get("close") or raw_data.get("prev_day_close") or 0.0)

            options_df = pd.DataFrame(raw_options)
            options_df = options_df.rename(
                columns={
                    "option": "contractSymbol",
                    "bid_size": "bidSize",
                    "ask_size": "askSize",
                    "iv": "impliedVolatility",
                    "open_interest": "openInterest",
                    "theo": "theoretical",
                    "last_trade_price": "lastTradePrice",
                    "last_trade_time": "lastTradeTimestamp",
                    "percent_change": "changePercent",
                    "prev_day_close": "previousClose",
                }
            )

            # Vectorized OCC Symbol parser
            extracted = options_df["contractSymbol"].str.extract(
                r"^(?P<Ticker>[A-Za-z]+)(?P<expiration>\d{6})(?P<optionType>[CP])(?P<strike>\d{8})$"
            )
            if extracted["strike"].isnull().all():
                extracted = options_df["contractSymbol"].str.extract(
                    r"^(?P<Ticker>[A-Za-z0-9]+)(?P<expiration>\d{6})(?P<optionType>[CP])(?P<strike>\d+)$"
                )

            extracted["strike"] = pd.to_numeric(extracted["strike"], errors="coerce").fillna(0.0) / 1000.0
            extracted["optionType"] = extracted["optionType"].map({"C": "call", "P": "put"}).fillna("call")
            exp_str = extracted["expiration"].astype(str)
            extracted["expiration"] = "20" + exp_str.str[0:2] + "-" + exp_str.str[2:4] + "-" + exp_str.str[4:6]

            quotes = pd.concat([extracted[["expiration", "strike", "optionType"]], options_df], axis=1)

            now = datetime.now()
            exp_dates = pd.to_datetime(quotes["expiration"], errors="coerce")
            quotes["dte"] = ((exp_dates - now).dt.total_seconds() / 86400.0).clip(lower=0).round().astype(int)

            quotes["openInterest"] = pd.to_numeric(quotes.get("openInterest", 0), errors="coerce").fillna(0).astype(int)
            quotes["volume"] = pd.to_numeric(quotes.get("volume", 0), errors="coerce").fillna(0).astype(int)
            quotes["bidSize"] = pd.to_numeric(quotes.get("bidSize", 0), errors="coerce").fillna(0).astype(int)
            quotes["askSize"] = pd.to_numeric(quotes.get("askSize", 0), errors="coerce").fillna(0).astype(int)
            quotes["impliedVolatility"] = pd.to_numeric(quotes.get("impliedVolatility", 0), errors="coerce").fillna(0.0)

            final_df = quotes.sort_values(by=["expiration", "strike", "optionType"]).reset_index(drop=True)
            with _quotes_cache_lock:
                _quotes_cache[clean_sym] = (time.time(), spot_price, final_df)
            return final_df.copy()

        except Exception as e:
            print("There was an error with the request or parsing:", e)
            return pd.DataFrame()


def get_spot_and_quotes(symbol: str) -> tuple[float, pd.DataFrame]:
    """Returns (spot_price, quotes_df) directly from CBOE avoiding slow extra yfinance calls."""
    df = get_quotes(symbol)
    clean_sym = symbol.upper().replace("^", "")
    with _quotes_cache_lock:
        if clean_sym in _quotes_cache:
            _, spot, _ = _quotes_cache[clean_sym]
            if spot > 0:
                return spot, df
    # Fallback to yfinance if spot is not present
    try:
        import yfinance as yf
        asset = yf.Ticker(symbol)
        hist = asset.history(period="1d")
        spot_price = float(hist["Close"].iloc[-1]) if not hist.empty else 0.0
        return spot_price, df
    except Exception:
        return 0.0, df
