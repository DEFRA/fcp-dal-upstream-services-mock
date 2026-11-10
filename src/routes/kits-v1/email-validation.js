import Boom from '@hapi/boom'
import { createLogger } from '../../common/helpers/logging/logger.js'
import {
  deleteEmailValidation,
  findEmailValidation,
  isEmailValidationLinkExpired,
  saveEmailValidation
} from '../../factories/person/email-validation.factory.js'
import { markPersonEmailValidated } from '../../factories/person/person.factory.js'

const logger = createLogger('email-validation.route')

const jerseyError = (request, h, message, statusCode) =>
  h
    .response({
      servlet: 'jersey',
      message,
      url: request.path,
      status: String(statusCode)
    })
    .code(statusCode)

export const emailValidation = [
  {
    method: 'POST',
    path: '/external-auth/email-validation',
    handler: async (request, h) => {
      const { customerReference, partyDigitalContactId, email } =
        request.payload ?? {}
      if (!customerReference) {
        logger.info(
          'No customerReference provided, cannot save email validation'
        )
        return jerseyError(request, h, 'Internal Server Error', 500)
      }

      // emulateUpstreamErrors turns these into upstream's unhandled exception body
      if (
        partyDigitalContactId === undefined ||
        partyDigitalContactId === null
      ) {
        throw Boom.internal(
          'No partyDigitalContactId provided, cannot save email validation'
        )
      }

      if (email === undefined || email === null) {
        throw Boom.internal('No email provided, cannot save email validation')
      }

      // Upstream does not check the customer or digital contact exists, or that the email
      // matches the digital contact - any of these is still saved with 200
      saveEmailValidation(request.payload)

      // Upstream has a documented 409 (email already saved for this CRN) but code analysis
      // shows that path is dead — a same-CRN duplicate save silently succeeds with 200.
      return h.response().code(200)
    }
  },
  {
    method: 'POST',
    path: '/external-auth/email-validation/validate-email',
    handler: async (request, h) => {
      // Upstream matches on partyDigitalContactId and email only; customerReference is ignored
      const { partyDigitalContactId, email } = request.payload ?? {}
      const record = findEmailValidation({ partyDigitalContactId, email })

      if (!record) {
        logger.info(
          `No email validation record for partyDigitalContactId ${partyDigitalContactId} and email provided`
        )
        return jerseyError(request, h, 'Not Found', 404)
      }

      const { customerReference } = record

      if (isEmailValidationLinkExpired(record.linkSentDate)) {
        logger.info(
          `link expired for CRN ${customerReference} (linkSentDate ${record.linkSentDate})`
        )
        return h.response().code(401)
      }

      markPersonEmailValidated(customerReference, record.email)
      deleteEmailValidation(customerReference)

      return h.response().code(200)
    }
  }
]
