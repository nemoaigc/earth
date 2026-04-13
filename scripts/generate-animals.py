#!/usr/bin/env python3
"""Batch generate animal sprites via Scenario API"""
import json, time, os, sys, base64, urllib.request, urllib.error

API = "https://api.cloud.scenario.com/v1"
KEY = "api_WvsRosfALpCZ9Si7qw36iXAF"
SECRET = "SpsiCSwMURjJLdEgxD1PCF1t"
AUTH = "Basic " + base64.b64encode(f"{KEY}:{SECRET}".encode()).decode()
MODEL = "model_4RhbPuYCY43bic4kcYYniDna"
OUTDIR = os.path.join(os.path.dirname(__file__), "..", "public", "animals")
os.makedirs(OUTDIR, exist_ok=True)

STYLE = "cute miniature figurine, low poly style, soft pastel shading, simple clean design, full body, centered, solid white background, game asset"

ANIMALS = [
    # EXTINCT / PREHISTORIC
    ("trex", "green and brown tyrannosaurus rex dinosaur, standing pose, sharp teeth, tiny arms"),
    ("triceratops", "grey and tan triceratops dinosaur with three horns, sturdy body"),
    ("pteranodon", "brown pteranodon flying dinosaur with large wingspan, side view"),
    ("brachiosaurus", "green brachiosaurus dinosaur with very long neck, gentle giant"),
    ("stegosaurus", "green and orange stegosaurus dinosaur with back plates and tail spikes"),
    ("mammoth", "brown woolly mammoth with long curved tusks, thick shaggy fur"),
    ("sabertooth", "tawny golden saber-toothed tiger with long fangs, muscular"),
    ("dodo", "grey and white dodo bird, plump round body, small wings, hooked beak"),
    ("velociraptor", "green and brown velociraptor, small agile dinosaur with claws"),
    ("spinosaurus", "dark green spinosaurus dinosaur with large sail on back"),
    ("megalodon", "dark grey megalodon giant prehistoric shark, massive jaws"),
    ("plesiosaur", "blue-green plesiosaur marine reptile with long neck swimming"),
    ("woollyrhino", "brown woolly rhinoceros with thick fur and horn"),
    ("ankylosaurus", "brown and yellow ankylosaurus dinosaur with armored body and club tail"),
    ("parasaurolophus", "green parasaurolophus dinosaur with curved head crest"),
    ("archaeopteryx", "colorful feathered archaeopteryx, half bird half dinosaur"),
    ("thylacine", "tawny brown thylacine tasmanian tiger with dark stripes on back"),
    ("ammonite", "iridescent spiral ammonite shell sea creature"),
    ("groundsloth", "brown giant ground sloth, large claws, shaggy fur, standing"),
    ("moa", "brown and grey giant moa bird, very tall, no wings, long neck"),
    # ENDANGERED
    ("panda", "black and white giant panda bear sitting, eating bamboo"),
    ("snowleopard", "white and grey snow leopard with dark spots, long fluffy tail"),
    ("orangutan", "orange-red orangutan ape with long arms, gentle face"),
    ("gorilla", "dark grey mountain gorilla, powerful build, gentle eyes"),
    ("tiger", "orange tiger with black stripes, walking pose"),
    ("polarbear", "white polar bear, large powerful build, arctic"),
    ("bluewhale", "blue-grey blue whale, massive body, swimming in ocean"),
    ("seaturtle", "green sea turtle with patterned shell, swimming"),
    ("redpanda", "red-brown red panda with ringed tail, bushy, cute face"),
    ("rhinoceros", "grey rhinoceros with horn, thick armored skin"),
    ("pangolin", "brown pangolin with overlapping scales, curled slightly"),
    ("snowyowl", "white snowy owl with yellow eyes, few dark spots"),
    ("crestedibis", "white crested ibis bird with red face, elegant long beak"),
    ("baijidolphin", "light grey baiji river dolphin, long snout, swimming"),
    ("amurleopard", "golden yellow amur leopard with black rosettes, muscular"),
]

def api_request(method, path, data=None):
    url = f"{API}{path}"
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Authorization", AUTH)
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"  HTTP {e.code}: {err[:200]}")
        return None
    except Exception as e:
        print(f"  Error: {e}")
        return None

def submit_job(filename, desc):
    prompt = f"{desc}, {STYLE}"
    data = {
        "modelId": MODEL,
        "prompt": prompt,
        "numSamples": 1,
        "width": 512,
        "height": 512,
        "guidance": 7,
        "numInferenceSteps": 20,
    }
    resp = api_request("POST", "/generate/txt2img", data)
    if resp and "job" in resp:
        return resp["job"]["jobId"]
    return None

def check_job(job_id):
    resp = api_request("GET", f"/jobs/{job_id}")
    if resp and "job" in resp:
        j = resp["job"]
        assets = j.get("metadata", {}).get("assetIds", [])
        return j["status"], assets[0] if assets else None
    return "unknown", None

def download_asset(asset_id, filepath):
    resp = api_request("POST", f"/assets/{asset_id}/download", {"targetFormat": "png"})
    if resp and "url" in resp:
        urllib.request.urlretrieve(resp["url"], filepath)
        size = os.path.getsize(filepath)
        if size > 1000:
            return True
        os.remove(filepath)
    return False

# === SUBMIT ALL JOBS ===
print(f"=== Submitting {len(ANIMALS)} generation jobs ===")
jobs = {}  # filename -> jobId

for filename, desc in ANIMALS:
    outpath = os.path.join(OUTDIR, f"{filename}.png")
    if os.path.exists(outpath) and os.path.getsize(outpath) > 1000:
        print(f"  ⏭ {filename}.png already exists, skipping")
        continue

    job_id = submit_job(filename, desc)
    if job_id:
        jobs[filename] = job_id
        print(f"  ✓ {filename} -> {job_id}")
    else:
        print(f"  ✗ {filename} FAILED to submit")
    time.sleep(0.5)

print(f"\n=== Submitted {len(jobs)} jobs. Polling for completion... ===")

# === POLL AND DOWNLOAD ===
downloaded = set()
failed = set()
max_attempts = 60

for attempt in range(1, max_attempts + 1):
    if not jobs or len(downloaded) + len(failed) >= len(jobs):
        break

    time.sleep(10)
    pending = 0

    for filename, job_id in jobs.items():
        if filename in downloaded or filename in failed:
            continue

        status, asset_id = check_job(job_id)

        if status == "success" and asset_id:
            outpath = os.path.join(OUTDIR, f"{filename}.png")
            if download_asset(asset_id, outpath):
                size = os.path.getsize(outpath)
                print(f"  ⬇ {filename}.png ({size}B)")
                downloaded.add(filename)
            else:
                pending += 1
        elif status == "failed":
            print(f"  ✗ {filename} generation FAILED")
            failed.add(filename)
        else:
            pending += 1

    total = len(jobs)
    print(f"  [Poll #{attempt}] Done: {len(downloaded)}/{total}, Pending: {pending}, Failed: {len(failed)}")

# === SUMMARY ===
print(f"\n=== Complete ===")
print(f"Downloaded: {len(downloaded)}")
print(f"Failed: {len(failed)}")
if failed:
    print(f"Failed animals: {', '.join(sorted(failed))}")

pngs = [f for f in os.listdir(OUTDIR) if f.endswith('.png')]
print(f"Total PNGs in {OUTDIR}: {len(pngs)}")
