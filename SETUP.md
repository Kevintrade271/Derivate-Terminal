# QuantDesk — Quantitative Derivatives Terminal 🧪📈

> **Terminal institucional de análisis cuantitativo de derivados financieros (SPX, SPY, QQQ, NDX)**. Modela en tiempo real el posicionamiento de los Market Makers (*Dealer Positioning*), exposición de griegas de segundo orden (*Gamma, Delta, Vanna, Charm*), estructuras temporales de volatilidad implícita (*IV Skew, Term Structure*), mapas de calor y niveles clave de liquidez.

---

## 📑 Tabla de Contenidos
1. [Arquitectura del Sistema](#-arquitectura-del-sistema)
2. [Guía de Instalación y Ejecución Rápida](#-guía-de-instalación-y-ejecución-rápida)
3. [Endpoints de la API (Backend FastAPI)](#-endpoints-de-la-api-backend-fastapi)
4. [Módulos y Funciones de la Terminal](#-módulos-y-funciones-de-la-terminal)
5. [Fundamentos Cuantitativos y Aplicaciones Prácticas de Trading](#-fundamentos-cuantitativos-y-aplicaciones-prácticas-de-trading)
6. [Resolución de Problemas (Troubleshooting)](#-resolución-de-problemas-troubleshooting)

---

## 🏛 Arquitectura del Sistema

```
platform/
├── backend/                  ← FastAPI Engine (Python 3.10+) → http://127.0.0.1:8000
│   ├── main.py               # Servidor FastAPI, CORS, middlewares de seguridad
│   ├── routers/
│   │   ├── options.py        # Endpoints: /gex, /gex-term, /dex, /vanna-charm, /oi, /iv-skew, /iv-term, /gex-heatmap, /spot
│   │   └── history.py        # Endpoints: /history/{ticker}, /history/{ticker}/update
│   ├── services/
│   │   ├── cboe_data.py      # Conector CBOE con Single-Flight Coalescing y caché en memoria
│   │   ├── gex_service.py    # Motor GEX, Term Structure, Heatmap, Call/Put Wall, Zero Gamma
│   │   ├── dex_service.py    # Motor DEX (Delta Exposure) y Max Delta Strike
│   │   ├── vanna_charm_service.py # Motor de Vanna (dDelta/dVol) y Charm (dDelta/dTime)
│   │   ├── greeks.py         # Fórmulas Black-Scholes vectorizadas (Gamma, Delta, Vega, Theta, Vanna, Charm)
│   │   └── history_tracker.py# Persistencia de sesiones históricas
│   └── models/schemas.py     # Esquemas de validación Pydantic
│
└── frontend/                 ← React 18 + Vite + Tailwind/Tremor → http://localhost:5173
    └── src/
        ├── api/client.js     # Cliente API HTTP y endpoints unificados
        ├── pages/
        │   └── Dashboard.jsx # Layout del Dashboard en Vivo y multi-activo
        └── components/
            ├── SpotChart.jsx          # Gráfico de velas (TradingView Lightweight Charts) + Niveles GEX
            ├── KeyLevels.jsx          # Tarjetas de Call Wall, Put Wall, Zero Gamma y Vol Trigger
            ├── DealerSummary.jsx      # Resumen de exposición consolidada y régimen de mercado
            ├── ExpectedMoveGauge.jsx  # Indicador de Movimiento Esperado (1D / 1W) basado en ATM IV
            ├── GexProfile.jsx         # Perfil de Gamma por Strike (Net GEX & 0DTE)
            ├── GexTermStructure.jsx   # Estructura temporal de Gamma por Expiración
            ├── GEXHeatmap.jsx         # Mapa de calor de Gamma (Strike × Fecha de Expiración)
            ├── DexProfile.jsx         # Perfil de Delta Exposure (DEX) Calls vs Puts
            ├── VannaCharmProfile.jsx  # Exposición de Vanna y Charm por strike
            ├── OIChart.jsx            # Distribución de Interés Abierto (Call OI vs Put OI)
            ├── PCRatioHistory.jsx     # Historial y ratio Put/Call
            ├── IVSkew.jsx             # Curva de Volatilidad Implícita (Smile / Skew)
            ├── IVTermStructure.jsx    # Estructura temporal de IV (Contango vs Backwardation)
            └── VolumeProfile.jsx      # Perfil de volumen de contratos por strike
```

---

## ⚡ Guía de Instalación y Ejecución Rápida

### Prerrequisitos
- **Python 3.10+** (`python --version`)
- **Node.js 18+** y **npm 9+** (`node -v` y `npm -v`)

---

### Paso 1: Configurar y Ejecutar el Backend (FastAPI)

Abre tu terminal (PowerShell o CMD) y ejecuta:

```powershell
# 1. Navegar al proyecto y activar el entorno virtual
cd "C:\Users\Kv\Desktop\Quant Project I"
.\venv\Scripts\activate

# 2. Entrar a la carpeta del backend
cd platform\backend

# 3. Instalar dependencias si es la primera vez
pip install -r requirements.txt

# 4. Iniciar el servidor
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

> **Verificación del Backend:** Abre [http://127.0.0.1:8000](http://127.0.0.1:8000) (debe responder `{"status":"ok"}`) o la documentación interactiva en [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

---

### Paso 2: Configurar y Ejecutar el Frontend (Vite + React)

Abre una **segunda terminal**:

```powershell
# 1. Navegar a la carpeta del frontend
cd "C:\Users\Kv\Desktop\Quant Project I\platform\frontend"

# 2. Instalar dependencias de Node si es la primera vez
npm install

# 3. Iniciar el servidor de desarrollo
npm run dev
```

> Abre tu navegador en **`http://localhost:5173`**.

---

## 📡 Endpoints de la API (Backend FastAPI)

Todos los endpoints soportan tickers como `SPY`, `QQQ`, `^SPX`, `^NDX`, `AAPL`, etc.

| Método | Ruta | Parámetros | Descripción |
|---|---|---|---|
| `GET` | `/api/gex` | `ticker=SPY`, `expiries=5` | Perfil de Gamma Exposure por strike, Call Wall, Put Wall, Zero Gamma y Vol Trigger. |
| `GET` | `/api/gex-term` | `ticker=SPY`, `expiries=15` | Estructura temporal de Gamma (GEX neto, Call GEX y Put GEX por fecha de expiración). |
| `GET` | `/api/gex-heatmap` | `ticker=SPY`, `expiries=8` | Matriz bidimensional de Gamma (Strike × Expiración) para visualización en mapa de calor. |
| `GET` | `/api/dex` | `ticker=SPY`, `expiries=5` | Perfil de Delta Exposure (DEX) y cálculo del `Max Delta Strike`. |
| `GET` | `/api/dex-change` | `ticker=SPY`, `expiries=5`, `window=300` | Cambios de Delta y Delta Flow por strike (presión compradora/vendedora forzada de los MMs). |
| `GET` | `/api/trace` | `ticker=SPY`, `interval=5m` | SpotGamma TRACE: Flujo acumulado de Delta (Cumulative Delta Flow) y detección de divergencias intradiarias. |
| `GET` | `/api/vanna-charm` | `ticker=SPY`, `expiries=5` | Exposición consolidada de Vanna ($\partial \Delta / \partial \sigma$) y Charm ($\partial \Delta / \partial t$). |
| `GET` | `/api/oi` | `ticker=SPY`, `expiries=3` | Distribución de Open Interest (Calls vs Puts) y cálculo del Put/Call Ratio. |
| `GET` | `/api/iv-skew` | `ticker=SPY`, `expiry=0` | Curva de Volatilidad Implícita (Call IV vs Put IV) por strike para una expiración específica. |
| `GET` | `/api/iv-term` | `ticker=SPY`, `expiries=10` | Estructura temporal de ATM IV (DTE vs Volatilidad) clasificando el régimen (Contango / Backwardation). |
| `GET` | `/api/spot` | `ticker=SPY`, `tf=5m` | Velas japonesas (`1d`, `1h`, `15m`, `5m`), precio actual y variación porcentual. |
| `GET` | `/api/history/{ticker}` | `ticker=SPY` | Registro histórico de sesiones para análisis de backtest. |

---

## 🖥 Módulos y Funciones de la Terminal

### 1. Spot Chart & Niveles Clave (`SpotChart.jsx` & `KeyLevels.jsx`)
- **Gráfico de Velas de Alta Velocidad**: Implementado con TradingView *Lightweight Charts*, permite alternar temporalidades (`1D`, `1H`, `15M`, `5M`).
- **Líneas de Niveles Cuantitativos en el Gráfico**:
  - 🟢 **Call Wall**: Nivel de mayor concentración de Gamma positiva (resistencia teórica máxima).
  - 🔴 **Put Wall**: Nivel de mayor concentración de Gamma negativa (soporte teórico o acelerador a la baja).
  - 🟣 **Zero Gamma**: Nivel donde la Gamma neta del mercado cruza de positivo a negativo (zona de cambio de régimen de volatilidad).
  - 🟠 **Vol Trigger**: Nivel donde el Put GEX acumulado supera al Call GEX.

### 2. Dealer Summary & Positioning (`DealerSummary.jsx`)
- **Resumen Ejecutivo Cuantitativo**:
  - Régimen actual del Dealer (`POSITIVE GAMMA` / `NEGATIVE GAMMA`).
  - Total GEX ($B) y Total 0DTE GEX.
  - Total DEX ($B) y Max Delta Strike.
  - Exposición neta de Vanna y Charm ($B).

### 3. Expected Move Gauge (`ExpectedMoveGauge.jsx`)
- **Cálculo de Desviación Estándar de Mercado**:
  $$\text{Expected Move} = \text{Spot} \times \sigma_{\text{ATM}} \times \sqrt{\frac{\text{DTE}}{365}}$$
- Proyecta los rangos esperados a 1 Día y 1 Semana con un intervalo de confianza del 68% (1 Desviación Estándar) para definir zonas de toma de beneficios o venta de prima.

### 4. Perfil GEX (`GexProfile.jsx`) & Filtro 0DTE
- Desglosa la exposición Gamma por strike en miles de millones de dólares ($ Billions).
- Permite alternar entre **ALL Expiries** y **0DTE** para aislar el impacto de las opciones que vencen en el día intradía.

### 5. GEX Term Structure (`GexTermStructure.jsx`)
- Muestra el vencimiento exacto donde se concentra el riesgo Gamma del mercado (ej. expiraciones mensuales OPEX, trimestrales o 0DTE).

### 6. GEX Heatmap (`GEXHeatmap.jsx`)
- Matriz interactiva de color donde el eje vertical son los **Strikes** y el eje horizontal son las **Fechas de Expiración**.
- Permite identificar visualmente "bolsas" masivas de Gamma positiva (verde) y Gamma negativa (rojo).

### 7. Perfil DEX (`DexProfile.jsx`)
- Mide la exposición Delta neta en dólares que los Market Makers deben comprar o vender ante movimientos direccionales.

### 8. Vanna & Charm Profile (`VannaCharmProfile.jsx`)
- **Vanna ($\partial \Delta / \partial \sigma$)**: Muestra cómo cambiará el Delta del dealer si la volatilidad implícita sube o baja.
- **Charm ($\partial \Delta / \partial t$)**: Muestra el flujo mecánico de compra o venta de acciones que ocurrirá con el simple paso del tiempo conforme se acerca el cierre del mercado.

### 9. IV Skew & IV Term Structure (`IVSkew.jsx` & `IVTermStructure.jsx`)
- **IV Skew**: Revela el sesgo del mercado (demanda relativa de Put OTM de cobertura vs Call OTM especulativo).
- **IV Term Structure**: Clasifica el mercado en **Contango** (volatilidad a corto plazo más baja que a largo plazo, entorno alcista/tranquilo) o **Backwardation** (volatilidad a corto plazo disparada, entorno de pánico/crisis).

---

## 🧠 Fundamentos Cuantitativos y Aplicaciones Prácticas de Trading

### 1. La Mecánica del Hedging de los Market Makers
Los Market Makers (creadores de mercado) toman el otro lado de las órdenes del público institucional y minorista. Para permanecer con riesgo neutral (Delta-Neutral), deben cubrirse continuamente en el mercado subyacente (acciones o futuros del S&P 500):

$$\Delta_{\text{total}} = \sum \Delta_i \cdot \text{Contracts} \cdot 100$$

### 2. Régimen de Gamma Positiva vs Gamma Negativa

```
                 ▲ PRECIO SUBE
                 │
   ┌─────────────┴─────────────┐
   │                           │
[GAMMA POSITIVA]          [GAMMA NEGATIVA]
Dealers VENDEN acciones    Dealers COMPRAN acciones
(Efecto Amortiguador)      (Aceleran la Subida / Short Squeeze)
   │                           │
   └─────────────┬─────────────┘
                 │
   ┌─────────────┴─────────────┐
   │                           │
[GAMMA POSITIVA]          [GAMMA NEGATIVA]
Dealers COMPRAN acciones   Dealers VENDEN acciones
(Compran la Caída / Rebote)(Aceleran la Caída / Cascadas de Venta)
   │                           │
   └─────────────┬─────────────┘
                 │
                 ▼ PRECIO BAJA
```

- **Régimen de Gamma Positiva (Encima de Zero Gamma)**:
  - Los dealers están "largos de gamma". Venden cuando el precio sube y compran cuando el precio baja.
  - **Aplicación de Trading**: Mercado en rango, baja volatilidad, reversión a la media (*Mean Reversion*). Estrategia ideal: Venta de prima (Iron Condors, Credit Spreads), comprar soportes y vender resistencias.
- **Régimen de Gamma Negativa (Debajo de Zero Gamma)**:
  - Los dealers están "cortos de gamma". Para cubrirse, tienen que vender en pánico cuando el precio cae y comprar compulsivamente cuando el precio sube.
  - **Aplicación de Trading**: Alta volatilidad, expansiones de rango y rupturas tendenciales. Estrategia ideal: Seguimiento de tendencia (*Trend Following*), compra de volatilidad (Long Straddles, Puts direccionales).

### 3. Dinámica del Call Wall y Put Wall
- **Call Wall**: Actúa como un imán hacia arriba hasta el vencimiento, pero es una resistencia muy dura. Si el precio lo supera con volumen y se "rompe el muro", se desata un *Gamma Squeeze* explosivo.
- **Put Wall**: Funciona como el soporte institucional primario. Si el precio pierde el Put Wall, se activa la venta masiva de cobertura de los dealers provocando caídas aceleradas.

### 4. El "Vanna Rally" (Subidas por Colapso de Volatilidad)
Cuando los inversores compran Puts para cubrirse de un evento de riesgo (ej. decisión de tasas de la FED o reporte de inflación CPI), los dealers quedan cortos de Puts (Vanna negativo). 
- Tan pronto pasa el evento, la volatilidad implícita (IV) colapsa (*Vol Crush*).
- La caída de IV reduce instantáneamente el Delta de los Puts de los dealers.
- **Consecuencia**: Los dealers deben recomprar de forma mecánica miles de millones de dólares en futuros/acciones, produciendo los famosos rallies inmediatos post-noticia (*Vanna Rally*).

### 5. El "Charm Drift" (Flujo del Paso del Tiempo)
Conforme transcurre la sesión hacia el cierre (especialmente en opciones 0DTE):
- El valor temporal se extingue aceleradamente.
- El delta de las opciones OTM decae hacia cero, obligando a los creadores de mercado a desenrollar sus coberturas direccionales antes de las 4:00 PM EST.

---

## 🔧 Resolución de Problemas (Troubleshooting)

### 1. Las peticiones muestran `(pending)` o no cargan
- **Causa**: Un proceso zombie de Python anterior está reteniendo el socket del puerto 8000.
- **Solución**: Cierra todas las ventanas de terminal y ejecuta en PowerShell:
  ```powershell
  Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force
  ```
  Luego vuelve a iniciar `uvicorn main:app --host 127.0.0.1 --port 8000 --reload`.

### 2. Error de CORS en la consola del navegador
- Verifica que el frontend se ejecute en `http://localhost:5173` o `http://127.0.0.1:5173`. El backend en `main.py` ya incluye orígenes y métodos habilitados para ambos.

### 3. Tickers Soportados
- Acciones y ETFs: `SPY`, `QQQ`, `AAPL`, `NVDA`, `TSLA`, `IWM`.
- Índices directos: `^SPX` (o `SPX`), `^NDX` (o `NDX`), `^VIX` (o `VIX`), `^RUT` (o `RUT`).
