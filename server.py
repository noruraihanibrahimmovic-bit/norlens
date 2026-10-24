from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from urllib.parse import urlparse, parse_qs, quote
import json
import os
import threading
import time
 
CACHE_TTL = 300          # detik: data segar
STALE_TTL = 6 * 3600     # detik: data lama masih dipakai bila API sumber gagal
HOST = os.environ.get("HOST", "127.0.0.1")   # di hosting isi HOST=0.0.0.0
PORT = int(os.environ.get("PORT", "8000"))
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "*")  # produksi: https://www.norlens.com
 
cache = {}
yahoo_lock = threading.Lock()
last_yahoo = [0.0]
 
HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"),
    "Accept": "application/json,text/plain,*/*",
    "Accept-Language": "en-US,en;q=0.9",
}
 
PRICE_RANGES = {
    "1d": "1d", "5d": "1d", "1mo": "1d", "3mo": "1d",
    "6mo": "1d", "1y": "1d", "2y": "1wk", "5y": "1wk",
}
 
 
def throttle():
    """Beri jeda minimal antar permintaan ke Yahoo agar tidak kena 429."""
    with yahoo_lock:
        wait = 0.5 - (time.time() - last_yahoo[0])
        if wait > 0:
            time.sleep(wait)
        last_yahoo[0] = time.time()
 
 
def fetch(url):
    yahoo = "finance.yahoo.com" in url
    urls = [url, url.replace("query1", "query2")] if yahoo else [url]
    last = "tidak diketahui"
    for attempt in range(3):
        for u in urls:
            try:
                if yahoo:
                    throttle()
                with urlopen(Request(u, headers=HEADERS), timeout=15) as r:
                    data = r.read()
                if yahoo and not json.loads(data).get("chart", {}).get("result"):
                    raise ValueError("Yahoo tidak mengembalikan data untuk kode ini")
                return data
            except HTTPError as e:
                last = f"HTTP {e.code} dari sumber data"
                if e.code == 404:
                    raise ValueError("Kode saham tidak ditemukan (404)")
            except Exception as e:
                last = str(e)
        time.sleep(1.2 * (attempt + 1))
    raise RuntimeError(last)
 
 
class NorlensHandler(BaseHTTPRequestHandler):
 
    def build_url(self, path, params):
        if path == "/api/exchange-rate":
            return "https://api.frankfurter.dev/v2/rate/usd/idr", None
 
        if path not in ("/api/profile", "/api/financials", "/api/price"):
            return None, (404, "Endpoint tidak ditemukan")
 
        symbol = params.get("symbol", [""])[0].strip().upper()
        if not symbol or not symbol.isalnum():
            return None, (400, "Kode saham tidak valid")
        safe = quote(symbol)
 
        if path == "/api/profile":
            return f"https://ihsg.midoriresearch.com/api/profile?symbol={safe}", None
 
        if path == "/api/financials":
            if params.get("period", ["annual"])[0] != "annual":
                return None, (400, "Periode tidak valid")
            return f"https://ihsg.midoriresearch.com/api/financials?symbol={safe}&period=annual", None
 
        rng = params.get("range", ["1d"])[0]
        if rng not in PRICE_RANGES:
            return None, (400, "Rentang harga tidak valid")
        return ("https://query1.finance.yahoo.com/v8/finance/chart/"
                f"{safe}.JK?range={rng}&interval={PRICE_RANGES[rng]}&events=div"), None
 
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors()
        self.end_headers()
 
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            return self.send_json(200, {"ok": True})
 
        url, error = self.build_url(parsed.path, parse_qs(parsed.query))
        if error:
            return self.send_json(error[0], {"error": error[1]})
 
        hit = cache.get(url)
        if hit and time.time() - hit[0] < CACHE_TTL:
            return self.send_raw(200, hit[1])
 
        try:
            data = fetch(url)
            if len(cache) > 300:
                cache.clear()
            cache[url] = (time.time(), data)
            self.send_raw(200, data)
        except Exception as e:
            if hit and time.time() - hit[0] < STALE_TTL:
                return self.send_raw(200, hit[1])   # lebih baik data lama daripada kosong
            self.send_json(502, {"error": "Gagal mengambil data dari API", "detail": str(e)})
 
    def send_cors(self):
        self.send_header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
 
    def send_raw(self, status, data):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_cors()
        self.end_headers()
        self.wfile.write(data)
 
    def send_json(self, status, payload):
        self.send_raw(status, json.dumps(payload).encode("utf-8"))
 
 
if __name__ == "__main__":
    print(f"Norlens server berjalan di http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), NorlensHandler).serve_forever()