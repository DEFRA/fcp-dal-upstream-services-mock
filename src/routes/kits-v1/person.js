import Boom from '@hapi/boom'
import { createLogger } from '../../common/helpers/logging/logger.js'
import { config } from '../../config.js'
import { paginate } from '../../factories/common.js'
import {
  crnToPersonId,
  personIdToDigitalContactPartyId
} from '../../factories/id-lookups.js'
import {
  allPeople,
  createPerson,
  deactivatePerson,
  findDuplicatePerson,
  lockPerson,
  retrievePerson,
  retrievePersonOrgs,
  searchPeople,
  unlockPerson,
  updatePerson
} from '../../factories/person/person.factory.js'
import { checkSearchPhrase } from '../../utils/shared-datatypes.js'
import { createPayloadValidator } from '../../utils/validatePayload.js'

const logger = createLogger('person.route')

// `primarySearchPhrase` constraints for each searchFieldType
const searchFieldTypes = {
  CUSTOMER_REFERENCE: { minLength: 10, minNumber: 1000000000 }, // sfd-id-check: allow - validation minimum
  PERSONAL_IDENTIFIER: { minLength: 9, minNumber: 100000000 }, // sfd-id-check: allow - validation minimum
  CUSTOMER_NAME: { minLength: 1, allowBoolean: true },
  CUSTOMER_POSTCODE: { minLength: 5, minNumber: 10000 },
  VENDOR_NUMBER: { minLength: 6, minNumber: 100000 },
  TRADER_NUMBER: { minLength: 6, minNumber: 100000 }
}

const mapPersonToSearchResult = ({
  id,
  firstName,
  lastName,
  address,
  personalIdentifiers,
  nationalInsuranceNumber,
  customerReferenceNumber,
  email,
  locked,
  deactivated
}) => ({
  id,
  fullName: [firstName, lastName].filter(Boolean).join(' '),
  primaryAddress: address,
  personalIdentifiers,
  nationalInsuranceNumber: nationalInsuranceNumber || null,
  customerReference: customerReferenceNumber,
  email,
  locked,
  deactivated
})

const mapPersonToPartyDigitalContact = (
  { id, emailValidated },
  requestEmail
) => ({
  id: personIdToDigitalContactPartyId[id],
  partyId: id, // partyId is the personId here (a party can also be an organisation elsewhere)
  mdmPartyContactId: null,
  digitalContactType: { id: 100301, type: 'Email Address' }, // 100301 = EMAIL_ADDRESS (not 100306 CORRESPONDENCE_EMAIL)
  digitalAddress: requestEmail, // Bit unusual, but the API echos back the same email address passed in the url params
  validated: emailValidated // Returns whether the persons existing email is validated, not the one in the request!
})

const mapPersonToDuplicate = ({
  customerReferenceNumber,
  firstName,
  lastName,
  landline,
  mobile,
  dateOfBirth,
  id
}) => ({
  customerReferenceNumber,
  firstName,
  lastName,
  landline,
  mobile,
  dateOfBirth,
  id
})

const validateUpdatePersonPayload = await createPayloadValidator(
  'routes/kits-v1/person-schema.oas.yml',
  (schema) =>
    schema.paths['/person/{personId}'].put.requestBody.content[
      'application/json'
    ].schema
)

const validateLockPersonPayload = await createPayloadValidator(
  'routes/kits-v1/person-schema.oas.yml',
  (schema) =>
    schema.paths['/person/{personId}/lock'].post.requestBody.content[
      'application/json'
    ].schema
)

const validateUnlockPersonPayload = await createPayloadValidator(
  'routes/kits-v1/person-schema.oas.yml',
  (schema) =>
    schema.paths['/person/{personId}/unlock'].post.requestBody.content[
      'application/json'
    ].schema
)

const validateDeactivatePersonPayload = await createPayloadValidator(
  'routes/kits-v1/person-schema.oas.yml',
  (schema) =>
    schema.paths['/person/{personId}/deactivate'].post.requestBody.content[
      'application/json'
    ].schema
)

const validateCreatePersonPayload = await createPayloadValidator(
  'routes/kits-v1/person-schema.oas.yml',
  (schema) =>
    schema.paths['/person/create'].post.requestBody.content['application/json']
      .schema
)

/**
 * Get an integer path param from the request, in the range accepted by upstream
 * @param {*} request
 * @param {string} paramName
 * @returns the parsed id
 * @throws {Boom.Boom} 403 if the param is not an integer in the acceptable range
 */
const checkPathId = (request, paramName) => {
  const id = Number.parseInt(request.params[paramName], 10)

  if (Number.isNaN(id) || id < 0 || `${id}`.length > 20) {
    throw Boom.forbidden(
      `bad ${paramName}: ${id}, is not an integer in the acceptable range`,
      request
    )
  }

  return id
}

// Not thrown as a Boom error, as emulateUpstreamErrors would replace this body
const unableToProcessJson = (h) =>
  h.response({ code: 400, message: 'Unable to process JSON' }).code(400)

const checkPersonId = (request) => checkPathId(request, 'personId')
const checkDigitalContactPartyId = (request) =>
  checkPathId(request, 'digitalContactPartyId')

export const person = [
  {
    method: 'GET',
    path: '/person/{email}/validateEmail',
    handler: async (request, h) => {
      const email = request.params.email.toLowerCase()
      const emailDuplicated = allPeople().some(
        (person) =>
          person.email?.toLowerCase() === email && person.emailValidated
      )
      return h.response({ _data: { emailDuplicated } })
    }
  },
  {
    method: 'GET',
    path: '/person/{personId}/{email}/confirm',
    handler: async (request, h) => {
      const personId = checkPersonId(request)
      const person = retrievePerson(personId)

      if (!person.email) {
        logger.info(
          `confirm email: person with personId ${personId} has no email address`
        )
        throw Boom.notFound()
      }

      if (
        person.email.toLowerCase() === request.params.email.toLowerCase() &&
        person.emailValidated
      ) {
        logger.info(
          `Email for person with personId ${personId} is already validated`
        )
        throw Boom.conflict('HTTP 409 Conflict', request)
      }

      const email = request.params.email.toLowerCase()
      if (
        allPeople().some(
          (other) =>
            other.id !== personId &&
            other.email?.toLowerCase() === email &&
            other.emailValidated
        )
      ) {
        logger.info(
          `confirm email: email is already verified by another person`
        )
        throw Boom.conflict('HTTP 409 Conflict', request)
      }

      return h.response({
        _data: mapPersonToPartyDigitalContact(person, request.params.email)
      })
    }
  },
  {
    method: 'POST',
    path: '/verify-email/{digitalContactPartyId}',
    handler: async (request, h) => {
      const digitalContactPartyId = checkDigitalContactPartyId(request)

      // The body is the email address as plain text. Not thrown as a Boom error, as
      // emulateUpstreamErrors would replace this body
      const email = request.payload
      if (typeof email !== 'string' || email.trim() === '') {
        logger.info(
          `No email provided for digitalContactPartyId ${digitalContactPartyId}`
        )
        return h
          .response({ code: 500, message: 'HTTP 500 Internal Server Error' })
          .code(500)
      }

      // Upstream does not check the digital contact exists - an unknown id still succeeds
      return h.response({ _data: 'Success' })
    }
  },
  {
    method: 'POST',
    path: '/person/check/duplicates',
    options: {
      payload: {
        failAction: (_request, h) => unableToProcessJson(h).takeover()
      }
    },
    handler: async (request, h) => {
      const { payload } = request
      if (
        payload == null ||
        payload === '' ||
        (Buffer.isBuffer(payload) && !payload.length)
      ) {
        throw Boom.internal('missing request body', request)
      }

      // Upstream returns this for any body it can't read as an object, including `[]`
      if (
        typeof payload !== 'object' ||
        Array.isArray(payload) ||
        Buffer.isBuffer(payload)
      ) {
        logger.info('check duplicates: payload is not a JSON object')
        return unableToProcessJson(h)
      }

      const duplicate = findDuplicatePerson(payload)
      return h.response({
        _data: duplicate ? mapPersonToDuplicate(duplicate) : null
      })
    }
  },
  {
    method: 'GET',
    path: '/person/{personId}/summary',
    handler: async (request, h) => {
      let personId = checkPersonId(request)

      if (personId === config.get('personIdOverride')) {
        const crn = request?.headers?.crn
        personId = crnToPersonId[crn]
      }

      const { role, privileges, lastUpdatedOn, ...personData } =
        retrievePerson(personId)

      return h.response({ _data: personData })
    }
  },
  {
    method: 'POST',
    path: '/person/search',
    handler: async (request, h) => {
      const { searchFieldType, searchPhrase } = checkSearchPhrase(
        request,
        searchFieldTypes
      )
      const { offset, limit } = request.payload

      const matches = searchPeople(searchFieldType, searchPhrase)
      const { data, page } = paginate(matches, offset, limit)

      return h.response({
        _data: data.map(mapPersonToSearchResult),
        _page: page
      })
    }
  },
  {
    method: 'GET',
    path: '/organisation/person/{personId}/summary',
    handler: async (request, h) => {
      const personId = checkPersonId(request)

      const orgs = retrievePersonOrgs(personId)

      return h.response({
        _data: orgs,
        _page: {
          number: 1,
          size: 500,
          totalPages: 1,
          numberOfElements: orgs.length,
          totalElements: orgs.length
        }
      })
    }
  },
  {
    method: 'PUT',
    path: '/person/{personId}',
    handler: async (request, h) => {
      const personId = checkPersonId(request)
      const body = request.payload

      if (body === '' || body === null) {
        throw Boom.badRequest('empty request body not allowed', request)
      }

      if (typeof body !== 'object' || Array.isArray(body)) {
        throw Boom.badRequest('missing or invalid request body', request)
      }

      if (!validateUpdatePersonPayload(request.payload)) {
        logger.info(
          `validateUpdatePersonPayload failed: ${JSON.stringify(validateUpdatePersonPayload.errors)}`
        )
        throw Boom.badData('validation error while processing input', request)
      }

      if (body.dateOfBirth != null && body.dateOfBirth > Date.now()) {
        logger.info(`dateOfBirth is in the future: ${body.dateOfBirth}`)
        throw Boom.badData('validation error while processing input', request)
      }

      updatePerson(personId, body)
      return h.response().code(204)
    }
  },
  {
    method: 'POST',
    path: '/person/{personId}/lock',
    handler: async (request, h) => {
      const personId = checkPersonId(request)

      if (!validateLockPersonPayload(request.payload)) {
        throw Boom.badRequest(
          'validation error while processing input',
          request
        )
      }

      lockPerson(personId)
      return h.response().code(204)
    }
  },
  {
    method: 'POST',
    path: '/person/{personId}/unlock',
    handler: async (request, h) => {
      const personId = checkPersonId(request)

      if (!validateUnlockPersonPayload(request.payload)) {
        throw Boom.badRequest(
          'validation error while processing input',
          request
        )
      }

      unlockPerson(personId)
      return h.response().code(204)
    }
  },
  {
    method: 'POST',
    path: '/person/{personId}/deactivate',
    handler: async (request, h) => {
      const personId = checkPersonId(request)

      if (!validateDeactivatePersonPayload(request.payload)) {
        throw Boom.badRequest(
          'validation error while processing input',
          request
        )
      }

      // kits upgrade fails with a 500 (not a 400) above these lengths
      const { reason, note } = request.payload
      if (`${reason ?? ''}`.length > 100 || `${note ?? ''}`.length > 4000) {
        throw Boom.internal(
          'reason or note exceeds the maximum length',
          request
        )
      }

      deactivatePerson(personId)
      return h.response().code(204)
    }
  },
  {
    method: 'POST',
    path: '/person/create',
    handler: async (request, h) => {
      if (request.payload === '' || request.payload === null) {
        throw Boom.badRequest('source cannot be null', request)
      }
      if (
        typeof request.payload !== 'object' ||
        Array.isArray(request.payload)
      ) {
        throw Boom.badRequest('missing or invalid request body', request)
      }
      if (!validateCreatePersonPayload(request.payload)) {
        throw Boom.badData('validation error while processing input', request)
      }
      return h.response({
        _data: createPerson(request.payload)
      })
    }
  }
]
