# QuantDesk — Derivatives Dashboard 🧪📈

> Dashboard estilo SpotGamma para análisis de derivados SPX: Gamma Exposure (GEX), Delta Exposure (DEX), IV Skew, Open Interest y Spot Chart.

---

## Arquitectura

```
platform/
├── backend/          ← FastAPI (Python)  →  :8000
│   ├── main.py               # Entry point, CORS, middlewares
│   ├── routers/options.py     # Endpoints: /gex, /dex, /oi, /iv-skew, /spot
│   ├── services/
│   │   ├── gex_service.py     # Cálculo de Gamma Exposure (Black-Scholes)
│   │   ├── dex_service.py     # Cálculo de Delta Exposure
│   │   └── greeks.py          # Greeks: Gamma, Delta, Vega, Theta
│   └── models/schemas.py      # Pydantic schemas (request/response)
│
└── frontend/         ← Vite + React + JSX  →  :5173
    └── src/
        ├── App.jsx             # Layout + routing
        ├── api/client.js       # Fetch wrapper al backend
        ├── pages/Dashboard.jsx # Página principal
        └── components/
            ├── GexProfile.jsx      # Gráfico GEX por strike
            ├── DexProfile.jsx      # Gráfico DEX por strike
            ├── OIChart.jsx         # Open Interest calls vs puts
            ├── IVSkew.jsx          # Implied Volatility skew
            ├── SpotChart.jsx       # Candlestick chart (lightweight-charts)
            ├── KeyLevels.jsx       # Call Wall, Put Wall, Zero Gamma
            ├── Header.jsx          # Barra superior con precio spot
            ├── Sidebar.jsx         # Navegación lateral
            └── RegimeIndicator.jsx # Indicador de régimen γ
```

---

## Prerrequisitos

| Herramienta | Versión mínima | Verificar |
|-------------|---------------|-----------|
| **Python**  | 3.10+         | `python --version` |
| **Node.js** | 18+           | `node --version` |
| **npm**     | 9+            | `npm --version` |
| **pip**     | 22+           | `pip --version` |

---

## 1. Backend (FastAPI)

### Instalar dependencias

Abre una terminal y dirígete a la carpeta raíz del proyecto. Si usas el entorno virtual del proyecto (recomendado), actívalo antes de instalar las dependencias:

```powershell
cd "C:\Users\Kv\Desktop\Quant Project I"
.\venv\Scripts\activate
cd platform\backend
pip install -r requirements.txt
```

> **Dependencias:** `fastapi[standard]`, `yfinance`, `pandas`, `numpy`, `scipy`

### Arrancar el servidor

Con el entorno virtual activado y dentro de la carpeta `platform\backend`, ejecuta uvicorn:

```powershell
cd "C:\Users\Kv\Desktop\Quant Project I\platform\backend"
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### Verificar que funciona

Abre el navegador en:

| URL | Descripción |
|-----|-------------|
| http://127.0.0.1:8000 | Health check → `{"status": "ok"}` |
| http://127.0.0.1:8000/docs | Swagger UI (documentación interactiva) |
| http://127.0.0.1:8000/api/gex | GEX profile para ^SPX |
| http://127.0.0.1:8000/api/dex | DEX profile para ^SPX |
| http://127.0.0.1:8000/api/oi | Open Interest por strike |
| http://127.0.0.1:8000/api/iv-skew | IV Skew de la expiración más cercana |
| http://127.0.0.1:8000/api/spot | Precio spot + candles 6M |

---

## 2. Frontend (Vite + React)

### Instalar dependencias

Abre una nueva terminal, dirígete a la carpeta del frontend y ejecuta `npm install`:

```powershell
cd "C:\Users\Kv\Desktop\Quant Project I\platform\frontend"
npm install
```

> **Dependencias:** `react-router-dom`, `recharts`, `lightweight-charts`

### Arrancar el dev server

```powershell
cd "C:\Users\Kv\Desktop\Quant Project I\platform\frontend"
npm run dev
```

El frontend se levanta en **http://localhost:5173**

---

## 3. Arrancar Todo (Quick Start)

Abre **dos terminales** y ejecuta:

### Terminal 1 — Backend
```powershell
cd "C:\Users\Kv\Desktop\Quant Project I"
.\venv\Scripts\activate
cd platform\backend
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### Terminal 2 — Frontend
```powershell
cd "C:\Users\Kv\Desktop\Quant Project I\platform\frontend"
npm run dev
```

Luego abre **http://localhost:5173** en el navegador.

---

## API Endpoints

| Método | Endpoint | Params | Descripción |
|--------|----------|--------|-------------|
| `GET` | `/api/gex` | `ticker` (def: `^SPX`), `expiries` (def: 5) | Gamma Exposure por strike |
| `GET` | `/api/dex` | `ticker`, `expiries` | Delta Exposure por strike |
| `GET` | `/api/oi` | `ticker`, `expiries` (def: 3) | Open Interest calls vs puts |
| `GET` | `/api/iv-skew` | `ticker`, `expiry` (def: 0 = nearest) | IV Skew de una expiración |
| `GET` | `/api/spot` | `ticker` | Precio actual + candles 6M diarios |

> ⚠️ Tickers soportados: formato `^SPX`, `AAPL`, `^NDX`, etc. (regex: `^[\^A-Z0-9]{1,10}$`)

---

## Seguridad

- **CORS** restringido a `localhost:5173` y `127.0.0.1:5173` únicamente
- Backend bindeado a `127.0.0.1` (nunca `0.0.0.0`)
- Headers de seguridad: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`
- Solo métodos `GET` permitidos
- Errores internos nunca se filtran al cliente

---

## Troubleshooting

### El frontend muestra "No se pudo conectar con el backend"

1. Verifica que el backend esté corriendo: `curl http://127.0.0.1:8000`
2. Revisa que el puerto 8000 no esté ocupado: `netstat -aon | findstr :8000`

### yfinance no retorna datos de opciones

- Los datos de opciones solo están disponibles durante horas de mercado (o con caché reciente)
- Algunos tickers no tienen options chain (ej: ETFs de otros países)
- Prueba con `AAPL` o `SPY` si `^SPX` falla

### Error al instalar dependencias Python

Asegúrate de tener activado el entorno virtual correcto antes de instalar las dependencias.

```powershell
cd "C:\Users\Kv\Desktop\Quant Project I"
.\venv\Scripts\activate
cd platform\backend
pip install -r requirements.txt
```

### El frontend no encuentra React

```powershell
cd platform\frontend
npm install
# Si sigue fallando:
rm -rf node_modules package-lock.json
npm install
```

---

## Stack Técnico

| Capa | Tecnología |
|------|-----------|
| **Backend** | FastAPI + Uvicorn |
| **Data** | yfinance (Yahoo Finance API) |
| **Greeks** | Black-Scholes (custom, `scipy.stats.norm`) |
| **Frontend** | Vite + React (JSX) |
| **Charts** | Recharts (barras, áreas) + Lightweight Charts (candlestick) |
| **Routing** | React Router DOM v7 |
