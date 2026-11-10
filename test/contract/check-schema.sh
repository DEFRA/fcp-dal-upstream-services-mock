#!/usr/bin/env bash
set -e
# fail a pipeline when any command in it fails, e.g. yq in the schema mutation's `yq | tee`
set -o pipefail

# setup
baseDir=`cd $(dirname $0) ; pwd`
cd $baseDir
rootDir=`cd ../.. ; pwd`
mkdir -p ./tmp
chmod 777 ./tmp
KITS_EXTERNAL_URL="${KITS_EXTERNAL_URL:-https://ephemeral-protected.api.dev.cdp-int.defra.cloud/fcp-dal-upstream-services-mock/proxy/external/extapi}"

usage() {
  set +x
  echo
  echo "Run schemathesis contract tests against the upstream KITS (internal or external gateway) or Hitachi."
  echo "All tests are run against the 'upgrade' API env."
  echo
  echo "Usage: $0 {a|auth|authenticate|b|bank|iu|internal-user|l|land|o|org|organisation|p|person|pe|person-external|perm|permissions|r|rd|reference-data|pd|payments|s|sa|siti-agri|help}"
  echo
  echo "Where the argument specifies which schema to test:"
  echo "  a  | auth | authenticate - test the Authenticate schema"
  echo "  b  | bank                - test the Bank Change Service schema"
  echo "  iu | internal-user       - test the Internal User Authorisation schema"
  echo "  l  | land                - test the Land schema"
  echo "  o  | org | organisation  - test the Organisation schema"
  echo "  p  | person              - test the Person schema (KITS internal gateway endpoints only)"
  echo "  pe | person-external     - test the Person schema endpoints on the KITS EXTERNAL gateway"
  echo "                           (/person/{personId}/{email}/confirm and /verify-email/{digitalContactPartyId})"
  echo "  perm | permissions       - test the Authorisation (Permissions) schema (KITS EXTERNAL gateway)"
  echo "  r  | rd | reference-data - test the Reference Data schema"
  echo "  pd | payments            - test the Payment Details schema"
  echo "  s  | sa | siti-agri      - test the Siti-Agri schema"
  echo "  h  | help                - show this help message"
  echo
  echo "NOTE: the organisation schema's operations that write upstream (authorisation, lock and"
  echo "      unlock) are only checked when an org and person are explicitly defined in environment variables:"
  echo "  CONTRACT_WRITE_ORG_ID    - orgId to authorise, lock and unlock"
  echo "  CONTRACT_WRITE_PERSON_ID - personId whose authorisation on that org is overwritten"
  echo
  echo "NOTE: the person schema's operations that write upstream (update, lock and unlock) are only"
  echo "      checked when a person is explicitly defined in an environment variable:"
  echo "  CONTRACT_WRITE_PERSON_ID - personId to update, lock and unlock"
  echo
  echo "NOTE: additionally the following environment variables must be set:"
  echo "  CDP_API_KEY - CDP Platform developer API key "
  echo "  KITS_INTERNAL_URL  - the URL of the KITS API to use (this should be the DAL Mock proxy endpoint, via the ephemeral endpoint)"
  echo "  CDP_API_KEY    - CDP Platform developer API key"
  echo "  DEFRA_ID_TOKEN - a pre-issued Defra Identity token; if unset one is generated"
  echo "                   with scripts/get-defra-id-token.js, which needs DEFRA_ID_CRN,"
  echo "                   DEFRA_ID_PASSWORD and the DEFRA_ID_* client config (see .env.example)"
  echo "  DEFRA_ID_PERSON_ID / DEFRA_ID_EMAIL - the Defra ID user's personId and email, used as"
  echo "                   examples for person-external; looked up from their person summary if unset"
  echo "  KITS_EXTERNAL_URL - the URL of the KITS EXTERNAL proxy endpoint (defaults to"
  echo "                      the deployed mock's /proxy/external/extapi ephemeral route)"
  echo "or..."
  echo "  HITACHI_CLIENT_SECRET - the client secret for token generation"
  echo
  echo "NOTE: the example identifiers default to synthetic values (the mock's own test data), which"
  echo "      don't exist upstream. To check successful responses, set these to real 'upgrade' IDs,"
  echo "      e.g. in .env (lists are comma-separated):"
  echo "  bank:           CONTRACT_BANK_ORG_ID, CONTRACT_BANK_PERSON_ID, CONTRACT_BANK_SBI,"
  echo "                  CONTRACT_BANK_FRN, CONTRACT_BANK_CRN (one linked record)"
  echo "  authenticate:   CONTRACT_AUTH_CRNS"
  echo "  land:           CONTRACT_LAND_ORG_ID, CONTRACT_LAND_SHEET_ID, CONTRACT_LAND_PARCEL_ID"
  echo "  organisation:   CONTRACT_ORG_IDS, CONTRACT_ORG_SEARCH_SBIS (3), CONTRACT_ORG_SEARCH_POSTCODE"
  echo "  person:         CONTRACT_PERSON_IDS, CONTRACT_PERSON_SEARCH_CRNS (3),"
  echo "                  CONTRACT_PERSON_SEARCH_PERSONAL_ID, CONTRACT_PERSON_SEARCH_SURNAME,"
  echo "                  CONTRACT_PERSON_SEARCH_POSTCODE"
  echo "  siti-agri:      CONTRACT_SITI_SBIS (applications and CPHs), CONTRACT_SITI_AGREEMENT_SBIS,"
  echo "                  CONTRACT_SITI_LAND_SHEETS, CONTRACT_SITI_LAND_PARCELS, CONTRACT_SITI_LAND_SBI"
  echo "  person-external: CONTRACT_SUMMARY_PERSON_ID (personId in the summary URL used to look up"
  echo "                  the Defra ID user)"
  echo "  permissions:    CONTRACT_PERMISSIONS_ORG_ID (used when the token has no currentRelationshipId)"
  echo "  payments:       CONTRACT_PAYMENTS_SUPPLIER_ACCOUNTS"
}

# Example identifiers. The defaults are synthetic (from the mock's SFD test data), so upstream will
# 404 for them; real 'upgrade' IDs are supplied through the environment, never committed.
: "${CONTRACT_BANK_ORG_ID:=8600001}"
: "${CONTRACT_BANK_PERSON_ID:=9500017}"
: "${CONTRACT_BANK_SBI:=850000001}"
: "${CONTRACT_BANK_FRN:=9100000001}"
: "${CONTRACT_BANK_CRN:=9500017000}"
: "${CONTRACT_AUTH_CRNS:=9500001000,9500002000,9500003000,9500004000,9500005000}"
: "${CONTRACT_LAND_ORG_ID:=8600001}"
: "${CONTRACT_LAND_SHEET_ID:=TE0001}"
: "${CONTRACT_LAND_PARCEL_ID:=1001}"
: "${CONTRACT_ORG_IDS:=8600001,8600002,8600003}"
: "${CONTRACT_ORG_SEARCH_SBIS:=850000001,850000002,850000003}"
: "${CONTRACT_ORG_SEARCH_POSTCODE:=TE1 2ST}"
: "${CONTRACT_PERSON_IDS:=9500001,9500002,9500003}"
: "${CONTRACT_PERSON_SEARCH_CRNS:=9500001000,9500002000,9500003000}"
: "${CONTRACT_PERSON_SEARCH_PERSONAL_ID:=910000001}" # sfd-id-check: allow - personal identifier
: "${CONTRACT_PERSON_SEARCH_SURNAME:=Searchington}"
: "${CONTRACT_PERSON_SEARCH_POSTCODE:=TE1 2ST}"
: "${CONTRACT_SITI_SBIS:=850000001,850000002,850000003,850000004,850000005,850000006,850000007}"
: "${CONTRACT_SITI_AGREEMENT_SBIS:=850000001,850000002,850000003,850000004,850000005}"
: "${CONTRACT_SITI_LAND_SHEETS:=TE0001,TE0002,TE0003}"
: "${CONTRACT_SITI_LAND_PARCELS:=1001,1002,1003}"
: "${CONTRACT_SITI_LAND_SBI:=850000001}"
: "${CONTRACT_SUMMARY_PERSON_ID:=9500001}"
: "${CONTRACT_PERMISSIONS_ORG_ID:=8600001}"
: "${CONTRACT_PAYMENTS_SUPPLIER_ACCOUNTS:=9100000002,9100000003,9100000004}"

# usage: contract_list VALUE [number|string]
# Prints the comma-separated VALUE as a JSON array, for the mutations to read with yq's env().
contract_list() {
  jq -cn --arg value "$1" --arg type "${2:-number}" \
    '$value | split(",") | map(gsub("^\\s+|\\s+$"; "")) | if $type == "number" then map(tonumber) else . end'
}

# usage: require_numeric NAME...
# Exports each named variable for yq's env()/strenv(), failing unless its value is all digits.
require_numeric() {
  local name
  for name in "$@"; do
    if ! [[ "${!name}" =~ ^[0-9]+$ ]]; then
      echo "ERROR: ${name} must be a number, got '${!name}'" 1>&2
      exit 1
    fi
    export "${name}"
  done
}

cleanup() {
  local status=$?
  if [ ${status} -ne 0 ] && ls "${baseDir}"/tmp/*vcr.yaml > /dev/null 2>&1; then
    echo "NOTE: reports from the failed run left in ${baseDir}/tmp" 1>&2
    return
  fi
  rm -rf "${baseDir}/tmp"
}
trap cleanup EXIT

# Resolve the Defra ID token (generating one if needed) and default DEFRA_ID_CRN and
# DEFRA_ID_RELATIONSHIP_ID (the example orgId) from its claims.
resolve_defra_id_token() {
  if [ -z "${DEFRA_ID_TOKEN}" ]; then
    if [ -z "${DEFRA_ID_CRN}" ]; then
      echo "ERROR: DEFRA_ID_CRN (plus DEFRA_ID_PASSWORD and the DEFRA_ID_* config) must be set to generate a Defra Identity token" 1>&2
      usage
      exit 1
    fi
    echo "Generating a Defra Identity token for the external gateway..."
    DEFRA_ID_TOKEN=$( node "${rootDir}/scripts/get-defra-id-token.js" )
    if [ -z "${DEFRA_ID_TOKEN}" ]; then
      echo "ERROR: DEFRA_ID_TOKEN was not generated correctly" 1>&2
      usage
      exit 1
    fi
  fi
  claim() {
    node -p 'JSON.parse(Buffer.from(process.argv[2].split(".")[1], "base64url").toString())[process.argv[1]] ?? ""' "$1" "${DEFRA_ID_TOKEN}"
  }
  DEFRA_ID_CRN="${DEFRA_ID_CRN:-$( claim contactId )}"
  ORG_ID="${DEFRA_ID_RELATIONSHIP_ID:-$( claim currentRelationshipId )}"
}

# Resolve the Defra ID user's personId and email (PERSON_ID, PERSON_EMAIL) from the KITS
# EXTERNAL gateway's person summary, requested with the personId override (CONTRACT_SUMMARY_PERSON_ID) and
# their crn. Either can be set explicitly with DEFRA_ID_PERSON_ID / DEFRA_ID_EMAIL.
resolve_defra_id_person() {
  PERSON_ID="${DEFRA_ID_PERSON_ID}"
  PERSON_EMAIL="${DEFRA_ID_EMAIL}"
  if [ -n "${PERSON_ID}" ] && [ -n "${PERSON_EMAIL}" ]; then
    return
  fi
  local summary
  summary=$( curl --silent --fail \
    --header "x-api-key: ${CDP_API_KEY}" \
    --header "Authorization: ${DEFRA_ID_TOKEN}" \
    --header "crn: ${DEFRA_ID_CRN}" \
    "${KITS_EXTERNAL_URL}/person/${CONTRACT_SUMMARY_PERSON_ID}/summary" ) || {
    echo "ERROR: could not retrieve the person summary for crn ${DEFRA_ID_CRN}; set DEFRA_ID_PERSON_ID and DEFRA_ID_EMAIL" 1>&2
    exit 1
  }
  PERSON_ID="${PERSON_ID:-$( echo "${summary}" | jq -r '._data.id // empty' )}"
  PERSON_EMAIL="${PERSON_EMAIL:-$( echo "${summary}" | jq -r '._data.email // empty' )}"
  if [ -z "${PERSON_ID}" ] || [ -z "${PERSON_EMAIL}" ]; then
    echo "ERROR: the person summary for crn ${DEFRA_ID_CRN} had no id/email; set DEFRA_ID_PERSON_ID and DEFRA_ID_EMAIL" 1>&2
    exit 1
  fi
}

# check OPTION argument
case "$1" in
  h | help | --help | -h )
    usage
    exit 0
    ;;
  # KITS APIs (internal gateway)
  b | bank )
    schema="kits-v1/bank"
    export CONTRACT_BANK_ORG_ID CONTRACT_BANK_PERSON_ID CONTRACT_BANK_SBI CONTRACT_BANK_FRN CONTRACT_BANK_CRN
    mutations='. |
.components.schemas.SubmissionRequest.examples[0].organisationId = strenv(CONTRACT_BANK_ORG_ID) |
.components.schemas.SubmissionRequest.examples[0].personId = strenv(CONTRACT_BANK_PERSON_ID) |
.components.schemas.SubmissionRequest.examples[0].sbi = strenv(CONTRACT_BANK_SBI) |
.components.schemas.SubmissionRequest.examples[0].frn = strenv(CONTRACT_BANK_FRN) |
.components.schemas.SubmissionRequest.examples[0].crn = strenv(CONTRACT_BANK_CRN) |
.components.schemas.SubmissionRequest.properties.organisationId.enum = [strenv(CONTRACT_BANK_ORG_ID)] |
.components.schemas.SubmissionRequest.properties.personId.enum = [strenv(CONTRACT_BANK_PERSON_ID)] |
.components.schemas.ValidateRequest.examples[0].sbi = strenv(CONTRACT_BANK_SBI) |
.components.schemas.ValidateRequest.examples[0].frn = strenv(CONTRACT_BANK_FRN) |
.components.schemas.ValidateRequest.examples[0].crn = strenv(CONTRACT_BANK_CRN) |
.paths["/bank-change-service/v1/locked-status/{organisationId}/{personId}"].get.parameters[0].schema.examples = [strenv(CONTRACT_BANK_ORG_ID)] |
.paths["/bank-change-service/v1/locked-status/{organisationId}/{personId}"].get.parameters[1].schema.examples = [strenv(CONTRACT_BANK_PERSON_ID)] |
.paths["/bank-change-service/v1/account-status/{organisationId}"].get.parameters[0].schema.examples = [strenv(CONTRACT_BANK_ORG_ID)] |
.paths["/bank-change-service/v1/existing-accounts/{frn}"].get.parameters[0].schema.examples = [strenv(CONTRACT_BANK_FRN)]'
    gateway="kits-internal"
    ;;
  a | auth | authenticate )
    schema="kits-v1/authenticate"
    export AUTH_CRNS=$( contract_list "${CONTRACT_AUTH_CRNS}" )
    mutations='. |
.paths["/external-auth/security-answers/{crn}"].get.parameters[0].schema.examples = env(AUTH_CRNS)'
    gateway="kits-internal"
    ;;
  iu | internal-user )
    schema="kits-v1/internal-user"
    mutations='.'
    gateway="kits-internal"
    ;;
  l | land )
    schema="kits-v1/land"
    export LAND_ORG_IDS=$( contract_list "${CONTRACT_LAND_ORG_ID}" )
    export CONTRACT_LAND_SHEET_ID CONTRACT_LAND_PARCEL_ID
    mutations='. |
.components.parameters.organisationId.schema.examples = env(LAND_ORG_IDS) |
.components.parameters.sheetId.schema.examples = [strenv(CONTRACT_LAND_SHEET_ID)] |
.components.parameters.parcelId.schema.examples = [strenv(CONTRACT_LAND_PARCEL_ID)] |
.components.parameters.historicDate.schema.examples = ["19-Jul-24"] |
.paths["/lms/organisation/{organisationId}/parcel/sheet-id/{sheetId}/parcel-id/{parcelId}/historic/{historicDate}/land-covers"].get.parameters[4].schema.examples = [true, false]'
    gateway="kits-internal"
    ;;
  o | org | organisation )
    schema="kits-v1/organisation"
    # NOTE: deactivate and reactivate are left out, as generated organisationIds may be real businesses
    export ORG_IDS=$( contract_list "${CONTRACT_ORG_IDS}" )
    export ORG_SEARCH_SBIS=$( contract_list "${CONTRACT_ORG_SEARCH_SBIS}" string )
    export CONTRACT_ORG_SEARCH_POSTCODE
    mutations='. |
del(.paths["/organisation/{organisationId}/deactivate"], .paths["/organisation/{organisationId}/reactivate"]) |
.paths["/organisation/{organisationId}"].get.parameters[0].schema.examples = env(ORG_IDS) |
.components.schemas.SearchRequestBody.examples[0].primarySearchPhrase = env(ORG_SEARCH_SBIS)[0] |
.components.schemas.SearchRequestBody.examples[1].primarySearchPhrase = env(ORG_SEARCH_SBIS)[1] |
.components.schemas.SearchRequestBody.examples[2].primarySearchPhrase = env(ORG_SEARCH_SBIS)[2] |
.components.schemas.SearchRequestBody.examples[3].primarySearchPhrase = "Wood" |
.components.schemas.SearchRequestBody.examples[4].primarySearchPhrase = strenv(CONTRACT_ORG_SEARCH_POSTCODE)'
    # These write upstream, so they only get the examples phase: the coverage phase makes up its
    # own boundary IDs, fuzzing sends random ones and stateful sends real orgIds from other
    # responses, none of which is safe against a real KITS env. Running from docker against the
    # mock is unaffected and all phases will run.
    write_operations='^(createAuthorisation|updateAuthorisation|removeAuthorisation|lockOrganisation|unlockOrganisation)$'
    # NOTE: the write operations are only checked when CONTRACT_WRITE_ORG_ID and
    # CONTRACT_WRITE_PERSON_ID are set. The run will lock and unlock that org, and overwrite (and
    # may remove) that person's authorisations on it, so use an org/person that is safe to modify (use RP
    # Gateway to verify the state of that org/person before the run, then manually restore that
    # state).
    if [ -n "${CONTRACT_WRITE_ORG_ID}" ] && [ -n "${CONTRACT_WRITE_PERSON_ID}" ]; then
      require_numeric CONTRACT_WRITE_ORG_ID CONTRACT_WRITE_PERSON_ID
      authorisation='.paths["/SitiAgriApi/authorisation/organisation/{orgId}/authorisation"].post'
      person_authorisation='.paths["/SitiAgriApi/authorisation/organisation/{orgId}/authorisation/person/{personId}"].put'
      remove_authorisation='.paths["/SitiAgriApi/authorisation/organisation/{orgId}/authorisation"].delete'
      # scheme privileges, to which upstream adds the matching "- SA" ones
      authorisation_body='{
  "personRoles": [{ "role": "Helper", "personId": env(CONTRACT_WRITE_PERSON_ID) }],
  "personPrivileges": [{ "personId": env(CONTRACT_WRITE_PERSON_ID), "privilegeNames": ["View - business","Amend - land","Amend - entitlement","Submit - bps"] }]
}'
      mutations="${mutations}"' |
.paths["/organisation/{organisationId}/lock"].post.parameters[0].schema.examples = [env(CONTRACT_WRITE_ORG_ID)] |
.paths["/organisation/{organisationId}/unlock"].post.parameters[0].schema.examples = [env(CONTRACT_WRITE_ORG_ID)] |
'"${authorisation}"'.parameters[0].schema.examples = [strenv(CONTRACT_WRITE_ORG_ID)] |
'"${authorisation}"'.requestBody.content["application/json"].example = '"${authorisation_body}"' |
'"${person_authorisation}"'.parameters[0].schema.examples = [strenv(CONTRACT_WRITE_ORG_ID)] |
'"${person_authorisation}"'.parameters[1].schema.examples = [env(CONTRACT_WRITE_PERSON_ID)] |
'"${person_authorisation}"'.requestBody.content["application/json"].example = '"${authorisation_body}"' |
'"${remove_authorisation}"'.parameters[0].schema.examples = [strenv(CONTRACT_WRITE_ORG_ID)] |
'"${remove_authorisation}"'.requestBody.content["application/json"].example = '"${authorisation_body}"
    elif [ -n "${CONTRACT_WRITE_ORG_ID}${CONTRACT_WRITE_PERSON_ID}" ]; then
      echo "ERROR: set both CONTRACT_WRITE_ORG_ID and CONTRACT_WRITE_PERSON_ID, or neither" 1>&2
      usage
      exit 1
    else
      skip_write_operations=true
    fi
    gateway="kits-internal"
    ;;
  p | person )
    schema="kits-v1/person"
    # NOTE: the confirm and verify-email endpoints are on the KITS EXTERNAL gateway, see person-external
    # NOTE: deactivate is left out, as it cannot be undone and generated personIds may be real people
    # NOTE: create is left out, as every accepted request creates a real person upstream
    export PERSON_IDS=$( contract_list "${CONTRACT_PERSON_IDS}" )
    export PERSON_SEARCH_CRNS=$( contract_list "${CONTRACT_PERSON_SEARCH_CRNS}" string )
    export CONTRACT_PERSON_SEARCH_PERSONAL_ID CONTRACT_PERSON_SEARCH_SURNAME CONTRACT_PERSON_SEARCH_POSTCODE
    mutations='. |
del(.paths["/person/{personId}/{email}/confirm"], .paths["/verify-email/{digitalContactPartyId}"]) |
del(.paths["/person/{personId}/deactivate"], .paths["/person/create"]) |
.paths["/person/{personId}/summary"].get.parameters[0].schema.examples = env(PERSON_IDS) |
.components.schemas.SearchRequestBody.examples[0].primarySearchPhrase = env(PERSON_SEARCH_CRNS)[0] |
.components.schemas.SearchRequestBody.examples[1].primarySearchPhrase = env(PERSON_SEARCH_CRNS)[1] |
.components.schemas.SearchRequestBody.examples[2].primarySearchPhrase = env(PERSON_SEARCH_CRNS)[2] |
.components.schemas.SearchRequestBody.examples[3].primarySearchPhrase = strenv(CONTRACT_PERSON_SEARCH_PERSONAL_ID) |
.components.schemas.SearchRequestBody.examples[4].primarySearchPhrase = strenv(CONTRACT_PERSON_SEARCH_SURNAME) |
.components.schemas.SearchRequestBody.examples[5].primarySearchPhrase = strenv(CONTRACT_PERSON_SEARCH_POSTCODE) |
.components.schemas.SearchRequestBody.examples[6].primarySearchPhrase = "123456" |
.components.schemas.SearchRequestBody.examples[7].primarySearchPhrase = "123456"'
    # These write upstream, so they only get the examples phase, as for the organisation schema
    write_operations='^(updatePersonDetails|lockPerson|unlockPerson)$'
    # NOTE: the write operations are only checked when CONTRACT_WRITE_PERSON_ID is set. The run will
    # lock and unlock that person, and overwrite their details, so use a person that is safe to modify
    # (use RP Gateway to verify the state of that person before the run, then manually restore that
    # state).
    if [ -n "${CONTRACT_WRITE_PERSON_ID}" ]; then
      require_numeric CONTRACT_WRITE_PERSON_ID
      update_person='.paths["/person/{personId}"].put'
      update_person_body='{ "firstName": "Contract", "lastName": "Test" }'
      mutations="${mutations}"' |
.paths["/person/{personId}/lock"].post.parameters[0].schema.examples = [env(CONTRACT_WRITE_PERSON_ID)] |
.paths["/person/{personId}/unlock"].post.parameters[0].schema.examples = [env(CONTRACT_WRITE_PERSON_ID)] |
'"${update_person}"'.parameters[0].schema.examples = [env(CONTRACT_WRITE_PERSON_ID)] |
'"${update_person}"'.requestBody.content["application/json"].example = '"${update_person_body}"
    else
      skip_write_operations=true
    fi
    gateway="kits-internal"
    ;;
  r | rd | reference-data )
    schema="kits-v1/reference-data"
    mutations='.'
    gateway="kits-internal"
    ;;
  s | sa | siti-agri )
    schema="kits-v1/siti-agri"
    export SITI_SBIS=$( contract_list "${CONTRACT_SITI_SBIS}" )
    export SITI_AGREEMENT_SBIS=$( contract_list "${CONTRACT_SITI_AGREEMENT_SBIS}" )
    export SITI_LAND_SHEETS=$( contract_list "${CONTRACT_SITI_LAND_SHEETS}" string )
    export SITI_LAND_PARCELS=$( contract_list "${CONTRACT_SITI_LAND_PARCELS}" )
    export SITI_LAND_SBIS=$( contract_list "${CONTRACT_SITI_LAND_SBI}" )
    mutations='. |
.paths["/SitiAgriApi/cv/appByBusiness/sbi/{sbi}/list"].get.parameters[0].schema.examples = env(SITI_SBIS) |
.paths["/SitiAgriApi/cv/agreementsByBusiness/sbi/{sbi}/list"].get.parameters[0].schema.examples = env(SITI_AGREEMENT_SBIS) |
.paths["/SitiAgriApi/cv/cphByBusiness/sbi/{sbi}/list"].get.parameters[0].schema.examples = env(SITI_SBIS) |
.paths["/SitiAgriApi/cv/landUseByBusinessParcel/sheet/{sheet}/parcel/{parcel}/sbi/{sbi}/list"].get.parameters[0].schema.examples = env(SITI_LAND_SHEETS) |
.paths["/SitiAgriApi/cv/landUseByBusinessParcel/sheet/{sheet}/parcel/{parcel}/sbi/{sbi}/list"].get.parameters[1].schema.examples = env(SITI_LAND_PARCELS) |
.paths["/SitiAgriApi/cv/landUseByBusinessParcel/sheet/{sheet}/parcel/{parcel}/sbi/{sbi}/list"].get.parameters[2].schema.examples = env(SITI_LAND_SBIS)'
    gateway="kits-internal"
    ;;
  # KITS APIs (EXTERNAL gateway)
  pe | person-external )
    schema="kits-v1/person"
    resolve_defra_id_token
    resolve_defra_id_person
    require_numeric PERSON_ID
    export PERSON_EMAIL
    # only the Person endpoints served by the KITS EXTERNAL gateway, see person
    # NOTE: confirm 404s unless personId is the token user's, so seed it (and their email) as examples
    mutations='. |
.paths |= with_entries(select(.key == "/person/{personId}/{email}/confirm" or .key == "/verify-email/{digitalContactPartyId}")) |
.paths["/person/{personId}/{email}/confirm"].get.parameters[0].schema.examples = [env(PERSON_ID)] |
.paths["/person/{personId}/{email}/confirm"].get.parameters[1].schema.examples = [strenv(PERSON_EMAIL), "contract-test@example.com"]'
    gateway="kits-external"
    ;;
  perm | permissions )
    schema="kits-v1/permissions"
    resolve_defra_id_token
    export PERMISSIONS_ORG_ID="${ORG_ID:-${CONTRACT_PERMISSIONS_ORG_ID}}"
    mutations='. |
.paths["/SitiAgriApi/authorisation/organisation/{orgId}/byFunction"].get.parameters[0].schema.examples = [env(PERMISSIONS_ORG_ID)]'
    gateway="kits-external"
    ;;
  # Hitachi API
  pd | payments )
    schema="hitachi/payments"
    export PAYMENTS_SUPPLIER_ACCOUNTS=$( contract_list "${CONTRACT_PAYMENTS_SUPPLIER_ACCOUNTS}" string )
    mutations='. |
.components.schemas.PaymentsRequest.properties.payment.properties.SupplierAccount.examples = env(PAYMENTS_SUPPLIER_ACCOUNTS)'
    gateway="hitachi"
    ;;
  *)
    echo "ERROR: Invalid argument: $1" 1>&2
    usage
    exit 1
esac

# mutate target schema - NOTE: the use of `tee` is intentional!!
yq eval -o=json -- "${mutations}" ${rootDir}/src/routes/${schema}-schema.oas.yml \
  | tee ./tmp/schema.json > /dev/null

# run schemathesis tests
if [ "${gateway}" = "kits-internal" ]; then # KITS internal gateway
  if [ -z "${CDP_API_KEY}" ]; then
    echo "ERROR: CDP_API_KEY environment variable is not set" 1>&2
    usage
    exit 1
  fi
  # NOTE: endpoint-specific check exclusions are configured in schemathesis.toml
  # usage: run_kits_internal REPORT_NAME [SCHEMATHESIS_RUN_OPTION...]
  run_kits_internal() {
    local report_name="$1"
    # drop REPORT_NAME, leaving only the schemathesis options in "$@"
    shift
    docker run --rm --network=host --pull always \
      -v ${baseDir}/tmp:/tmp \
      -v ${baseDir}/schemathesis.toml:/tmp/schemathesis.toml:ro \
      schemathesis/schemathesis:stable \
        --config-file /tmp/schemathesis.toml \
        run /tmp/schema.json \
          --header "email: ${TEST_USER_EMAIL:-testuser01@defra.gov.uk}" \
          --header "x-api-key: ${CDP_API_KEY}" \
          --exclude-checks=unsupported_method,not_a_server_error \
          --report-vcr-path "/tmp/${report_name}" \
          --url "${KITS_INTERNAL_URL:-https://ephemeral-protected.api.dev.cdp-int.defra.cloud/fcp-dal-upstream-services-mock/proxy/internal/extapi}" \
          "$@"
  }

  if [ -n "${write_operations}" ]; then
    # two passes, so the operations that write upstream only get the examples phase
    result=0
    if [ "${skip_write_operations}" = true ]; then
      echo "SKIPPED: the operations that write upstream, as the CONTRACT_WRITE_* environment" 1>&2
      echo "         variables are not set (see $0 help)" 1>&2
    else
      echo "Checking the operations that write upstream (examples phase only)..."
      run_kits_internal writes-vcr.yaml \
        --include-operation-id-regex "${write_operations}" --phases examples || result=1
    fi
    echo "Checking the other operations (all phases)..."
    run_kits_internal reads-vcr.yaml --exclude-operation-id-regex "${write_operations}" || result=1
    exit ${result}
  else
    run_kits_internal vcr.yaml
  fi

elif [ "${gateway}" = "kits-external" ]; then # KITS EXTERNAL gateway
  if [ -z "${CDP_API_KEY}" ]; then
    echo "ERROR: CDP_API_KEY environment variable is not set" 1>&2
    usage
    exit 1
  fi
  if [ -z "${DEFRA_ID_CRN}" ]; then
    echo "ERROR: DEFRA_ID_CRN is not set and could not be derived from the Defra ID token" 1>&2
    usage
    exit 1
  fi

  # NOTE: endpoint-specific check exclusions are configured in schemathesis.toml
  # NOTE: the KITS external gateway expects the RAW Defra ID JWT in Authorization without `Bearer` prefix
  docker run --rm --network=host --pull always \
    -v ${baseDir}/tmp:/tmp \
    -v ${baseDir}/schemathesis.toml:/tmp/schemathesis.toml:ro \
    schemathesis/schemathesis:stable \
      --config-file /tmp/schemathesis.toml \
      run /tmp/schema.json \
        --header "x-api-key: ${CDP_API_KEY}" \
        --header "Authorization: ${DEFRA_ID_TOKEN}" \
        --header "crn: ${DEFRA_ID_CRN}" \
        --exclude-checks=unsupported_method,not_a_server_error \
        --report-vcr-path /tmp/vcr.yaml \
        --url "${KITS_EXTERNAL_URL}"

else # hitachi
  if [ -z "${HITACHI_CLIENT_SECRET}" ]; then
    echo "ERROR: HITACHI_CLIENT_SECRET environment variable is not set" 1>&2
    usage
    exit 1
  fi

  HITACHI_TOKEN=$( curl --silent --request POST \
    --url https://login.microsoftonline.com/6f504113-6b64-43f2-ade9-242e05780007/oauth2/token \
    --header 'content-type: application/x-www-form-urlencoded' \
    --data grant_type=client_credentials \
    --data client_id=ef36f4e7-126d-46df-bc9b-c608a4b1e8fe \
    --data "client_secret=${HITACHI_CLIENT_SECRET}" \
    --data resource=https://orgcf202fa2.operations.eu.dynamics.com \
    | jq -r '.access_token' )

  # check the token looks good
  if [ "${HITACHI_TOKEN}" = "null" ]; then
    echo "ERROR: HITACHI_TOKEN was not generated correctly, check the secret is correct" 1>&2
    usage
    exit 1
  fi

  docker run --rm --network=host --pull always \
    -v ${baseDir}/tmp:/tmp \
    schemathesis/schemathesis:stable \
      run /tmp/schema.json \
        --exclude-checks=unsupported_method,not_a_server_error \
        --header "Authorization: Bearer ${HITACHI_TOKEN}" \
        --report-vcr-path /tmp/vcr.yaml \
        --url "${HITACHI_URL:-https://orgcf202fa2.operations.eu.dynamics.com/api}"
fi
