#!/usr/bin/env python3
"""AidRelay — local server (stdlib only).
Serves the app on this machine's network and relays AI calls from the
page to the provider the user picked: the hosted Meta Model API
(https://api.meta.ai) or Baseten (https://inference.baseten.co, Muse
Spark Open). The browser talks only to this server on your own
machine/network; your API key travels from the page to this server and
from here to the provider — it is never stored or logged.

Two doors:
  http://<this machine>:8772   — setup door. Serves the app, and /ca.crt,
                                 the local certificate the phone installs
                                 once so it can trust the secure door.
  https://<this machine>:8773  — secure door (starts when cert.pem and
                                 key.pem sit next to this file). Browsers
                                 only allow the microphone on secure
                                 addresses, so the phone app runs here.

Run:  python3 server.py   (Ctrl+C stops it)"""
import json, os, socket, ssl, threading, urllib.request, urllib.error
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = 8772
TLS_PORT = 8773
API_URL = "https://api.meta.ai/v1/chat/completions"
BASETEN_URL = "https://inference.baseten.co/v1/chat/completions"
RELAY_ROUTES = {"/api/chat": API_URL, "/api/chat-baseten": BASETEN_URL}
HERE = os.path.dirname(os.path.abspath(__file__))

class Handler(SimpleHTTPRequestHandler):
    extensions_map = dict(SimpleHTTPRequestHandler.extensions_map or {})
    extensions_map['.webmanifest'] = 'application/manifest+json'
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=HERE, **kw)

    def do_GET(self):
        if self.path.split('?')[0] == '/ca.crt':
            path = os.path.join(HERE, 'ca.crt')
            if not os.path.exists(path):
                self.send_error(404); return
            with open(path, 'rb') as f:
                data = f.read()
            self.send_response(200)
            self.send_header('Content-Type', 'application/x-x509-ca-cert')
            self.send_header('Content-Disposition', 'attachment; filename="relay-ca.crt"')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        super().do_GET()

    def do_POST(self):
        target = RELAY_ROUTES.get(self.path)
        if target is None:
            self.send_error(404); return
        try:
            length = int(self.headers.get("Content-Length") or 0)
            payload = json.loads(self.rfile.read(length) or b"{}")
            key = payload.get("apiKey") or ""
            body = payload.get("body") or {}
            req = urllib.request.Request(target, data=json.dumps(body).encode(),
                                         headers={"Content-Type": "application/json",
                                                  "Authorization": "Bearer " + key},
                                         method="POST")
            try:
                with urllib.request.urlopen(req, timeout=300) as r:
                    data, status = r.read(), r.status
            except urllib.error.HTTPError as e:
                data, status = e.read(), e.code
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:  # relay failure is reported, never silent
            data = json.dumps({"error": {"message": "Local relay error: %s" % e}}).encode()
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

    def log_message(self, fmt, *args):
        pass  # quiet: no request logs, no key material anywhere

def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return None

def serve_https():
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(os.path.join(HERE, "cert.pem"), os.path.join(HERE, "key.pem"))
    srv = ThreadingHTTPServer(("0.0.0.0", TLS_PORT), Handler)
    srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
    srv.serve_forever()

if __name__ == "__main__":
    ip = lan_ip()
    print("AidRelay is running. (Ctrl+C stops it)")
    print("  On this computer:  http://127.0.0.1:%d" % PORT)
    if ip:
        print("  On your phone (same Wi-Fi):  http://%s:%d" % (ip, PORT))
        print("  Phone certificate (open on the phone first):  http://%s:%d/ca.crt" % (ip, PORT))
    if os.path.exists(os.path.join(HERE, "cert.pem")) and os.path.exists(os.path.join(HERE, "key.pem")):
        threading.Thread(target=serve_https, daemon=True).start()
        print("  Secure phone app (microphone works):  https://%s:%d" % (ip or "127.0.0.1", TLS_PORT))
    else:
        print("  Secure door is waiting for its certificate files (cert.pem / key.pem).")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
