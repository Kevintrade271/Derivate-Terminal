"""
FastAPI application — Derivatives Dashboard Backend.
Serves GEX, DEX, Open Interest, IV Skew, and Spot data.

Security:
- CORS restricted to localhost:5173 (Vite dev server)
- Security headers on all responses
- Binds to 127.0.0.1 only (never 0.0.0.0)
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from routers.options import router as options_router
from routers.history import router as history_router

from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend

app = FastAPI(
    title="Derivatives Dashboard API",
    description="Quant options analytics: GEX, DEX, IV Skew, Open Interest",
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# CORS — only allow the local Vite dev server
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Security headers middleware
# ---------------------------------------------------------------------------
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
app.include_router(options_router)
app.include_router(history_router)


@app.get("/")
def health():
    return {"status": "ok", "service": "Derivatives Dashboard API"}


@app.on_event("startup")
async def startup():
    FastAPICache.init(InMemoryBackend(), prefix="fastapi-cache")


# ---------------------------------------------------------------------------
# Global exception handler — never leak internal errors
# ---------------------------------------------------------------------------
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )
