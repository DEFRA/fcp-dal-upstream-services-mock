import Boom from '@hapi/boom'
import { paginate } from '../../factories/common.js'
import {
  createAuthorisation,
  createOrganisation,
  deactivateOrganisation,
  deleteAuthorisation,
  lockOrganisation,
  reactivateOrganisation,
  retrieveOrganisation,
  retrieveOrganisationCustomers,
  searchOrganisations,
  unlockOrganisation,
  unrecognisedAuthorisationField,
  updateAdditionalOrganisationDetails,
  updateAuthorisation,
  updateOrganisation
} from '../../factories/organisation/organisation.factory.js'
import {
  checkId,
  checkOrgIdDigits,
  checkSearchPhrase,
  parsePersonId
} from '../../utils/shared-datatypes.js'
import { createPayloadValidator } from '../../utils/validatePayload.js'

// `primarySearchPhrase` constraints for each searchFieldType
const searchFieldTypes = {
  SBI: { minLength: 9, minNumber: 100000000 }, // sfd-id-check: allow - validation minimum
  BUSINESS_NAME: { minLength: 2, minNumber: 10 },
  BUSINESS_POSTCODE: { minLength: 5, minNumber: 10000 }
}

const mapOrgToSearchResult = ({
  id,
  name,
  sbi,
  additionalSbiIds,
  confirmed,
  lastUpdatedOn,
  landConfirmed,
  deactivated,
  locked,
  address,
  correspondenceAddress,
  isFinancialToBusinessAddr,
  isCorrespondenceAsBusinessAddr
}) => ({
  id,
  name,
  sbi,
  additionalSbiIds,
  confirmed,
  lastUpdatedOn,
  landConfirmed,
  deactivated,
  locked,
  address,
  correspondenceAddress,
  isFinancialToBusinessAddr,
  isCorrespondenceAsBusinessAddr
})

const validateLockOrganisationPayload = await createPayloadValidator(
  'routes/kits-v1/organisation-schema.oas.yml',
  (schema) =>
    schema.paths['/organisation/{organisationId}/lock'].post.requestBody
      .content['application/json'].schema
)

const validateUnlockOrganisationPayload = await createPayloadValidator(
  'routes/kits-v1/organisation-schema.oas.yml',
  (schema) =>
    schema.paths['/organisation/{organisationId}/unlock'].post.requestBody
      .content['application/json'].schema
)

// upstream returns Tomcat's HTML 404 page when a path segment fails to route; only the status and
// content type matter to callers, so this is a minimal placeholder for the body
const notFoundPage =
  '<html><body><h1>HTTP Status 404 – Not Found</h1></body></html>'

// Upstream reports an unknown org or person (including, on PUT, a body personId that differs from
// the path personId) as a 404 naming which, a repeated role as a 409, and every other problem as
// "An error has occurred." with a 400 or, for any error the factory doesn't classify, a 500
const authorisationErrorResponse = (h, e) => {
  const code =
    e.isBoom && [400, 404, 409].includes(e.output.statusCode)
      ? e.output.statusCode
      : 500
  const errorStrings = {
    404: e.data?.errorString,
    409: 'Relation already exists'
  }
  const errorString = errorStrings[code] ?? 'An error has occurred.'
  return h.response({ data: null, success: false, errorString }).code(code)
}

const validateDeactivateOrganisationPayload = await createPayloadValidator(
  'routes/kits-v1/organisation-schema.oas.yml',
  (schema) =>
    schema.paths['/organisation/{organisationId}/deactivate'].post.requestBody
      .content['application/json'].schema
)

const validateReactivateOrganisationPayload = await createPayloadValidator(
  'routes/kits-v1/organisation-schema.oas.yml',
  (schema) =>
    schema.paths['/organisation/{organisationId}/reactivate'].post.requestBody
      .content['application/json'].schema
)

export const organisation = [
  {
    method: 'GET',
    path: '/organisation/{organisationId}',
    handler: async (request, h) => {
      const organisationId = checkId(request, 'organisationId')

      // Special cases to return specific status codes
      if (organisationId == 3000000500) {
        throw Boom.error('Server error from this API.')
      } else if (organisationId == 3000000401) {
        throw Boom.unauthorized('Unauthorized access to this API.')
      } else if (organisationId == 3000000403) {
        throw Boom.forbidden('Forbidden access to this API.')
      } else if (organisationId == 3000000206) {
        return h.response('{}').code(206)
      } else {
        return h.response({ _data: retrieveOrganisation(organisationId) })
      }
    }
  },
  {
    method: 'POST',
    path: '/organisation/search',
    handler: async (request, h) => {
      const { searchFieldType, searchPhrase } = checkSearchPhrase(
        request,
        searchFieldTypes
      )
      const { offset, limit } = request.payload

      const matches = searchOrganisations(searchFieldType, searchPhrase)
      const { data, page } = paginate(matches, offset, limit)

      return h.response({
        _data: data.map(mapOrgToSearchResult),
        _page: page
      })
    }
  },
  {
    method: 'GET',
    path: '/authorisation/organisation/{organisationId}',
    handler: async (request, h) => {
      return h.response({
        _data: retrieveOrganisationCustomers(request.params.organisationId)
      })
    }
  },
  {
    method: 'PUT',
    path: '/organisation/{organisationId}/business-details',
    handler: async (request, h) => {
      return h.response({
        _data: updateOrganisation(
          request.params.organisationId,
          request.payload
        )
      })
    }
  },
  {
    method: 'PUT',
    path: '/organisation/{organisationId}/additional-business-details',
    handler: async (request, h) => {
      const organisationId = checkId(request, 'organisationId')
      const body = request.payload

      if (
        typeof body !== 'object' ||
        Array.isArray(body) ||
        body === null ||
        // required fields
        !body.businessType?.id ||
        !body.legalStatus?.id
      ) {
        throw Boom.badRequest(
          `bad payload: ${body}, expected an object`,
          request
        )
      }

      try {
        updateAdditionalOrganisationDetails(organisationId, body)
      } catch (e) {
        if (e.isBoom) {
          // 404 is a 500 upstream!!
          throw Boom.internal(
            `Organisation with ID: ${organisationId} not found`,
            request
          )
        }
        throw e
      }

      return h.response().code(204)
    }
  },
  {
    method: 'POST',
    path: '/organisation/create/{personId}',
    handler: async (request, h) => {
      return h.response({
        _data: createOrganisation(request.params.personId, request.payload)
      })
    }
  },
  {
    method: 'POST',
    path: '/organisation/{organisationId}/lock',
    handler: async (request, h) => {
      const organisationId = checkId(request, 'organisationId')

      if (!validateLockOrganisationPayload(request.payload)) {
        throw Boom.badRequest(
          'validation error while processing input',
          request
        )
      }

      lockOrganisation(organisationId)

      return h.response().code(204)
    }
  },
  {
    method: 'POST',
    path: '/organisation/{organisationId}/unlock',
    handler: async (request, h) => {
      const organisationId = checkId(request, 'organisationId')

      if (!validateUnlockOrganisationPayload(request.payload)) {
        throw Boom.badRequest(
          'validation error while processing input',
          request
        )
      }

      unlockOrganisation(organisationId)

      return h.response().code(204)
    }
  },
  {
    method: 'POST',
    path: '/organisation/{organisationId}/deactivate',
    handler: async (request, h) => {
      const organisationId = checkId(request, 'organisationId')

      if (!validateDeactivateOrganisationPayload(request.payload)) {
        throw Boom.badRequest(
          'validation error while processing input',
          request
        )
      }

      deactivateOrganisation(organisationId)

      return h.response().code(204)
    }
  },
  {
    method: 'POST',
    path: '/organisation/{organisationId}/reactivate',
    handler: async (request, h) => {
      const organisationId = checkId(request, 'organisationId')

      if (!validateReactivateOrganisationPayload(request.payload)) {
        throw Boom.badRequest(
          'validation error while processing input',
          request
        )
      }

      reactivateOrganisation(organisationId)

      return h.response().code(204)
    }
  },
  {
    method: 'POST',
    path: '/SitiAgriApi/authorisation/organisation/{orgId}/authorisation',
    handler: async (request, h) => {
      const orgId = checkOrgIdDigits(request)
      const unrecognised = unrecognisedAuthorisationField(request.payload)
      if (unrecognised) {
        return h.response(unrecognised).type('text/plain').code(400)
      }
      try {
        createAuthorisation(orgId, request.payload)
        return h
          .response({ data: null, success: true, errorString: null })
          .code(200)
      } catch (e) {
        return authorisationErrorResponse(h, e)
      }
    }
  },
  {
    method: 'PUT',
    path: '/SitiAgriApi/authorisation/organisation/{orgId}/authorisation/person/{personId}',
    handler: async (request, h) => {
      const orgId = checkOrgIdDigits(request)
      const personId = parsePersonId(request)
      if (personId === null) {
        return h.response(notFoundPage).type('text/html').code(404)
      }
      const unrecognised = unrecognisedAuthorisationField(request.payload)
      if (unrecognised) {
        return h.response(unrecognised).type('text/plain').code(400)
      }

      try {
        updateAuthorisation(orgId, personId, request.payload)
        return h
          .response({ data: null, success: true, errorString: null })
          .code(200)
      } catch (e) {
        return authorisationErrorResponse(h, e)
      }
    }
  },
  {
    method: 'DELETE',
    path: '/SitiAgriApi/authorisation/organisation/{orgId}/authorisation',
    handler: async (request, h) => {
      const orgId = checkOrgIdDigits(request)
      const unrecognised = unrecognisedAuthorisationField(request.payload)
      if (unrecognised) {
        return h.response(unrecognised).type('text/plain').code(400)
      }

      try {
        deleteAuthorisation(orgId, request.payload)
        return h
          .response({ data: null, success: true, errorString: null })
          .code(200)
      } catch (e) {
        return authorisationErrorResponse(h, e)
      }
    }
  }
]
