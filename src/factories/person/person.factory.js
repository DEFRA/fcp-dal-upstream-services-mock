import Boom from '@hapi/boom'
import { createLogger } from '../../common/helpers/logging/logger.js'
import { personUpdateSchema } from '../../common/update-schemas.js'
import {
  crnToPersonId,
  digitalContactPartyIdToPersonId,
  orgIdLookup,
  orgIdToPersonIds,
  orgIdToSbi,
  personIdToDigitalContactPartyId,
  personIdToOrgIds,
  staticPersonData
} from '../../factories/id-lookups.js'
import {
  applyUpdates,
  defaultObjectFromSchema
} from '../../utils/applyUpdates.js'
import {
  fakeAddress,
  fakeId,
  fakeIds,
  faker,
  generateId,
  normalisePostcode,
  safeSeed
} from '../common.js'
import { retrieveOrganisation } from '../organisation/organisation.factory.js'

const logger = createLogger('person.factory')

const people = {}
const startingPersonId = 11111111
const startingCrn = 9900000000

const generatePerson = (personId, crn, overrides = {}) => {
  personId = safeSeed(personId)
  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()
  const person = {
    id: personId,
    title: faker.person.prefix(),
    otherTitle: faker.person.suffix(),
    firstName,
    middleName: faker.person.firstName(),
    lastName: lastName,
    dateOfBirth: faker.date
      .birthdate({ min: 18, max: 90, mode: 'age' })
      .getTime(),
    landline: faker.phone.number(),
    mobile: faker.phone.number(),
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${faker.internet.domainName()}`,
    doNotContact: faker.datatype.boolean(),
    emailValidated: faker.datatype.boolean(),
    address: fakeAddress(),
    locked: faker.datatype.boolean(),
    confirmed: faker.datatype.boolean(),
    customerReferenceNumber: crn,
    personalIdentifiers: fakeIds(faker.number.int({ min: 0, max: 3 })).map(
      (id) => `${id}`
    ),
    deactivated: faker.datatype.boolean(),
    role: faker.helpers.arrayElement([
      'Owner or Sole Trader',
      'Key Contact',
      'Agent',
      'Director',
      'Trustee'
    ]),
    privileges: [
      'Full permission - business',
      'SUBMIT - CS APP - SA',
      'SUBMIT - CS AGREE - SA',
      'Amend - land',
      'Amend - entitlement',
      'Submit - bps',
      'SUBMIT - BPS - SA',
      'AMEND - ENTITLEMENT - SA',
      'AMEND - LAND - SA',
      'Submit - cs app',
      'Submit - cs agree',
      'ELM_APPLICATION_SUBMIT'
    ],
    lastUpdatedOn: faker.date.recent().getTime(),
    ...overrides
  }

  people[personId] = person

  return person
}

export const retrievePerson = (personId) => {
  const person = people[personId]
  if (person) {
    return person
  }

  const { crn, ...overrides } = staticPersonData[personId] ?? {}
  if (!crn) {
    logger.info(`Person with personId ${personId} not found`)
    throw Boom.notFound(`person with personId ${personId} not found`)
  }

  return generatePerson(personId, crn, overrides)
}

export const retrievePersonOrgs = (personId) => {
  const orgIds = personIdToOrgIds[personId] || []
  const orgs = orgIds.map((orgId) => {
    const org = retrieveOrganisation(orgId)
    return {
      id: orgId,
      sbi: orgIdToSbi[orgId],
      name: org.name,
      additionalSbiIds: org.additionalSbiIds,
      confirmed: org.confirmed,
      lastUpdatedOn: org.lastUpdatedOn,
      landConfirmed: org.landConfirmed,
      deactivated: org.deactivated,
      locked: org.locked
    }
  })
  return orgs
}

export const allPeople = () =>
  Object.keys(staticPersonData).map((personId) => retrievePerson(personId))

// find all the people belonging to orgs matching the search function
const peopleInOrgsWhere = (search) => {
  const orgIds = Object.keys(orgIdLookup).filter((orgId) =>
    search(retrieveOrganisation(orgId))
  )
  // only persons that exist
  const personIds = new Set(
    orgIds.flatMap((orgId) => orgIdToPersonIds[orgId] ?? [])
  )
  return [...personIds]
    .filter((personId) => personId in staticPersonData)
    .map((personId) => retrievePerson(personId))
}

const personMatchers = {
  CUSTOMER_REFERENCE: (crn) =>
    crnToPersonId[crn] ? [retrievePerson(crnToPersonId[crn])] : [],
  PERSONAL_IDENTIFIER: (identifier) =>
    allPeople()
      .filter((person) => person.personalIdentifiers?.includes(identifier))
      .slice(0, 1),
  // upstream only matches on surname, not firstname/full-name
  CUSTOMER_NAME: (name) =>
    allPeople().filter((person) =>
      person.lastName?.toLowerCase().includes(name.toLowerCase())
    ),
  CUSTOMER_POSTCODE: (postcode) =>
    allPeople().filter(
      (person) =>
        person.address?.postalCode &&
        normalisePostcode(person.address.postalCode) ===
          normalisePostcode(postcode)
    ),
  VENDOR_NUMBER: (phrase) =>
    peopleInOrgsWhere((org) => org.vendorNumber?.startsWith(phrase)),
  TRADER_NUMBER: (phrase) =>
    peopleInOrgsWhere((org) => org.traderNumber?.startsWith(phrase))
}

export const searchPeople = (searchFieldType, searchPhrase) =>
  personMatchers[searchFieldType](searchPhrase)

const normaliseName = (name) => `${name ?? ''}`.trim().toLowerCase()
const toDateOnly = (dateOrMillis) => {
  const date = new Date(dateOrMillis)
  return !['number', 'string'].includes(typeof dateOrMillis) ||
    Number.isNaN(date.getTime())
    ? null
    : date.toISOString().slice(0, 10)
}

/**
 * Find an existing person matching the supplied details, for POST /person/check/duplicates.
 * A match requires the same first name, last name (both case-insensitive), date of birth
 * (same calendar day), mobile and landline (both exact). A missing date of birth or phone number
 * only matches a person who has none. The person with the supplied id, if any, is never matched against itself,
 * and deactivated people are never matched.
 * @param {object} details
 * @param {number} [details.id] - id of the person being checked
 * @param {string} details.firstName
 * @param {string} details.lastName
 * @param {number|string} details.dateOfBirth - epoch millis or date-time string
 * @param {string} [details.mobile]
 * @param {string} [details.landline]
 * @returns the matching person, or undefined if there is no match
 */
export const findDuplicatePerson = ({
  id,
  firstName,
  lastName,
  dateOfBirth,
  mobile = null,
  landline = null
} = {}) => {
  const first = normaliseName(firstName)
  const last = normaliseName(lastName)
  const dob = toDateOnly(dateOfBirth)
  if (!first || !last || (dateOfBirth != null && !dob)) {
    return undefined
  }

  return allPeople().find(
    (person) =>
      `${person.id}` !== `${id}` &&
      !person.deactivated &&
      normaliseName(person.firstName) === first &&
      normaliseName(person.lastName) === last &&
      toDateOnly(person.dateOfBirth) === dob &&
      (person.mobile ?? null) === mobile &&
      (person.landline ?? null) === landline
  )
}

export const updatePerson = (personId, updatesToPerson) => {
  const person = retrievePerson(personId)
  const updatedPerson = applyUpdates(
    personUpdateSchema,
    person,
    updatesToPerson
  )

  // A changed email address invalidates the PartyDigitalContact record - it must be
  // re-verified via POST /external-auth/email-validation/validate-email before it is trusted again.
  // Matched case-insensitively, consistent with GET /person/{email}/validateEmail.
  if (updatedPerson.email?.toLowerCase() !== person.email?.toLowerCase()) {
    if (updatedPerson.email) ensureDigitalContactPartyId(personId)

    updatedPerson.emailValidated = false
  }

  people[personId] = updatedPerson
  return updatedPerson
}

export const markPersonEmailValidated = (crn, email) => {
  const personId = crnToPersonId[crn]
  if (!personId) {
    return
  }

  const person = retrievePerson(personId)
  // Validating an email address also makes it the person's email address
  if (email) {
    person.email = email
  }
  person.emailValidated = true
}

export const lockPerson = (personId, locked = true) => {
  const person = allPeople().find((person) => person.id === personId)
  if (!person) {
    throw Boom.notFound(`Person not found`)
  }
  person.locked = locked
}

export const unlockPerson = (personId) => lockPerson(personId, false)

export const deactivatePerson = (personId) => {
  const person = allPeople().find((person) => person.id === personId)
  if (!person) {
    throw Boom.notFound(`Person not found`)
  }
  person.deactivated = true
}

export const createPerson = (payload = {}) => {
  const usedPersonIds = [
    ...Object.keys(staticPersonData),
    ...Object.keys(people)
  ].map(Number)
  const usedCrns = [
    ...Object.values(staticPersonData).map(({ crn }) => Number(crn)),
    ...Object.values(people).map(({ customerReferenceNumber }) =>
      Number(customerReferenceNumber)
    )
  ]

  const generatedPersonId = generateId(startingPersonId, usedPersonIds)
  const generatedCrn = generateId(startingCrn, usedCrns)

  const schemaDefaults = defaultObjectFromSchema(personUpdateSchema)
  // addressTypeId isn't updatable so it's absent from the update schema, but every stored
  // address must carry it - seed it here so applyUpdates preserves it as null.
  const defaultPerson = {
    ...schemaDefaults,
    address: { ...schemaDefaults.address, addressTypeId: null }
  }

  // Coerced and filtered the same way as updatePerson, so only personUpdateSchema fields are
  // taken from the payload - id and customerReferenceNumber stay as allocated above.
  const person = {
    ...applyUpdates(personUpdateSchema, defaultPerson, payload),
    id: generatedPersonId,
    customerReferenceNumber: `${generatedCrn}`,
    emailValidated: false,
    locked: false,
    deactivated: false,
    confirmed: true,
    role: null,
    privileges: [],
    personalIdentifiers: [],
    lastUpdatedOn: Date.now()
  }
  const { id, customerReferenceNumber } = person

  people[id] = person
  crnToPersonId[customerReferenceNumber] = `${id}`
  personIdToOrgIds[id] = []
  staticPersonData[id] = { crn: customerReferenceNumber }

  if (person.email) {
    ensureDigitalContactPartyId(id)
  }

  return `${customerReferenceNumber}`
}

export const ensureDigitalContactPartyId = (personId) => {
  if (!personIdToDigitalContactPartyId[personId]) {
    safeSeed([personId, 'partyDigitalContactId'])
    const digitalContactPartyId = fakeId()
    personIdToDigitalContactPartyId[personId] = digitalContactPartyId
    digitalContactPartyIdToPersonId[digitalContactPartyId] = `${personId}`
  }
}
