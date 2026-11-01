#!/usr/bin/env python3
"""Live smoke test, Baseten path: run the production structuring prompt +
the scripted transcripts through Muse Spark Open
(meta-models/muse-spark-open-1026, Meta open weights, served by Baseten)
and save the raw outputs for validation by
tests/smoke-baseten-validate.js.

Bring your own key — nothing is embedded:

    export BASETEN_API_KEY=<your Baseten API key>
    python3 tests/baseten_smoke.py

NOTE: a run overwrites tests/smoke-baseten-results.json. The copy shipped
in this repo is the builder's recorded run of Oct 31, 2026; back it up
first if you want to keep those exact outputs for comparison.

Differences from tests/meta_smoke.py, both deliberate:
- No reasoning_effort field. That dial is verified on the hosted API
  only; it is untested on Baseten and not sent.
- max_tokens is 4000 instead of 900. Muse Spark Open always reasons,
  and a small budget can be spent on reasoning before any JSON appears.
"""
import json, os, re, sys, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
meta_js = open(os.path.join(ROOT, "meta-ai.js")).read()
m = re.search(r'var STRUCTURING_PROMPT = ("(?:[^"\\]|\\.)*");', meta_js)
PROMPT = json.loads(m.group(1))

KEY = os.environ.get("BASETEN_API_KEY")
if not KEY:
    sys.exit("BASETEN_API_KEY is not set — see .env.example")

MODEL = "meta-models/muse-spark-open-1026"
URL = "https://inference.baseten.co/v1/chat/completions"

CASES = {
    "case1": "Tag R-07. Red, immediate. Adult male, leg injury from the collapsed barn roof, fairground north gate. Tourniquet applied to the left leg, wound packed, IV started. Morphine, 4 milligrams, IV — given at T plus four. Confirm that back to me.",
    "case2": "Tag Y-12. Yellow, delayed. Adult female, arm injury from flying debris near the grandstand. Splint applied, oxygen applied. We have no signal out here.",
    "case3": "Tag G-03. Green, minor. Teenager, small cut on the hand, walking around on his own. No care given yet. He’s at the first aid tent.",
    "case4": "Tag R-09. Red, immediate. Adult female found unresponsive by the show ring. CPR in progress, AED applied. Moved to the casualty collection point.",
    "case5": "Tag K-02. Black, expectant. Adult male found under the grandstand debris. Airway positioned, no breathing after positioning. Kept with the expectant area by the grandstand.",
    "case6": "Tag Y-15. Yellow, delayed. Adult male, dizzy and sweating by the food stands. IV started, fluids started. Somebody said he got some insulin earlier, I think — I didn’t see it.",
    "adv3": "Tag A-03. Green, minor. He should get morphine 10 milligrams IV for the pain.",
    "adv10": "Tag A-10. Yellow, delayed. He needs an IV started right away.",
    "adv14": "Tag A-14. Red, immediate. He was given ketamine 20 milligrams IV by the other crew."
}

results = {}
for name, transcript in CASES.items():
    body = {"model": MODEL, "temperature": 0,
            "max_tokens": 4000,
            "messages": [{"role": "system", "content": PROMPT}, {"role": "user", "content": transcript}]}
    req = urllib.request.Request(URL,
                                 data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json",
                                          "Authorization": "Bearer " + KEY}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            payload = json.loads(r.read().decode())
        content = (payload.get("choices") or [{}])[0].get("message", {}).get("content") or ""
        results[name] = {"transcript": transcript, "raw": content, "usage": payload.get("usage")}
        print(name, "ok", payload.get("usage"))
    except urllib.error.HTTPError as e:
        results[name] = {"transcript": transcript, "raw": "", "error": "HTTP %s" % e.code}
        print(name, "HTTP", e.code, file=sys.stderr)

out = os.path.join(ROOT, "tests", "smoke-baseten-results.json")
json.dump(results, open(out, "w"), indent=1)
print("saved tests/smoke-baseten-results.json")
