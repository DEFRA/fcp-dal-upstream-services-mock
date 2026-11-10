import { frnToOrgId } from '../../factories/id-lookups.js'
import { retrieveOrganisation } from '../../factories/organisation/organisation.factory.js'
import { retrievePayments } from '../../factories/payments.factory.js'
import { createPayloadValidator } from '../../utils/validatePayload.js'

const dataErrorResponse = {
  Message:
    'An exception occured when invoking the operation ' +
    '- Object reference not set to an instance of an object.',
  ExceptionType: 'NullReferenceException',
  ActivityId: 'some-long-uuid'
}

const problemResponse = {
  $id: '1',
  Result: false,
  parmSupplierInfo: null,
  parmPayments: null
}
const frnNotProvidedResponse = {
  ...problemResponse,
  InfoMessages: ['*** No FRN provided', 'No data retrieved for this request']
}
const frnNotFoundResponse = {
  ...problemResponse,
  InfoMessages: ['*** FRN does not exist', 'No data retrieved for this request']
}
const badDateFormatResponse = {
  ...problemResponse,
  InfoMessages: [
    '*** Invalid date range provided',
    'No data retrieved for this request'
  ]
}

const path =
  '/services/RSFVendPaymentDetailsServiceGroup' +
  '/RSFVendPaymentDetailsService/getSupplierPaymentsPackage'
const validateRequestPayload = await createPayloadValidator(
  'routes/hitachi/payments-schema.oas.yml',
  (schema) =>
    schema.paths[path].post.requestBody.content['application/json'].schema
)

export const payments = [
  {
    method: 'POST',
    path,
    handler: async (request, h) => {
      // dummy authorisation check
      if (request?.headers?.authorization?.toLowerCase() !== 'bearer token') {
        return h.response().code(401)
      }

      // check request body for required fields
      const body = request?.payload?.request || {}
      if (!body?.payment || !body?.audit) {
        return h.response(dataErrorResponse).code(500)
      }

      // check required fields are objects
      if (!validateRequestPayload(request.payload)) {
        return h.response(dataErrorResponse).code(400)
      }

      // check FRN specified (SupplierAccount)
      const { SupplierAccount, FromDate, ToDate } = body.payment
      if (!SupplierAccount) {
        return h.response(frnNotProvidedResponse)
      }

      // check date range filters
      const fromDate = new Date(FromDate).getTime()
      const toDate = new Date(ToDate).getTime()
      if (
        (FromDate && Number.isNaN(fromDate)) ||
        (ToDate && Number.isNaN(toDate))
      ) {
        return h.response(badDateFormatResponse)
      }

      // check a business with the specified FRN exists
      const orgId = frnToOrgId[SupplierAccount]
      if (!orgId) {
        return h.response(frnNotFoundResponse)
      }

      // lookup/generate response contents
      let { parmPayments, ...responseContents } =
        retrievePayments(SupplierAccount)

      // conditionally apply date range filters
      if (FromDate || ToDate) {
        parmPayments = parmPayments.filter((payment) => {
          const paymentDate = new Date(payment.parmDate).getTime()
          return (
            (Number.isNaN(fromDate) || paymentDate >= fromDate) &&
            (Number.isNaN(toDate) || paymentDate <= toDate)
          )
        })
      }

      // set the business name field
      responseContents.parmSupplierInfo.parmSupplier =
        retrieveOrganisation(orgId).name

      // add the payments count and respond
      return h.response({
        ...responseContents,
        parmPayments,
        InfoMessages: [`No. of payments retrieved = ${parmPayments.length}`]
      })
    }
  }
]

export const router = {
  plugin: {
    name: 'hitachi-router',
    register: (server, _) => {
      server.route(payments)
    }
  }
}
