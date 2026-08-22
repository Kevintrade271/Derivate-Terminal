from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from models.schemas import TickerQuery
from services.history_tracker import get_history, update_daily_history
from typing import List, Dict, Any

router = APIRouter(prefix="/api/history", tags=["history"])

@router.get("/{ticker}", response_model=List[Dict[str, Any]])
def get_ticker_history(ticker: str):
    """Get the recorded historical sessions for a ticker."""
    try:
        data = get_history(ticker)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{ticker}/update")
def trigger_history_update(ticker: str, background_tasks: BackgroundTasks):
    """Manually trigger a history update for a ticker (usually called at EOD)."""
    try:
        # Run it in the background as it can take a few seconds
        background_tasks.add_task(update_daily_history, ticker)
        return {"status": "update_initiated", "ticker": ticker}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
