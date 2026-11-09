#!/bin/bash

set -e

# Get main directories, and switch to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

# Generate TLS assets
echo "Generating TLS assets..."
rm -fr "${SCRIPT_DIR}/mtls"
"${SCRIPT_DIR}/setup-mtls.sh" mtls-protected-upstream-simulator

# Load env variables from generated TLS assets
export KITS_CA_CERT="$(cat "${SCRIPT_DIR}/mtls/ca.crt" | base64 -w0)"
export KITS_MOCK_TLS_SERVER_KEY="$(cat "${SCRIPT_DIR}/mtls/server.key" | base64 -w0)"
export KITS_MOCK_TLS_SERVER_CERT="$(cat "${SCRIPT_DIR}/mtls/server.crt" | base64 -w0)"
export KITS_INTERNAL_CONNECTION_KEY="$(cat "${SCRIPT_DIR}/mtls/client.key" | base64 -w0)"
export KITS_INTERNAL_CONNECTION_CERT="$(cat "${SCRIPT_DIR}/mtls/client.crt" | base64 -w0)"

# Run docker compose
echo
echo "Starting MTLS protected upstream & downstream..."
docker compose \
  -f "${PROJECT_ROOT}/compose.yml" \
  -f "${PROJECT_ROOT}/compose-proxy-upstream.yml" \
  -f "${PROJECT_ROOT}/compose-proxy-downstream.yml" \
  up \
  --build --quiet-pull

# clean-up generated TLS assets
echo
echo "Cleaning up TLS assets..."
rm -fr "${SCRIPT_DIR}/mtls"
