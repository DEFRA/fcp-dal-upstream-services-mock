const LINK_VALIDITY_HOURS = 12

/**
 * Lookup of email validation records by crn.
 * An email validation record is used to identify a customer that
 * has requested to validate their email address during the login process
 * (you cannot login with a non validated email address)
 * crn is the key, email validation record is the value
 */
const emailValidationRecordsByCrn = {}

const normaliseEmail = (email) => String(email ?? '').toLowerCase()

/**
 * Saves or replaces the email validation record for a customer.
 * Upstream makes no checks against existing records: a new record is created, or the
 * existing record for the same crn is replaced.
 * @param {object} emailValidation
 * @param {string} emailValidation.customerReference - crn of the customer
 * @param {number} emailValidation.partyDigitalContactId - id of the party digital contact
 * @param {string} emailValidation.email - email address to validate
 * @param {string} [emailValidation.linkSentDate] - ISO timestamp the validation link was sent
 */
export const saveEmailValidation = ({
  customerReference,
  partyDigitalContactId,
  email,
  linkSentDate
}) => {
  emailValidationRecordsByCrn[customerReference] = {
    customerReference,
    partyDigitalContactId,
    email,
    linkSentDate
  }
}

export const findEmailValidation = ({ partyDigitalContactId, email }) => {
  const normalisedEmail = normaliseEmail(email)
  return Object.values(emailValidationRecordsByCrn).find(
    (record) =>
      record.partyDigitalContactId === partyDigitalContactId &&
      normaliseEmail(record.email) === normalisedEmail
  )
}

export const deleteEmailValidation = (customerReference) => {
  delete emailValidationRecordsByCrn[customerReference]
}

export const isEmailValidationLinkExpired = (linkSentDate) => {
  const sentAt = new Date(linkSentDate).getTime()
  if (Number.isNaN(sentAt)) {
    return true
  }

  return Date.now() - sentAt > LINK_VALIDITY_HOURS * 60 * 60 * 1000
}
