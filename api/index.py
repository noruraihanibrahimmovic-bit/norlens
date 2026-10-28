from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, quote
import urllib.request
import json

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "application/json,text/plain,*/*",
}

PRICE_RANGES = {
    "1d": "1d", "5d": "1d", "1mo": "1d", "3mo": "1d",
    "6mo": "1d", "1y": "1d", "2y": "1wk", "5y": "1wk",
}

def fetch_data(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=15) as response:
        return response.read()

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        if path == "/api/health":
            return self.send_json(200, {"ok": True})

        try:
            if path == "/api/profile":
                symbol = params.get("symbol", [""])[0].strip().upper()
                data = fetch_data(f"https://ihsg.midoriresearch.com/api/profile?symbol={quote(symbol)}")
                return self.send_raw(200, data)

            elif path == "/api/financials":
                symbol = params.get("symbol", [""])[0].strip().upper()
                data = fetch_data(f"https://ihsg.midoriresearch.com/api/financials?symbol={quote(symbol)}&period=annual")
                return self.send_raw(200, data)

            elif path == "/api/price":
                symbol = params.get("symbol", [""])[0].strip().upper()
                rng = params.get("range", ["1d"])[0]
                interval = PRICE_RANGES.get(rng, "1d")
                url = f"https://query1.finance.yahoo.com/v8/finance/chart/{quote(symbol)}.JK?range={rng}&interval={interval}&events=div"
                data = fetch_data(url)
                return self.send_raw(200, data)

            elif path == "/api/exchange-rate":
                data = fetch_data("https://api.frankfurter.dev/v2/rate/usd/idr")
                return self.send_raw(200, data)

            else:
                return self.send_json(404, {"error": "Endpoint tidak ditemukan"})

        except Exception as e:
            return self.send_json(502, {"error": "Gagal mengambil data", "detail": str(e)})

    def send_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
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
