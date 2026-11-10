import Boom from '@hapi/boom'
import { crnToPersonId } from '../../factories/id-lookups.js'
import { faker, nullOrFake, safeSeed } from '../common.js'

const authenticateData = {}

// upstream returns a 500 when a memorable answer exceeds this length
const MAX_ANSWER_LENGTH = 256

const createAuthenticateData = (crn) => {
  const data = nullOrFake(
    () => ({
      customerReference: crn,
      memorableDate: faker.date.past().toLocaleDateString(),
      memorableEvent: faker.lorem.word({ length: { min: 5, max: 10 } }),
      memorableLocation: faker.location.city(),
      lastUpdatedOn: faker.date.recent().toISOString()
    }),
    0.3
  ) ?? {
    customerReference: crn,
    memorableDate: null,
    memorableEvent: null,
    memorableLocation: null,
    lastUpdatedOn: null
  }
  authenticateData[crn] = data

  return data
}

export const retrieveAuthenticateData = (crn) => {
  if (authenticateData[crn]) {
    return authenticateData[crn]
  }

  const personId = crnToPersonId[crn]
  if (personId) {
    safeSeed(personId) // Ensure consistent data for the same person
    return nullOrFake(() => createAuthenticateData(crn))
  }

  throw Boom.notFound(`person with CRN ${crn} not found`)
}

export const saveAuthenticateData = (crn, { date, event, location } = {}) => {
  if (!authenticateData[crn] && !crnToPersonId[crn]) {
    throw Boom.notFound(`person with CRN ${crn} not found`)
  }

  const tooLong = Object.entries({ date, event, location }).filter(
    ([, answer]) => answer?.length > MAX_ANSWER_LENGTH
  )
  if (tooLong.length > 0) {
    throw Boom.internal(
      `security answers longer than ${MAX_ANSWER_LENGTH} characters for CRN ${crn}: ${tooLong.map(([field]) => field).join(', ')}`
    )
  }

  // NOTE: upstream also stores `email` (SECURITY_ANSWERS.email), but it is not returned by
  // GET /external-auth/security-answers/{crn}, so it is not kept here
  authenticateData[crn] = {
    customerReference: crn,
    memorableDate: date ?? null,
    memorableEvent: event ?? null,
    memorableLocation: location ?? null,
    lastUpdatedOn: new Date().toISOString()
  }

  return authenticateData[crn]
}
