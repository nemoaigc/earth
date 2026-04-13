#!/usr/bin/env python3
"""Remove backgrounds from all animal PNGs using Scenario API's Bria model"""
import json, time, os, subprocess, base64

API = "https://api.cloud.scenario.com/v1"
KEY = "api_WvsRosfALpCZ9Si7qw36iXAF"
SECRET = "SpsiCSwMURjJLdEgxD1PCF1t"
AUTH = "Basic " + base64.b64encode(f"{KEY}:{SECRET}".encode()).decode()
MODEL = "model_bria-remove-background"
ANIMALS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "animals")
BACKUP_DIR = os.path.join(ANIMALS_DIR, "originals")

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
    cmd = ["curl", "-sL", "--connect-timeout", "30", "--max-time", "120", "-o", filepath, url]
    subprocess.run(cmd, capture_output=True)
    return os.path.exists(filepath) and os.path.getsize(filepath) > 1000

def submit_rembg(filepath):
    with open(filepath, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()
    data = {
        "image": f"data:image/png;base64,{img_b64}",
        "preserveAlpha": True
    }
    resp = curl_json("POST", f"/generate/custom/{MODEL}", data)
    if resp and "job" in resp:
        return resp["job"]["jobId"]
    if resp:
        print(f"    Error: {json.dumps(resp)[:150]}")
    return None

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

pngs = sorted([f for f in os.listdir(BACKUP_DIR) if f.endswith('.png')])
print(f"Found {len(pngs)} PNGs to process")

for batch_start in range(0, len(pngs), BATCH_SIZE):
    batch = pngs[batch_start:batch_start + BATCH_SIZE]
    batch_num = batch_start // BATCH_SIZE + 1
    total_batches = (len(pngs) + BATCH_SIZE - 1) // BATCH_SIZE
    print(f"\n=== Batch {batch_num}/{total_batches}: {', '.join(f.replace('.png','') for f in batch)} ===")

    jobs = {}
    for f in batch:
        # Skip if already processed (check if output differs from original)
        outpath = os.path.join(ANIMALS_DIR, f)
        origpath = os.path.join(BACKUP_DIR, f)

        job_id = submit_rembg(origpath)
        if job_id:
            jobs[f] = job_id
            print(f"  ✓ {f} -> {job_id}")
        else:
            print(f"  ✗ {f} failed")
        time.sleep(0.5)

    if not jobs:
        continue

    downloaded = set()
    failed = set()
    for attempt in range(1, 40):
        if len(downloaded) + len(failed) >= len(jobs):
            break
        time.sleep(6)
        pending = 0
        for f, job_id in jobs.items():
            if f in downloaded or f in failed:
                continue
            status, asset_id = check_job(job_id)
            if status == "success" and asset_id:
                outpath = os.path.join(ANIMALS_DIR, f)
                if download_asset(asset_id, outpath):
                    print(f"  ⬇ {f} done ({os.path.getsize(outpath)}B)")
                    downloaded.add(f)
                else:
                    pending += 1
            elif status == "failed":
                print(f"  ✗ {f} failed")
                failed.add(f)
            else:
                pending += 1
        if pending:
            print(f"    [poll #{attempt}] waiting for {pending}...")

    if batch_start + BATCH_SIZE < len(pngs):
        time.sleep(2)

print(f"\n=== Done ===")
