#!/usr/bin/env bash
set -euo pipefail

# Usage: ./fetch_parcels.sh org1,org2,org3 cert.pem key.pem email@example.com

ORG_IDS=$1
CERT_FILE=$2
KEY_FILE=$3
EMAIL=$4

BASE_URL="https://chs-upgrade-api.ruraldev.org.uk:8446/extapi/lms/organisation"

# Create an empty array to hold final JSON
RESULTS="[]"

# Split org ids into an array
IFS=',' read -ra ORG_ARRAY <<< "$ORG_IDS"

for ORG_ID in "${ORG_ARRAY[@]}"; do
  echo "Fetching parcels for orgId=$ORG_ID" >&2

  # Get parcels for this org
  PARCELS_JSON=$(curl -s --cert "$CERT_FILE" --key "$KEY_FILE" \
    -H "email: $EMAIL" \
    "$BASE_URL/$ORG_ID/geometries?bbox=0%2C0%2C0%2C0")

  # Loop over features in the parcel response
  PARCEL_COUNT=$(echo "$PARCELS_JSON" | jq '.features | length')

  for (( i=0; i<$PARCEL_COUNT; i++ )); do
    PARCEL=$(echo "$PARCELS_JSON" | jq ".features[$i]")
    SHEET_ID=$(echo "$PARCEL" | jq -r '.properties.sheetId')
    PARCEL_ID=$(echo "$PARCEL" | jq -r '.properties.parcelId')

    echo "  Parcel $PARCEL_ID (sheet $SHEET_ID)" >&2

    # Fetch covers for this parcel
    COVERS_JSON=$(curl -s --cert "$CERT_FILE" --key "$KEY_FILE" \
      -H "email: $EMAIL" \
      "$BASE_URL/$ORG_ID/parcel/sheet-id/$SHEET_ID/parcel-id/$PARCEL_ID/land-covers?includeGeometries=true")

    # Merge parcel + covers
    MERGED=$(jq -n \
      --argjson parcel "$PARCEL" \
      --argjson covers "$COVERS_JSON" \
      '{parcel: $parcel, covers: $covers.features}')

    RESULTS=$(echo "$RESULTS" | jq ". + [$MERGED]")
  done
done

echo "$RESULTS" | jq .
