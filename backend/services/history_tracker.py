import json
import os
import datetime
import yfinance as yf
import pandas as pd
from services.gex_service import get_gex_profile
from services.dex_service import get_dex_profile

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data")
HISTORY_FILE = os.path.join(DATA_DIR, "history.json")

def get_total_oi(ticker: str, expiries: int = 3):
    asset = yf.Ticker(ticker)
    options_dates = asset.options
    if not options_dates:
        return 0, 0

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
        return 0, 0

    df_calls = pd.concat(all_calls)
    df_puts = pd.concat(all_puts)
    
    total_call_oi = int(df_calls["openInterest"].sum())
    total_put_oi = int(df_puts["openInterest"].sum())
    return total_call_oi, total_put_oi

def update_daily_history(ticker: str = "^SPX"):
    """
    Fetches the current GEX, DEX, and OI for the ticker and appends it to the history.json file.
    """
    os.makedirs(DATA_DIR, exist_ok=True)
    
    try:
        # Fetch data
        gex_data = get_gex_profile(ticker, expiry_count=5)
        dex_data = get_dex_profile(ticker, expiry_count=5)
        call_oi, put_oi = get_total_oi(ticker, expiries=3)
        
        today_str = datetime.datetime.now().strftime("%Y-%m-%d")
        
        record = {
            "date": today_str,
            "ticker": ticker,
            "spot_price": gex_data.spot_price,
            "total_gex": gex_data.total_gex,
            "total_gex_0dte": gex_data.total_gex_0dte,
            "total_dex": dex_data.total_dex if hasattr(dex_data, 'total_dex') else 0,
            "call_oi": call_oi,
            "put_oi": put_oi,
            "total_oi": call_oi + put_oi
        }
        
        # Calculate total DEX if it doesn't exist directly on the model
        if not hasattr(dex_data, 'total_dex'):
            record["total_dex"] = round(sum([s.dex_billions for s in dex_data.dex_by_strike]), 4)
            
        history = {}
        if os.path.exists(HISTORY_FILE):
            try:
                with open(HISTORY_FILE, "r") as f:
                    history = json.load(f)
            except Exception:
                pass
                
        if ticker not in history:
            history[ticker] = []
            
        # Update or append today's record
        updated = False
        for i, item in enumerate(history[ticker]):
            if item["date"] == today_str:
                history[ticker][i] = record
                updated = True
                break
                
        if not updated:
            history[ticker].append(record)
            
        # Keep only last 365 records
        history[ticker] = history[ticker][-365:]
            
        with open(HISTORY_FILE, "w") as f:
            json.dump(history, f, indent=4)
            
        return record
    except Exception as e:
        print(f"Error updating history for {ticker}: {e}")
        raise e

def get_history(ticker: str = "^SPX"):
    if not os.path.exists(HISTORY_FILE):
        return []
    try:
        with open(HISTORY_FILE, "r") as f:
            history = json.load(f)
            return history.get(ticker, [])
    except Exception:
        return []
