import { fakeId, safeSeed } from '../../factories/common.js'
import { allPeople } from '../../factories/person/person.factory.js'
import { retrieveInternalAuthorisationByFunction } from '../../factories/siti-agri/permissions.factory.js'
import {
  errorEnvelope,
  parseRequestedFunctions,
  responseWrapper
} from './permissions.js'

export const matchingPersonIds = (people, email) => {
  const lowered = email.toLowerCase()
  // Only validated emails count, matching the observed upstream behavior of
  // /person/{email}/validateEmail (not directly probed for this endpoint).
  return people
    .filter(
      (person) =>
        person.email?.toLowerCase() === lowered && person.emailValidated
    )
    .map((person) => person.id)
}

export const internalUser = [
  {
    method: 'POST',
    path: '/authorisation/user',
    options: { payload: { parse: false } },
    handler: async (request, h) => {
      const email = request.payload?.toString() ?? ''
      if (email === '') {
        return h.response('0').type('text/plain')
      }

      const personIds = matchingPersonIds(allPeople(), email)
      if (personIds.length > 1) {
        return h
          .response({
            code: 422,
            message: 'There is more than one person with email.'
          })
          .code(422)
      }
      if (personIds.length === 1) {
        return h.response(`${personIds[0]}`).type('text/plain')
      }

      if (email.toLowerCase().endsWith('@defra.gov.uk')) {
        safeSeed(email.toLowerCase())
        return h.response(`${fakeId()}`).type('text/plain')
      }
      return h.response('0').type('text/plain')
    }
  },
  {
    method: 'GET',
    path: '/SitiAgriApi/authorisation/byFunction',
    handler: async (request, h) => {
      let { functions, module } = request.query
      if (functions === undefined || module === undefined) {
        return h.response(errorEnvelope).code(500)
      }
      if (Array.isArray(functions)) functions = functions.at(-1)
      if (Array.isArray(module)) module = module.at(-1)

      const requested = parseRequestedFunctions(functions)
      const email = request.headers.email ?? ''
      const data =
        module.toUpperCase() === 'CUST_SS_PORTAL'
          ? retrieveInternalAuthorisationByFunction(email, requested)
          : Object.fromEntries(
              requested.map((functionName) => [functionName, false])
            )

      return h.response({ ...responseWrapper, data })
    }
  }
]
