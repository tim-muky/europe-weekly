#!/usr/bin/env python3
"""
get_youtube_token.py — ONE-TIME local helper to get your YouTube refresh token.

Run this ONCE on your local machine (not in GitHub Actions).
It opens a browser, asks you to authorise Europe Weekly to upload videos,
then prints the three values you need to add as GitHub Secrets.

Usage:
  python scripts/get_youtube_token.py

Requirements:
  - Python 3.8+
  - No extra packages needed (uses stdlib only)
  - Port 8080 must be free on localhost

After running, add the three printed values as GitHub Secrets at:
  https://github.com/tim-muky/europe-weekly/settings/secrets/actions
"""

import json
import webbrowser
import urllib.parse
import urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler

REDIRECT_URI = "http://localhost:8080"
SCOPES       = "https://www.googleapis.com/auth/youtube.upload"

print("""
╔══════════════════════════════════════════════════════════════╗
║        Europe Weekly — YouTube Token Generator               ║
║  Run this once to get credentials for GitHub Actions         ║
╚══════════════════════════════════════════════════════════════╝

You need OAuth 2.0 credentials from Google Cloud Console.
If you haven't set them up yet, follow the instructions in
YOUTUBE_SETUP.md first, then come back here.
""")

CLIENT_ID     = input("Paste your Google OAuth Client ID:     ").strip()
CLIENT_SECRET = input("Paste your Google OAuth Client Secret: ").strip()

# ── Build authorisation URL ──────────────────────────────────────────────────
auth_url = (
    "https://accounts.google.com/o/oauth2/v2/auth?"
    + urllib.parse.urlencode({
        "client_id":     CLIENT_ID,
        "redirect_uri":  REDIRECT_URI,
        "response_type": "code",
        "scope":         SCOPES,
        "access_type":   "offline",
        "prompt":        "consent",   # forces refresh_token to be issued
    })
)

# ── Local callback server ────────────────────────────────────────────────────
auth_code = None

class _Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        global auth_code
        params    = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        auth_code = params.get("code", [None])[0]
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(
            b"<h1 style='font-family:sans-serif;margin:40px'>&#10003; "
            b"Authorised! You can close this tab and return to the terminal.</h1>"
        )

    def log_message(self, *_):   # suppress HTTP log noise
        pass

print("\nOpening your browser for Google authorisation…")
webbrowser.open(auth_url)

server = HTTPServer(("localhost", 8080), _Handler)
print("Waiting for Google to redirect back (listening on localhost:8080)…")
server.handle_request()

if not auth_code:
    print("\n✗ No authorisation code received. Did you cancel the browser flow?")
    raise SystemExit(1)

# ── Exchange code for tokens ─────────────────────────────────────────────────
data = urllib.parse.urlencode({
    "code":          auth_code,
    "client_id":     CLIENT_ID,
    "client_secret": CLIENT_SECRET,
    "redirect_uri":  REDIRECT_URI,
    "grant_type":    "authorization_code",
}).encode()

req = urllib.request.Request(
    "https://oauth2.googleapis.com/token", data=data, method="POST"
)
with urllib.request.urlopen(req) as r:
    tokens = json.loads(r.read())

if "refresh_token" not in tokens:
    print(
        "\n✗ No refresh_token in response. This usually means the account already "
        "granted access without 'prompt=consent'. Revoke access at "
        "https://myaccount.google.com/permissions and run this script again."
    )
    print("Full response:", tokens)
    raise SystemExit(1)

# ── Print results ─────────────────────────────────────────────────────────────
print(f"""
╔══════════════════════════════════════════════════════════════╗
║  ✓ Success! Add these three GitHub Secrets:                  ║
║                                                              ║
║  Go to:                                                      ║
║  github.com/tim-muky/europe-weekly/settings/secrets/actions  ║
╚══════════════════════════════════════════════════════════════╝

Secret name               Value
───────────────────────── ────────────────────────────────────
YOUTUBE_CLIENT_ID         {CLIENT_ID}
YOUTUBE_CLIENT_SECRET     {CLIENT_SECRET}
YOUTUBE_REFRESH_TOKEN     {tokens['refresh_token']}

Copy each value carefully — the refresh token is only shown once.
""")
