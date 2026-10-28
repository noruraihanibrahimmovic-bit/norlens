from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import urllib.request
import urllib.parse
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "application/json,text/plain,*/*",
}

PRICE_RANGES = {
    "1d": "1d", "5d": "1d", "1mo": "1d", "3mo": "1d",
    "6mo": "1d", "1y": "1d", "2y": "1wk", "5y": "1wk",
}

def fetch_data(url: str):
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@app.get("/api/health")
def health_check():
    return {"ok": True}

@app.get("/api/profile")
def get_profile(symbol: str = Query(...)):
    safe_symbol = urllib.parse.quote(symbol.strip().upper())
    return fetch_data(f"https://ihsg.midoriresearch.com/api/profile?symbol={safe_symbol}")

@app.get("/api/financials")
def get_financials(symbol: str = Query(...), period: str = Query("annual")):
    safe_symbol = urllib.parse.quote(symbol.strip().upper())
    return fetch_data(f"https://ihsg.midoriresearch.com/api/financials?symbol={safe_symbol}&period=annual")

@app.get("/api/price")
def get_price(symbol: str = Query(...), range: str = Query("1d")):
    safe_symbol = urllib.parse.quote(symbol.strip().upper())
    interval = PRICE_RANGES.get(range, "1d")
    return fetch_data(f"https://query1.finance.yahoo.com/v8/finance/chart/{safe_symbol}.JK?range={range}&interval={interval}&events=div")

@app.get("/api/exchange-rate")
def get_exchange_rate():
    return fetch_data("https://api.frankfurter.dev/v2/rate/usd/idr")
