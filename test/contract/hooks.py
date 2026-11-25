import time

import schemathesis
from schemathesis import checks


def is_future_date_of_birth(body):
  if not isinstance(body, dict):
    return False

  dob = body.get("dateOfBirth")

  if isinstance(dob, str):
    try:
      dob = int(dob)
    except ValueError:
      return False

  if isinstance(dob, bool) or not isinstance(dob, (int, float)):
    return False

  now_ms = time.time_ns() // 1_000_000
  return dob >= now_ms


@schemathesis.check
def person_update_data_acceptance(ctx, response, case):
  """Account for the dateOfBirth constraint not expressible in OpenAPI."""
  if case.method.upper() != "PUT" or case.operation.path != "/person/{personId}":
    return True

  if case.meta is None or not case.meta.generation.mode.is_positive:
    return True

  if is_future_date_of_birth(case.body):
    if response.status_code == 422:
      return None

    if 200 <= response.status_code < 300:
      raise AssertionError("Future date of birth should have been rejected")

  return checks.positive_data_acceptance(ctx, response, case)
