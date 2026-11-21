#!/usr/bin/env python3
"""Signale des URL aux moteurs IndexNow (Bing, Yandex, Seznam, Naver… ; Bing alimente aussi
DuckDuckGo, Yahoo et Ecosia). Usage :
  python3 seo/indexnow.py            -> toutes les URL de sitemap.xml
  python3 seo/indexnow.py /cours/x/  -> seulement ces chemins
"""
import json, os, re, sys, urllib.request
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
CFG = json.load(open(os.path.join(ROOT, "seo", "config.json"), encoding="utf-8"))
BASE = CFG["base_url"].rstrip("/"); KEY = CFG["indexnow_key"]
if len(sys.argv) > 1:
    urls = [BASE + (p if p.startswith("/") else "/" + p) for p in sys.argv[1:]]
else:
    urls = re.findall(r"<loc>(.*?)</loc>", open(os.path.join(ROOT, "sitemap.xml"), encoding="utf-8").read())
if not urls:
    print("Aucune URL"); sys.exit(0)
host = re.sub(r"^https?://", "", BASE).split("/")[0]
body = json.dumps({"host": host, "key": KEY, "keyLocation": f"{BASE}/{KEY}.txt", "urlList": urls[:10000]}).encode()
req = urllib.request.Request("https://api.indexnow.org/indexnow", data=body, headers={"Content-Type": "application/json; charset=utf-8"})
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        print("IndexNow :", r.status, len(urls), "URL")
except urllib.error.HTTPError as e:
    print("IndexNow : HTTP", e.code, e.read()[:300]); sys.exit(1 if e.code >= 400 and e.code != 429 else 0)
