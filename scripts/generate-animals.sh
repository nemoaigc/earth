#!/bin/bash
# Batch generate animal sprites via Scenario API
set -e

AUTH="Basic $(echo -n 'api_WvsRosfALpCZ9Si7qw36iXAF:SpsiCSwMURjJLdEgxD1PCF1t' | base64)"
API="https://api.cloud.scenario.com/v1"
MODEL="model_4RhbPuYCY43bic4kcYYniDna"
OUTDIR="$(dirname "$0")/../public/animals"
mkdir -p "$OUTDIR"

STYLE="cute miniature figurine, low poly style, soft pastel shading, simple clean design, full body, centered, solid white background, game asset"

# Define all animals: filename|prompt_description
declare -a ANIMALS=(
  # === EXTINCT / PREHISTORIC ===
  "trex|green and brown tyrannosaurus rex dinosaur, standing pose, sharp teeth, tiny arms"
  "triceratops|grey and tan triceratops dinosaur with three horns, sturdy body"
  "pteranodon|brown pteranodon flying dinosaur with large wingspan, side view"
  "brachiosaurus|green brachiosaurus dinosaur with very long neck, gentle giant"
  "stegosaurus|green and orange stegosaurus dinosaur with back plates and tail spikes"
  "mammoth|brown woolly mammoth with long curved tusks, thick fur"
  "sabertooth|tawny golden saber-toothed tiger with long fangs, muscular"
  "dodo|grey and white dodo bird, plump round body, small wings, hooked beak"
  "velociraptor|green and brown velociraptor, small agile dinosaur with claws"
  "spinosaurus|dark green spinosaurus dinosaur with large sail on back"
  "megalodon|dark grey megalodon giant prehistoric shark, massive jaws"
  "plesiosaur|blue-green plesiosaur marine reptile with long neck swimming"
  "woollyrhino|brown woolly rhinoceros with thick fur and horn"
  "ankylosaurus|brown and yellow ankylosaurus dinosaur with armored body and club tail"
  "parasaurolophus|green parasaurolophus dinosaur with curved head crest"
  "archaeopteryx|colorful feathered archaeopteryx, half bird half dinosaur"
  "thylacine|tawny brown thylacine tasmanian tiger with dark stripes on back"
  "ammonite|iridescent spiral ammonite shell sea creature"
  "groundsloth|brown giant ground sloth, large claws, shaggy fur, standing"
  "moa|brown and grey giant moa bird, very tall, no wings, long neck"
  # === ENDANGERED ===
  "panda|black and white giant panda bear sitting, eating bamboo"
  "snowleopard|white and grey snow leopard with dark spots, long fluffy tail"
  "orangutan|orange-red orangutan ape with long arms, gentle face"
  "gorilla|dark grey mountain gorilla, powerful build, gentle eyes"
  "tiger|orange tiger with black stripes, walking pose"
  "polarbear|white polar bear, large powerful build, arctic"
  "bluewhale|blue-grey blue whale, massive body, swimming in ocean"
  "seaturtle|green sea turtle with patterned shell, swimming"
  "redpanda|red-brown red panda with ringed tail, bushy, cute face"
  "rhinoceros|grey rhinoceros with horn, thick armored skin"
  "pangolin|brown pangolin with overlapping scales, curled slightly"
  "snowyowl|white snowy owl with yellow eyes, few dark spots"
  "crestedibis|white crested ibis bird with red face, elegant long beak"
  "baijidolphin|light grey baiji river dolphin, long snout, swimming"
  "amurleopard|golden yellow amur leopard with black rosettes, muscular"
)

echo "=== Submitting ${#ANIMALS[@]} generation jobs ==="

# Track job IDs
declare -A JOBS  # filename -> jobId

for entry in "${ANIMALS[@]}"; do
  IFS='|' read -r filename desc <<< "$entry"

  PROMPT="$desc, $STYLE"

  RESP=$(curl -s --connect-timeout 30 --max-time 60 -X POST "$API/generate/txt2img" \
    -H "Authorization: $AUTH" \
    -H "Content-Type: application/json" \
    -d "{
      \"modelId\": \"$MODEL\",
      \"prompt\": \"$PROMPT\",
      \"numSamples\": 1,
      \"width\": 512,
      \"height\": 512,
      \"guidance\": 7,
      \"numInferenceSteps\": 20
    }")

  JOBID=$(echo "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin)['job']['jobId'])" 2>/dev/null)

  if [ -n "$JOBID" ] && [ "$JOBID" != "" ]; then
    JOBS[$filename]=$JOBID
    echo "  ✓ $filename -> $JOBID"
  else
    echo "  ✗ $filename FAILED: $RESP"
  fi

  # Small delay to avoid rate limiting
  sleep 0.5
done

echo ""
echo "=== Submitted ${#JOBS[@]} jobs. Polling for completion... ==="

# Poll until all jobs complete
PENDING=${#JOBS[@]}
ATTEMPT=0
MAX_ATTEMPTS=60  # 60 * 10s = 10 min max

while [ $PENDING -gt 0 ] && [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  sleep 10
  ATTEMPT=$((ATTEMPT + 1))
  PENDING=0
  DONE=0
  FAILED=0

  for filename in "${!JOBS[@]}"; do
    JOBID=${JOBS[$filename]}

    # Skip already downloaded
    if [ -f "$OUTDIR/$filename.png" ]; then
      DONE=$((DONE + 1))
      continue
    fi

    STATUS=$(curl -s "$API/jobs/$JOBID" \
      -H "Authorization: $AUTH" \
      | python3 -c "
import json,sys
d=json.load(sys.stdin)
j=d['job']
status=j['status']
assets=j.get('metadata',{}).get('assetIds',[])
print(f'{status}|{assets[0] if assets else \"\"}')" 2>/dev/null)

    IFS='|' read -r st asset <<< "$STATUS"

    if [ "$st" = "success" ] && [ -n "$asset" ]; then
      # Download the asset
      DL_URL=$(curl -s -X POST "$API/assets/$asset/download" \
        -H "Authorization: $AUTH" \
        -H "Content-Type: application/json" \
        -d '{"targetFormat": "png"}' \
        | python3 -c "import json,sys; print(json.load(sys.stdin)['url'])" 2>/dev/null)

      if [ -n "$DL_URL" ]; then
        curl -sL -o "$OUTDIR/$filename.png" "$DL_URL"
        SIZE=$(stat -f%z "$OUTDIR/$filename.png" 2>/dev/null || echo 0)
        if [ "$SIZE" -gt 1000 ]; then
          echo "  ⬇ $filename.png downloaded (${SIZE}B)"
          DONE=$((DONE + 1))
        else
          echo "  ⚠ $filename.png too small, retrying next round"
          rm -f "$OUTDIR/$filename.png"
          PENDING=$((PENDING + 1))
        fi
      else
        PENDING=$((PENDING + 1))
      fi
    elif [ "$st" = "failed" ]; then
      echo "  ✗ $filename FAILED"
      FAILED=$((FAILED + 1))
    else
      PENDING=$((PENDING + 1))
    fi
  done

  echo "  [Poll #$ATTEMPT] Done: $DONE, Pending: $PENDING, Failed: $FAILED"
done

echo ""
echo "=== Generation complete ==="
ls -la "$OUTDIR"/*.png 2>/dev/null | wc -l
echo "PNG files generated"
