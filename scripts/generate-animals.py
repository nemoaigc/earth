#!/usr/bin/env python3
"""Batch generate animal sprites via Scenario API - batches of 5"""
import json, time, os, subprocess, base64

API = "https://api.cloud.scenario.com/v1"
KEY = "api_WvsRosfALpCZ9Si7qw36iXAF"
SECRET = "SpsiCSwMURjJLdEgxD1PCF1t"
AUTH = "Basic " + base64.b64encode(f"{KEY}:{SECRET}".encode()).decode()
MODEL = "model_4RhbPuYCY43bic4kcYYniDna"
OUTDIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "animals")
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

def curl_json(method, path, data=None):
    """Use curl for all API calls to avoid Python SSL issues"""
    cmd = ["curl", "-s", "--connect-timeout", "30", "--max-time", "60"]
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
        except json.JSONDecodeError:
            print(f"  JSON decode error: {result.stdout[:100]}")
    return None

def curl_download(url, filepath):
    """Download file using curl"""
    cmd = ["curl", "-sL", "--connect-timeout", "30", "--max-time", "120", "-o", filepath, url]
    subprocess.run(cmd, capture_output=True)
    return os.path.exists(filepath) and os.path.getsize(filepath) > 1000

def submit_job(desc):
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
    resp = curl_json("POST", "/generate/txt2img", data)
    if resp and "job" in resp:
        return resp["job"]["jobId"]
    if resp and "reason" in resp:
        print(f"    API error: {resp['reason'][:80]}")
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

def process_batch(batch):
    """Submit a batch of up to 5 animals, wait for all to complete, download results"""
    jobs = {}

    # Submit all in batch
    for filename, desc in batch:
        outpath = os.path.join(OUTDIR, f"{filename}.png")
        if os.path.exists(outpath) and os.path.getsize(outpath) > 1000:
            print(f"  ⏭ {filename}.png exists, skip")
            continue

        job_id = submit_job(desc)
        if job_id:
            jobs[filename] = job_id
            print(f"  ✓ {filename} -> {job_id}")
        else:
            print(f"  ✗ {filename} submit failed")
        time.sleep(0.3)

    if not jobs:
        return

    # Poll until all done
    downloaded = set()
    failed = set()

    for attempt in range(1, 40):
        if len(downloaded) + len(failed) >= len(jobs):
            break
        time.sleep(8)
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
                    print(f"  ⚠ {filename} download failed, retry")
                    pending += 1
            elif status == "failed":
                print(f"  ✗ {filename} generation failed")
                failed.add(filename)
            else:
                pending += 1

        if pending > 0:
            print(f"    [poll #{attempt}] waiting for {pending}...")

    return downloaded, failed

# === MAIN ===
BATCH_SIZE = 5
total_downloaded = 0
total_failed = 0

for i in range(0, len(ANIMALS), BATCH_SIZE):
    batch = ANIMALS[i:i + BATCH_SIZE]
    batch_num = i // BATCH_SIZE + 1
    total_batches = (len(ANIMALS) + BATCH_SIZE - 1) // BATCH_SIZE
    names = [b[0] for b in batch]
    print(f"\n=== Batch {batch_num}/{total_batches}: {', '.join(names)} ===")

    result = process_batch(batch)
    if result:
        d, f = result
        total_downloaded += len(d)
        total_failed += len(f)

    # Wait a moment before next batch
    if i + BATCH_SIZE < len(ANIMALS):
        time.sleep(2)

print(f"\n=== DONE === Downloaded: {total_downloaded}, Failed: {total_failed}")
pngs = [f for f in os.listdir(OUTDIR) if f.endswith('.png')]
print(f"Total PNGs: {len(pngs)}")
for p in sorted(pngs):
    print(f"  {p}")
