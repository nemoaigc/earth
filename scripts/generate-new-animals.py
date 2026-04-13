#!/usr/bin/env python3
"""Generate new extinct animal sprites + remove background via Scenario API"""
import json, time, os, subprocess, base64

API = "https://api.cloud.scenario.com/v1"
KEY = "api_WvsRosfALpCZ9Si7qw36iXAF"
SECRET = "SpsiCSwMURjJLdEgxD1PCF1t"
AUTH = "Basic " + base64.b64encode(f"{KEY}:{SECRET}".encode()).decode()
GEN_MODEL = "model_4RhbPuYCY43bic4kcYYniDna"
REMBG_MODEL = "model_bria-remove-background"
OUTDIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "animals")
os.makedirs(OUTDIR, exist_ok=True)

STYLE = "cute miniature figurine, low poly style, soft pastel shading, simple clean design, full body, centered, solid white background, game asset"

NEW_ANIMALS = [
    ("passengerpigeon", "grey and pink passenger pigeon bird, elegant long tail feathers, iridescent neck"),
    ("greatauk", "black and white great auk seabird, penguin-like, sturdy body, short wings, standing"),
    ("stellerseacow", "large grey steller sea cow, gentle marine mammal, swimming, round body"),
    ("quagga", "brown and white quagga, half-striped zebra, stripes only on front half"),
    ("caspiantiger", "tawny orange caspian tiger with black stripes, muscular, thick fur"),
    ("barbarylion", "golden barbary lion with large dark thick mane, majestic, standing"),
    ("formosanleopard", "tawny formosan clouded leopard with cloud-shaped dark markings, long tail"),
    ("japanesewolf", "grey-brown japanese wolf, small wolf, compact body, bushy tail"),
    ("goldentoad", "bright orange golden toad, small shiny amphibian, vivid color"),
    ("caribbeanmonkseal", "grey caribbean monk seal, round body, flippers, lying on beach"),
    ("westernblackrhino", "dark grey western black rhinoceros, two horns, thick skin, sturdy"),
    ("chinesepaddlefish", "silver-grey chinese paddlefish, long paddle-shaped snout, large river fish"),
    ("pyreneanibex", "brown pyrenean ibex mountain goat, curved horns, standing on rock"),
    ("bluebuck", "blue-grey bluebuck antelope, graceful, curved horns, slender body"),
    ("carolinaparakeet", "bright green and yellow carolina parakeet, orange head, colorful small parrot"),
    ("ivorybill", "black and white ivory-billed woodpecker, red crest, long pale bill, perched"),
]

BATCH_SIZE = 5

def curl_json(method, path, data=None):
    cmd = ["curl", "-s", "--connect-timeout", "30", "--max-time", "120"]
    url = f"{API}{path}"
    if method == "POST":
        cmd += ["-X", "POST"]
    cmd += ["-H", f"Authorization: {AUTH}"]
    if data:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(data)]
    cmd.append(url)
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.stdout.strip():
        try:
            return json.loads(result.stdout)
        except:
            pass
    return None

def curl_download(url, filepath):
    subprocess.run(["curl", "-sL", "--connect-timeout", "30", "--max-time", "120", "-o", filepath, url], capture_output=True)
    return os.path.exists(filepath) and os.path.getsize(filepath) > 1000

def check_job(job_id):
    resp = curl_json("GET", f"/jobs/{job_id}")
    if resp and "job" in resp:
        j = resp["job"]
        assets = j.get("metadata", {}).get("assetIds", [])
        return j["status"], assets[0] if assets else None
    return "unknown", None

def download_asset(asset_id, filepath):
    resp = curl_json("POST", f"/assets/{asset_id}/download", {"targetFormat": "png"})
    if resp and "url" in resp:
        return curl_download(resp["url"], filepath)
    return False

def wait_jobs(jobs, label=""):
    downloaded = {}
    failed = set()
    for attempt in range(1, 50):
        if len(downloaded) + len(failed) >= len(jobs):
            break
        time.sleep(8)
        pending = 0
        for name, job_id in jobs.items():
            if name in downloaded or name in failed:
                continue
            status, asset_id = check_job(job_id)
            if status == "success" and asset_id:
                downloaded[name] = asset_id
                print(f"  ✓ {name} {label} done")
            elif status == "failed":
                print(f"  ✗ {name} {label} failed")
                failed.add(name)
            else:
                pending += 1
        if pending:
            print(f"    [{label} poll #{attempt}] waiting for {pending}...")
    return downloaded, failed

# ==================== PHASE 1: Generate sprites ====================
print("=" * 60)
print("PHASE 1: Generate new animal sprites")
print("=" * 60)

all_gen_assets = {}  # name -> asset_id

for batch_start in range(0, len(NEW_ANIMALS), BATCH_SIZE):
    batch = NEW_ANIMALS[batch_start:batch_start + BATCH_SIZE]
    batch_num = batch_start // BATCH_SIZE + 1
    total_batches = (len(NEW_ANIMALS) + BATCH_SIZE - 1) // BATCH_SIZE
    print(f"\n--- Gen Batch {batch_num}/{total_batches} ---")

    jobs = {}
    for name, desc in batch:
        if os.path.exists(os.path.join(OUTDIR, f"{name}.png")) and os.path.getsize(os.path.join(OUTDIR, f"{name}.png")) > 1000:
            print(f"  ⏭ {name} exists, skip")
            continue
        prompt = f"{desc}, {STYLE}"
        resp = curl_json("POST", "/generate/txt2img", {
            "modelId": GEN_MODEL, "prompt": prompt,
            "numSamples": 1, "width": 512, "height": 512,
            "guidance": 7, "numInferenceSteps": 20,
        })
        if resp and "job" in resp:
            jobs[name] = resp["job"]["jobId"]
            print(f"  → {name} submitted")
        else:
            print(f"  ✗ {name} submit failed")
            if resp: print(f"    {json.dumps(resp)[:100]}")
        time.sleep(0.5)

    if jobs:
        downloaded, _ = wait_jobs(jobs, "gen")
        # Download generated images
        for name, asset_id in downloaded.items():
            tmppath = os.path.join(OUTDIR, f"{name}_raw.png")
            if download_asset(asset_id, tmppath):
                all_gen_assets[name] = tmppath
                print(f"  ⬇ {name}_raw.png saved")

    if batch_start + BATCH_SIZE < len(NEW_ANIMALS):
        time.sleep(2)

# ==================== PHASE 2: Remove backgrounds ====================
print("\n" + "=" * 60)
print("PHASE 2: Remove backgrounds (new + existing)")
print("=" * 60)

# Collect all files that need bg removal
to_process = {}
# New raw files
for name, rawpath in all_gen_assets.items():
    to_process[name] = rawpath
# Existing files that still have backgrounds
for f in os.listdir(OUTDIR):
    if f.endswith('.png') and not f.endswith('_raw.png'):
        name = f.replace('.png', '')
        if name not in to_process:
            to_process[name] = os.path.join(OUTDIR, f)

print(f"Processing {len(to_process)} images for bg removal")

all_names = list(to_process.keys())
for batch_start in range(0, len(all_names), BATCH_SIZE):
    batch = all_names[batch_start:batch_start + BATCH_SIZE]
    batch_num = batch_start // BATCH_SIZE + 1
    total_batches = (len(all_names) + BATCH_SIZE - 1) // BATCH_SIZE
    print(f"\n--- BG Batch {batch_num}/{total_batches} ---")

    jobs = {}
    for name in batch:
        filepath = to_process[name]
        with open(filepath, "rb") as f:
            img_b64 = base64.b64encode(f.read()).decode()
        resp = curl_json("POST", f"/generate/custom/{REMBG_MODEL}", {
            "image": f"data:image/png;base64,{img_b64}",
            "preserveAlpha": True,
        })
        if resp and "job" in resp:
            jobs[name] = resp["job"]["jobId"]
            print(f"  → {name} submitted")
        else:
            print(f"  ✗ {name} failed")
            if resp: print(f"    {json.dumps(resp)[:100]}")
        time.sleep(0.5)

    if jobs:
        downloaded, _ = wait_jobs(jobs, "rembg")
        for name, asset_id in downloaded.items():
            outpath = os.path.join(OUTDIR, f"{name}.png")
            if download_asset(asset_id, outpath):
                print(f"  ⬇ {name}.png saved (bg removed)")

    if batch_start + BATCH_SIZE < len(all_names):
        time.sleep(2)

# Cleanup raw files
for name, rawpath in all_gen_assets.items():
    if os.path.exists(rawpath):
        os.remove(rawpath)

print("\n" + "=" * 60)
print("DONE")
print("=" * 60)
pngs = sorted([f for f in os.listdir(OUTDIR) if f.endswith('.png') and not f.endswith('_raw.png')])
print(f"Total PNGs: {len(pngs)}")
for p in pngs:
    sz = os.path.getsize(os.path.join(OUTDIR, p))
    print(f"  {p} ({sz}B)")
