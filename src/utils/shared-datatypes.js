import Boom from '@hapi/boom'

export const checkId = (request, idName) => {
  const _id = { ...request?.params }[idName]
  const id = Number.parseInt(_id, 10)

  // When parsing numbers such as 9.517736547475587e-91 will return 9,
  // `${id}` !== `${_id}` will verify the original value passes the validation
  if (
    Number.isNaN(id) ||
    id < 1 ||
    `${id}`.length > 20 ||
    `${id}` !== `${_id}`
  ) {
    throw Boom.forbidden(
      `bad ${idName}: ${id}, is not an integer in the acceptable range`,
      request
    )
  }

  return `${id}`
}

// Upstream SitiAgri authorisation endpoints reject an `orgId` that is not 1-20 digits with a 403
// before the payload is read; returns it normalised, as upstream treats `0012` as org 12
export const checkOrgIdDigits = (request) => {
  const orgId = `${request?.params?.orgId}`

  if (!/^[0-9]{1,20}$/.test(orgId)) {
    throw Boom.forbidden(`bad orgId: ${orgId}, must be 1-20 digits`, request)
  }

  return BigInt(orgId).toString()
}

// Upstream SitiAgri authorisation endpoints only route an integer `personId` (signs and leading
// zeros included, so `+12` and `0012` are person 12); returns it normalised, or null otherwise
export const parsePersonId = (request) => {
  const personId = `${request?.params?.personId}`

  return /^[+-]?[0-9]+$/.test(personId) ? BigInt(personId).toString() : null
}

export const checkSearchPhrase = (request, searchFieldTypes) => {
  const { searchFieldType, primarySearchPhrase } = request.payload ?? {}

  const constraints = searchFieldTypes[searchFieldType]
  if (!constraints) {
    throw Boom.badRequest(
      `unrecognised searchFieldType: '${searchFieldType}'`,
      request
    )
  }

  const phraseType = typeof primarySearchPhrase
  if (
    primarySearchPhrase == null ||
    !(
      phraseType === 'string' ||
      phraseType === 'number' ||
      (constraints.allowBoolean && phraseType === 'boolean')
    )
  ) {
    throw Boom.internal(
      'missing or invalid primarySearchPhrase\n' +
        `searchFieldType: '${searchFieldType}', primarySearchPhrase: '${primarySearchPhrase}'`,
      request
    )
  }

  if (
    `${primarySearchPhrase}`.length < constraints.minLength ||
    (phraseType === 'number' &&
      constraints.minNumber !== undefined &&
      primarySearchPhrase < constraints.minNumber)
  ) {
    throw Boom.badRequest(
      `bad primarySearchPhrase: ${primarySearchPhrase}, ` +
        `it must comprise ${constraints.minLength} or more characters`,
      request
    )
  }

  return { searchFieldType, searchPhrase: `${primarySearchPhrase}` }
}
