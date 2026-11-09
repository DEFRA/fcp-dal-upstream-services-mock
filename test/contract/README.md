# FCP DAL Upstream Contract Testing

The **Contract Testing** assets contained here - along with the _Open API Schema(ta)_ (**OAS**) describing the mock API routes - can be used to test and assure the accuracy of the `fcp-dal-upstream-services-mock` service.

## General approach

Automated tests are run using `schemathesis`, which runs a bunch of tests to check a target service behaves as a schema describes.
By testing the KITS live services (i.e. `upgrade`), the schemata for the various data domains can be verified.
These same schemata can then be used to check the mock to ensure proper conformance to the upstream.

> NOTE: Some minor schema mutation is necessary to change some fields, e.g. example references for successful data retrieval; but beyond this the mock should mirror exactly the functionality it emulates upstream. See [`test/contract/check-schema.sh`](./check-schema.sh)

## Checking a KITS target

Before running the script, you need to [create a developer API key](https://github.com/DEFRA/cdp-documentation/blob/main/how-to/developer-api-key.md).
This key will be valid for 24 hours.

Run the automated checks using the convenience script, get more by running:

```shell
test/contract/check-schema.sh help
```

...but basically something like the following:

```shell
export CDP_API_KEY=[KEY GENERATED ABOVE]
export KITS_INTERNAL_URL=https://ephemeral-protected.api.dev.cdp-int.defra.cloud/fcp-dal-upstream-services-mock/proxy/internal/extapi
test/contract/check-schema.sh person
```

This will perform a bunch of tests to check the specified schema (in this case the `person` schema) correctly describes the KITS endpoints' functionality.

### Example identifiers

The IDs the script uses as examples (orgs, people, CRNs, SBIs, FRNs, sheets/parcels, search phrases) are read from `CONTRACT_*` environment variables, listed by `check-schema.sh help`.
They default to synthetic values from the mock's own test data, which don't exist upstream, so KITS will mostly return 404s for them.
To check successful responses, set them to real `upgrade` IDs in your `.env` (which is gitignored, and loaded by `npm run test:contract:local`); lists are comma-separated:

```shell
CONTRACT_AUTH_CRNS=[CRN],[CRN]
CONTRACT_ORG_SEARCH_POSTCODE="[POSTCODE]"
```

> NOTE: Don't commit real customer identifiers to this repository; keep them in your environment only.

### Organisation operations that write upstream

The `organisation` schema's authorisation, lock and unlock operations write to KITS, so they are only checked when you explicitly define an org, and a person linked to it, for them to use:

```shell
export CONTRACT_WRITE_ORG_ID=[DISPOSABLE TEST ORG ID]
export CONTRACT_WRITE_PERSON_ID=[PERSON LINKED TO THAT ORG]
test/contract/check-schema.sh organisation
```

Without these, the rest of the schema is still checked and the write operations are reported as skipped. When set, the
run locks and unlocks that org, and overwrites (and may remove) that person's authorisation on it, so check their state
in RP Gateway before the run and restore it afterwards. The write operations only get schemathesis' examples
phase, in a separate run from the rest of the schema: the coverage, fuzzing and stateful phases would send them other
IDs, which could lock a real business or link the person to it.

### Person operations that write upstream

The `person` schema's update, lock and unlock operations write to KITS, so they are only checked when you explicitly
define a person for them to use:

```shell
export CONTRACT_WRITE_PERSON_ID=[DISPOSABLE TEST PERSON ID]
test/contract/check-schema.sh person
```

As for the organisation schema, without it they are reported as skipped, and when set they only get the examples phase.
The run locks and unlocks that person, and overwrites their details (with the name "Contract Test", clearing any other
fields), so check their state in RP Gateway before the run and restore it afterwards. The create and deactivate
operations are never checked against KITS, as every accepted create makes a new person and deactivate cannot be undone.

> NOTE: Only the KITS `upgrade` service is currently considered for testing, but other environments could also be checked by changing the target and providing the according mTLS details.

> NOTE: The script uses [yq](https://github.com/mikefarah/yq) - ensure you have it installed, as it is not a project-level installation

## Checking local mock

There is now a `/schemata` route that serves the OAS definitions of the mock, so checking mock endpoints match, is as simple as calling an NPM script with the target URL:

```shell
npm run test:contract
```

The above creates a local `docker compose` environment, spinning up the mock API and running `schemathesis` against it.

By default, this runs against all schemas. To restrict this to a subset, set the `SCHEMAS` environment variable to a space-separated list before running the script, e.g.:

```shell
SCHEMAS="land bank" npm run test:contract
```

### Generated test data

`schemathesis` generates random test data, so by default each run would exercise different inputs.
To keep PR checks stable, the local mock run uses a fixed seed (see [`compose.yml`](./compose.yml)), so the same data is generated each time.
To reproduce a failure seen elsewhere, or to explore different generated data, override the seed:

```shell
CONTRACT_TEST_SEED=12345 npm run test:contract
```

The requests/responses of each run are recorded in `test/contract/logs/<schema>.logs.yaml` (uploaded as a build artifact when the PR check fails).

Runs against KITS via `check-schema.sh` are deliberately left random, to catch upstream behaviour drifting from the schemata.
