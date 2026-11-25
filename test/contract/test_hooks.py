import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch
from hooks import person_update_data_acceptance

class PersonUpdateDataAcceptanceTest(unittest.TestCase):
  NOW = 1700000000000
  PAST = NOW - 1
  FUTURE = NOW + 1

  def setUp(self):
    self.ctx = Mock()
    self.case = SimpleNamespace(
      method="PUT",
      operation=SimpleNamespace(path="/person/{personId}"),
      meta=SimpleNamespace(
        generation=SimpleNamespace(
          mode=SimpleNamespace(is_positive=True)
        )
      ),
      body={"dateOfBirth": self.PAST},
    )
    self.response = SimpleNamespace(status_code=204)

    self.enterContext(
      patch("hooks.time.time_ns", return_value=self.NOW * 1_000_000)
    )

    self.builtin_check = self.enterContext(
      patch("hooks.checks.positive_data_acceptance", create=True)
    )

  def check(self):
    return person_update_data_acceptance(
      self.ctx, self.response, self.case
    )

  def test_rejected_future_dates_are_accepted(self):
    for dob in (self.NOW, self.FUTURE, str(self.FUTURE)):
      with self.subTest(dob=dob):
        self.case.body = {"dateOfBirth": dob}
        self.response.status_code = 422

        self.assertIsNone(self.check())
        self.builtin_check.assert_not_called()

  def test_accepted_future_dates_raise_failure(self):
    for status in (200, 204):
      with self.subTest(status=status):
        self.case.body = {"dateOfBirth": self.FUTURE}
        self.response.status_code = status

        with self.assertRaisesRegex(
          AssertionError,
          "Future date of birth should have been rejected",
        ):
          self.check()

        self.builtin_check.assert_not_called()

  def test_other_dates_delegate_to_builtin_check(self):
    for body in (
        {"dateOfBirth": self.PAST},
        {"dateOfBirth": str(self.PAST)},
        {"dateOfBirth": None},
        {"dateOfBirth": ""},
        {"dateOfBirth": "invalid"},
        {"dateOfBirth": True},
        {"dateOfBirth": []},
        {},
        None,
        [],
    ):
      with self.subTest(body=body):
        self.builtin_check.reset_mock()
        self.case.body = body
        self.assertIs(self.check(), self.builtin_check.return_value)
        self.builtin_check.assert_called_once_with(
          self.ctx, self.response, self.case
        )

  def test_future_date_with_not_found_delegates(self):
    self.case.body = {"dateOfBirth": self.FUTURE}
    self.response.status_code = 404

    for result in (None, True):
      with self.subTest(result=result):
        self.builtin_check.reset_mock()
        self.builtin_check.return_value = result

        self.assertIs(self.check(), result)
        self.builtin_check.assert_called_once_with(
          self.ctx, self.response, self.case
        )

  def test_builtin_check_failure_is_propagated(self):
    self.response.status_code = 422
    self.builtin_check.side_effect = AssertionError(
      "Valid data should have been accepted"
    )

    with self.assertRaisesRegex(
      AssertionError, "Valid data should have been accepted"
    ):
      self.check()

  def test_negative_cases_are_ignored(self):
    self.case.meta.generation.mode.is_positive = False
    self.assertIs(self.check(), True)
    self.builtin_check.assert_not_called()

  def test_unrelated_methods_are_ignored(self):
    self.case.method = "POST"
    self.assertIs(self.check(), True)
    self.builtin_check.assert_not_called()

  def test_unrelated_paths_are_ignored(self):
    self.case.operation.path = "/organisation/{organisationId}"
    self.assertIs(self.check(), True)
    self.builtin_check.assert_not_called()

  def test_missing_metadata_is_ignored(self):
    self.case.meta = None
    self.assertIs(self.check(), True)
    self.builtin_check.assert_not_called()
