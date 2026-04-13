#!/usr/bin/env python3
"""Generate remaining 10 extinct animals + remove bg"""
import json, time, os, subprocess, base64

API = "https://api.cloud.scenario.com/v1"
KEY = "api_WvsRosfALpCZ9Si7qw36iXAF"
SECRET = "SpsiCSwMURjJLdEgxD1PCF1t"
AUTH_STR = "Basic " + base64.b64encode(f"{KEY}:{SECRET}".encode()).decode()
GEN_MODEL = "model_4RhbPuYCY43bic4kcYYniDna"
REMBG_MODEL = "model_bria-remove-background"
OUTDIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "animals")

STYLE = "cute miniature figurine, low poly style, soft pastel shading, simple clean design, full body, centered, solid white background, game asset"

REMAINING = [
    ("caspiantiger", "tawny orange caspian tiger with black stripes, muscular, thick fur"),
    ("barbarylion", "golden barbary lion with large dark thick mane, majestic, standing"),
    ("formosanleopard", "tawny formosan clouded leopard with cloud-shaped dark markings, long tail"),
    ("japanesewolf", "grey-brown japanese wolf, small wolf, compact body, bushy tail"),
    ("goldentoad", "bright orange golden toad, small shiny amphibian, vivid color"),
    ("caribbeanmonkseal", "grey caribbean monk seal, round body, flippers, lying on beach"),
    ("westernblackrhino", "dark grey western black rhinoceros, two horns, thick skin, sturdy"),
    ("chinesepaddlefish", "silver-grey chinese paddlefish, long paddle-shaped snout, large river fish"),
    ("bluebuck", "blue-grey bluebuck antelope, graceful, curved horns, slender body"),
    ("carolinaparakeet", "bright green and yellow carolina parakeet, orange head, colorful small parrot"),
]

def curl_json(method, path, data=None):
    cmd = ["curl", "-s", "--connect-timeout", "30", "--max-time", "180", "-X", method,
           "-H", f"Authorization: {AUTH_STR}", "-H", "Content-Type: application/json"]
    if data:
        cmd += ["-d", json.dumps(data)]
    cmd.append(f"{API}{path}")
    r = subprocess.run(cmd, capture_output=True, text=True)
    try: return json.loads(r.stdout) if r.stdout.strip() else None
    except: return None

def wait_job(job_id):
    for _ in range(50):
        time.sleep(6)
        r = curl_json("GET", f"/jobs/{job_id}")
        if r and "job" in r:
            j = r["job"]
            assets = j.get("metadata", {}).get("assetIds", [])
            if j["status"] == "success" and assets:
                return assets[0]
            if j["status"] == "failed":
                return None
    return None

def download(asset_id, path):
    r = curl_json("POST", f"/assets/{asset_id}/download", {"targetFormat": "png"})
    if r and "url" in r:
        subprocess.run(["curl", "-sL", "-o", path, r["url"]], capture_output=True)
        return os.path.exists(path) and os.path.getsize(path) > 1000
    return False

for name, desc in REMAINING:
    outpath = os.path.join(OUTDIR, f"{name}.png")
    if os.path.exists(outpath) and os.path.getsize(outpath) > 1000:
        print(f"⏭ {name} exists")
        continue

    print(f"\n{'='*40}")
    print(f"Processing: {name}")

    # Step 1: Generate
    print(f"  1/3 Generating...")
    r = curl_json("POST", "/generate/txt2img", {
        "modelId": GEN_MODEL, "prompt": f"{desc}, {STYLE}",
        "numSamples": 1, "width": 512, "height": 512,
        "guidance": 7, "numInferenceSteps": 20,
    })
    if not r or "job" not in r:
        print(f"  ✗ Gen failed: {r}")
        time.sleep(10)
        continue

    asset_id = wait_job(r["job"]["jobId"])
    if not asset_id:
        print(f"  ✗ Gen job failed")
        continue

    tmppath = os.path.join(OUTDIR, f"{name}_tmp.png")
    if not download(asset_id, tmppath):
        print(f"  ✗ Gen download failed")
        continue
    print(f"  ✓ Generated")

    # Step 2: Remove background
    print(f"  2/3 Removing background...")
    with open(tmppath, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()

    r = curl_json("POST", f"/generate/custom/{REMBG_MODEL}", {
        "image": f"data:image/png;base64,{img_b64}",
        "preserveAlpha": True,
    })
    if not r or "job" not in r:
        # Fallback: keep raw
        os.rename(tmppath, outpath)
        print(f"  ⚠ BG removal failed, keeping raw")
        continue

    asset_id = wait_job(r["job"]["jobId"])
    if asset_id and download(asset_id, outpath):
        os.remove(tmppath)
        print(f"  ✓ BG removed")
    else:
        os.rename(tmppath, outpath)
        print(f"  ⚠ BG download failed, keeping raw")

    print(f"  3/3 Done: {name}.png ({os.path.getsize(outpath)}B)")

print(f"\n{'='*40}")
print("ALL DONE")
total = len([f for f in os.listdir(OUTDIR) if f.endswith('.png') and not f.startswith('.')])
print(f"Total PNGs: {total}")
