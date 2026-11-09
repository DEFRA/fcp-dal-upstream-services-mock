import Boom from '@hapi/boom'
import {
  fakeAddress,
  fakeIds,
  faker,
  generateId,
  nft,
  normalisePostcode,
  nullOrFake,
  safeSeed
} from '../common.js'
import {
  frnToOrgId,
  frnToPaymentOverrides,
  orgIdLookup,
  orgIdToPersonIds,
  orgIdToSbi,
  personIdToOrgIds,
  sbiToOrgId
} from '../id-lookups.js'
import { retrievePerson } from '../person/person.factory.js'

// All valid privilege names that can be assigned via create/update authorisation.
// Generated from the permissions matrix.
const PRIVILEGE_NAMES = [
  // Basic Payment Scheme (BPS)
  'NO ACCESS - BPS',
  'View - bps',
  'Amend - bps',
  'Submit - bps',

  // Business Details
  'View - business',
  'Amend - business',
  'Make legal changes - business',
  'Full permission - business',

  // Countryside Stewardship (Agreements)
  'NO ACCESS - CS AGREE',
  'View - cs agree',
  'Amend - cs agree',
  'Submit - cs agree',

  // Countryside Stewardship (Applications)
  'NO ACCESS - CS APP',
  'View - cs app',
  'Amend - cs app',
  'Submit - cs app',

  // Entitlements
  'NO ACCESS - ENTITLEMENT',
  'View - entitlement',
  'Amend - entitlement',

  // Environmental Land Management (Applications)
  'ELM_APPLICATION_NO_ACCESS',
  'ELM_APPLICATION_VIEW',
  'ELM_APPLICATION_AMEND',
  'ELM_APPLICATION_SUBMIT',

  // Land Details
  'NO ACCESS - LAND',
  'View - land',
  'Amend - land'
]

// Upstream grants each scheme privilege (land, BPS, entitlement and CS) together with an
// upper-case "- SA" counterpart, which can also be assigned on its own
const SCHEME_PRIVILEGE = / - (land|bps|entitlement|cs app|cs agree)$/i
const schemeCounterpart = (name) =>
  SCHEME_PRIVILEGE.test(name) ? `${name.toUpperCase()} - SA` : null

// Upstream matches privilege names case-insensitively, storing its own spelling
const CANONICAL_PRIVILEGE_NAMES = new Map(
  PRIVILEGE_NAMES.flatMap((name) => [name, schemeCounterpart(name)])
    .filter(Boolean)
    .map((name) => [name.toLowerCase(), name])
)

const organisations = {}
let startingOrgId = 1000000
let startingSbi = 880000000

export const createOrganisation = (personId, payload) => {
  retrievePerson(personId)
  startingOrgId = generateId(startingOrgId, Object.keys(orgIdToSbi).map(Number))
  startingSbi = generateId(startingSbi, Object.keys(sbiToOrgId).map(Number))
  const id = startingOrgId
  const sbi = startingSbi
  const name = payload.name
  const org = {
    id,
    name,
    sbi,
    additionalSbiIds: [],
    confirmed: true,
    lastUpdatedOn: null,
    landConfirmed: null,
    deactivated: false,
    locked: false,
    address: {
      address1: payload.address?.address1 ?? null,
      address2: payload.address?.address2 ?? null,
      address3: payload.address?.address3 ?? null,
      address4: payload.address?.address4 ?? null,
      address5: payload.address?.address5 ?? null,
      pafOrganisationName: payload.address?.pafOrganisationName ?? null,
      flatName: payload.address?.flatName ?? null,
      buildingNumberRange: payload.address?.buildingNumberRange ?? null,
      buildingName: payload.address?.buildingName ?? null,
      street: payload.address?.street ?? null,
      city: payload.address?.city ?? null,
      county: payload.address?.county ?? null,
      postalCode: payload.address?.postalCode ?? null,
      country: payload.address?.country ?? null,
      uprn: payload.address?.uprn ?? null,
      dependentLocality: payload.address?.dependentLocality ?? null,
      doubleDependentLocality: payload.address?.doubleDependentLocality ?? null,
      addressTypeId: payload.address?.addressTypeId ?? null
    },
    correspondenceAddress: payload.correspondenceAddress
      ? {
          address1: payload.correspondenceAddress?.address1 ?? null,
          address2: payload.correspondenceAddress?.address2 ?? null,
          address3: payload.correspondenceAddress?.address3 ?? null,
          address4: payload.correspondenceAddress?.address4 ?? null,
          address5: payload.correspondenceAddress?.address5 ?? null,
          pafOrganisationName:
            payload.correspondenceAddress?.pafOrganisationName ?? null,
          flatName: payload.correspondenceAddress?.flatName ?? null,
          buildingNumberRange:
            payload.correspondenceAddress?.buildingNumberRange ?? null,
          buildingName: payload.correspondenceAddress?.buildingName ?? null,
          street: payload.correspondenceAddress?.street ?? null,
          city: payload.correspondenceAddress?.city ?? null,
          county: payload.correspondenceAddress?.county ?? null,
          postalCode: payload.correspondenceAddress?.postalCode ?? null,
          country: payload.correspondenceAddress?.country ?? null,
          uprn: payload.correspondenceAddress?.uprn ?? null,
          dependentLocality:
            payload.correspondenceAddress?.dependentLocality ?? null,
          doubleDependentLocality:
            payload.correspondenceAddress?.doubleDependentLocality ?? null,
          addressTypeId: payload.correspondenceAddress?.addressTypeId ?? null
        }
      : null,
    isFinancialToBusinessAddr: payload.isFinancialToBusinessAddr,
    isCorrespondenceAsBusinessAddr: payload.isCorrespondenceAsBusinessAddr,
    email: payload.email,
    emailValidated: payload.emailValidated,
    landline: payload.landline,
    mobile: payload.mobile,
    fax: null,
    correspondenceEmail: payload.correspondenceEmail,
    correspondenceEmailValidated: payload.correspondenceEmailValidated,
    correspondenceLandline: payload.correspondenceLandline,
    correspondenceMobile: payload.correspondenceMobile,
    correspondenceFax: null,
    taxRegistrationNumber: payload.taxRegistrationNumber,
    businessType: {
      id: payload.businessType.id,
      type: 'Not set'
    },
    businessReference: payload.businessReference,
    legalStatus: {
      id: payload.legalStatus.id,
      type: 'Not set'
    },
    dateStartedFarming: payload.dateStartedFarming,
    companiesHouseRegistrationNumber: payload.companiesHouseRegistrationNumber,
    charityCommissionRegistrationNumber:
      payload.charityCommissionRegistrationNumber,
    persons: [],
    hasLandInNorthernIreland: payload.hasLandInNorthernIreland,
    hasLandInScotland: payload.hasLandInScotland,
    hasLandInWales: payload.hasLandInWales,
    hasAdditionalBusinessActivities: payload.hasAdditionalBusinessActivities,
    vendorNumber: payload.vendorNumber,
    traderNumber: payload.traderNumber,
    isAccountablePeopleDeclarationCompleted:
      payload.isAccountablePeopleDeclarationCompleted,
    additionalBusinessActivities: null
  }

  // ensure all the entity relationships are also created
  organisations[id] = org
  orgIdToSbi[id] = sbi
  sbiToOrgId[sbi] = id
  orgIdLookup[id] = { sbi }
  frnToOrgId[payload.businessReference] = id
  frnToPaymentOverrides[payload.businessReference] = {}
  // the person may not be in any org yet
  personIdToOrgIds[personId] ??= []
  personIdToOrgIds[personId].push(id)
  orgIdToPersonIds[id] = [personId]

  return org
}

const generateOrganisation = (orgId, sbi, overrides = {}) => {
  orgId = safeSeed(orgId)
  const name = faker.company.name()
  const hasAdditionalBusinessActivities = nft(4, 2, 3)
  const org = {
    id: orgId,
    name,
    sbi,
    additionalSbiIds: [],
    confirmed: faker.datatype.boolean(0.9),
    lastUpdatedOn: faker.date.recent().getTime(),
    landConfirmed: faker.datatype.boolean(0.7),
    deactivated: faker.datatype.boolean(0.2),
    locked: faker.datatype.boolean(0.1),
    address: fakeAddress({ pafOrganisationName: name }),
    correspondenceAddress: nullOrFake(
      () => fakeAddress({ pafOrganisationName: name }),
      0.7
    ),
    isFinancialToBusinessAddr: nft(),
    isCorrespondenceAsBusinessAddr: nft(7, 2, 1),
    email: faker.internet.email(),
    emailValidated: faker.datatype.boolean(0.8),
    landline: faker.phone.number(),
    mobile: faker.phone.number(),
    fax: null,
    correspondenceEmail: faker.internet.email(),
    correspondenceEmailValidated: faker.datatype.boolean(0.8),
    correspondenceLandline: faker.phone.number(),
    correspondenceMobile: faker.phone.number(),
    correspondenceFax: null,
    taxRegistrationNumber: nullOrFake(() => faker.string.numeric(9)),
    businessType: {
      id: faker.number.int({ min: 164946, max: 964946 }),
      type: 'Not Specified'
    },
    // businessReference is actually FRN! and will always be overridden!
    // but keeping this step to ensure the rest of the data remains consistent
    businessReference: faker.string.numeric(10),
    legalStatus: {
      id: faker.number.int({ min: 164946, max: 964946 }),
      type: 'Sole Proprietorship'
    },
    dateStartedFarming: faker.date.past().toISOString(),
    companiesHouseRegistrationNumber: nullOrFake(() =>
      faker.string.alphanumeric(8)
    ),
    charityCommissionRegistrationNumber: nullOrFake(() =>
      faker.string.alphanumeric(8)
    ),
    persons: [],
    hasLandInNorthernIreland: nft(4, 2, 1),
    hasLandInScotland: nft(4, 2, 3),
    hasLandInWales: nft(4, 2, 3),
    hasAdditionalBusinessActivities,
    vendorNumber: nullOrFake(() => faker.string.numeric(6)),
    traderNumber: nullOrFake(() => faker.string.numeric(6)),
    isAccountablePeopleDeclarationCompleted: nft(7, 1, 2),
    additionalBusinessActivities: hasAdditionalBusinessActivities
      ? fakeIds(faker.number.int({ min: 1, max: 3 }), 164946, 964946).map(
          (id, i) => ({
            id: Number.parseInt(id, 10),
            type: `Additional Business Activity ${i}`
          })
        )
      : null,
    ...overrides
  }

  organisations[orgId] = org

  return org
}

export const updateOrganisation = (orgId, updatesToOrg) => {
  const org = retrieveOrganisation(orgId)
  return Object.assign(org, updatesToOrg)
}
export const updateAdditionalOrganisationDetails = (
  orgId,
  {
    legalStatus,
    businessType,
    companiesHouseRegistrationNumber,
    charityCommissionRegistrationNumber,
    dateStartedFarming
  }
) => {
  const org = retrieveOrganisation(orgId)
  const newLegalStatus = {
    id: legalStatus.id,
    type: legalStatus.type ?? 'Set from reference data'
  }
  const newBusinessType = {
    id: businessType.id,
    type: businessType.type ?? 'Set from reference data'
  }
  Object.assign(org, {
    legalStatus: newLegalStatus,
    businessType: newBusinessType,
    companiesHouseRegistrationNumber: companiesHouseRegistrationNumber ?? null,
    charityCommissionRegistrationNumber:
      charityCommissionRegistrationNumber ?? null,
    dateStartedFarming: new Date(dateStartedFarming).getTime() || null
  })
}

export const retrieveOrganisation = (orgId) => {
  const { sbi, overrides } = orgIdLookup[orgId] ?? {}

  if (!sbi) {
    throw Boom.notFound(`organisation with orgId ${orgId} not found`)
  }

  return organisations[orgId] ?? generateOrganisation(orgId, sbi, overrides)
}

const allOrganisations = () =>
  Object.keys(orgIdLookup).map((orgId) => retrieveOrganisation(orgId))

const organisationMatchers = {
  SBI: (sbi) =>
    sbiToOrgId[sbi] ? [retrieveOrganisation(sbiToOrgId[sbi])] : [],
  BUSINESS_NAME: (name) =>
    allOrganisations().filter((org) =>
      org.name?.toLowerCase().includes(name.toLowerCase())
    ),
  BUSINESS_POSTCODE: (postcode) =>
    allOrganisations().filter(
      (org) =>
        org.address?.postalCode &&
        normalisePostcode(org.address.postalCode) ===
          normalisePostcode(postcode)
    )
}

export const searchOrganisations = (searchFieldType, searchPhrase) =>
  organisationMatchers[searchFieldType](searchPhrase)

// Roles and privileges set through the authorisation endpoints, by organisation and person.
// Upstream links a person once per role, each link with the same privileges; a link without an
// entry here shows the person's own role and privileges.
const authorisations = {}
const authorisationKey = (orgId, personId) => `${orgId}:${personId}`

const authorisationFor = (orgId, personId, person) =>
  authorisations[authorisationKey(orgId, personId)] ?? {
    roles: [person.role],
    privileges: person.privileges
  }

export const retrieveOrganisationCustomers = (orgId) => {
  const personIds = orgIdToPersonIds[orgId] || []
  // upstream lists a person once per role, each row repeating the privileges once per role
  const orgPeople = personIds.flatMap((personId) => {
    const person = retrievePerson(personId)
    const { roles, privileges } = authorisationFor(orgId, personId, person)
    return roles.map((role) => ({
      id: personId,
      firstName: person.firstName,
      lastName: person.lastName,
      customerReference: person.customerReferenceNumber,
      confirmed: person.confirmed,
      lastUpdatedOn: person.lastUpdatedOn,
      role,
      privileges: roles.flatMap(() => privileges)
    }))
  })
  return orgPeople
}

export const lockOrganisation = (orgId) => {
  try {
    const org = retrieveOrganisation(orgId)

    // TODO: Uncomment this when we have a way to run prime contract tests in correct state
    // if (org.locked) {
    //   throw new Error(`organisation with orgId ${orgId} is already locked`)
    // }

    org.locked = true
  } catch (e) {
    // If not found or already locked, throw internal error to match upstream
    throw Boom.internal(e.message)
  }
}

export const unlockOrganisation = (orgId) => {
  try {
    const org = retrieveOrganisation(orgId)

    // TODO: Uncomment this when we have a way to run prime contract tests in correct state
    // if (!org.locked) {
    //   throw new Error(`organisation with orgId ${orgId} is already unlocked`)
    // }

    org.locked = false
  } catch (e) {
    // If not found or already unlocked, throw internal error to match upstream
    throw Boom.internal(e.message)
  }
}

const sameId = (a, b) => String(a) === String(b)

const personIdsForOrg = (orgId) => orgIdToPersonIds[orgId] || []

const hasAuthorisation = (orgId, personId) =>
  personIdsForOrg(orgId).some((id) => sameId(id, personId))

// The authorisation endpoints' 404s carry the `errorString` upstream reports for them
const retrieveExistingPerson = (personId) => {
  try {
    return retrievePerson(personId)
  } catch {
    throw Boom.notFound(`person with personId ${personId} not found`, {
      errorString: 'Person not found.'
    })
  }
}

const retrieveExistingOrganisation = (orgId) => {
  try {
    return retrieveOrganisation(orgId)
  } catch (e) {
    throw Boom.notFound(e.message, { errorString: 'Organisation not found.' })
  }
}

// the field in `entry` that isn't one of `knownFields`, if any
const unknownField = (entry, knownFields) =>
  entry && typeof entry === 'object'
    ? Object.keys(entry).find((name) => !knownFields.includes(name))
    : undefined

// the first unknown field across an array of entries, if any
const unknownEntryField = (entries, knownFields) =>
  (Array.isArray(entries) ? entries : [])
    .map((entry) => unknownField(entry, knownFields))
    .find((field) => field !== undefined)

/**
 * Upstream's JSON deserialiser rejects a field its models don't declare, before anything else is
 * checked, with a plain-text 400; returns a message naming the field, if any.
 */
export const unrecognisedAuthorisationField = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    return undefined

  const bodyField = unknownField(payload, ['personRoles', 'personPrivileges'])
  if (bodyField) return `Unrecognized field "${bodyField}" in body`

  const roleField = unknownEntryField(payload.personRoles, ['personId', 'role'])
  if (roleField) return `Unrecognized field "${roleField}" in personRoles`

  const privilegeField = unknownEntryField(payload.personPrivileges, [
    'personId',
    'privilegeNames'
  ])
  if (privilegeField)
    return `Unrecognized field "${privilegeField}" in personPrivileges`

  return undefined
}

// Upstream requires a body with both arrays and a personId in every entry. A missing body or entry
// personId is a 500 on both endpoints; a missing array is a 500 on POST but a 400 on PUT, so the
// endpoint passes the Boom error to throw for it.
const checkAuthorisationPayload = (payload, missingArrayError) => {
  if (!payload || typeof payload !== 'object') {
    throw Boom.internal('request body is required')
  }
  if (
    !Array.isArray(payload.personRoles) ||
    !Array.isArray(payload.personPrivileges)
  ) {
    throw missingArrayError(
      'personRoles and personPrivileges are both required'
    )
  }
  if (
    [...payload.personRoles, ...payload.personPrivileges].some(
      (entry) => entry?.personId == null
    )
  ) {
    throw Boom.internal(
      'personId is required in every personRoles and personPrivileges entry'
    )
  }
}

// Upstream rejects an entry with a missing or empty role with a 500, before checking for existing
// links. It also rejects a role name it doesn't know (case-sensitively, so `agent` isn't `Agent`),
// but its list of roles isn't published, so any other name is accepted here.
const checkRoles = (personRoles) => {
  if (personRoles.some(({ role }) => !role)) {
    throw Boom.internal('role is required in every personRoles entry')
  }
}

// The privilege names from every personPrivileges entry in upstream's spelling, each scheme
// privilege with its "- SA" counterpart
const privilegeNamesFor = (personPrivileges) => {
  const privilegeNames = personPrivileges
    .flatMap(({ privilegeNames }) => privilegeNames ?? [])
    .map((name) => CANONICAL_PRIVILEGE_NAMES.get(String(name).toLowerCase()))
  if (privilegeNames.includes(undefined)) {
    throw new Error('invalid privilege string')
  }
  return [
    ...new Set(
      privilegeNames.flatMap((name) =>
        [name, schemeCounterpart(name) ?? []].flat()
      )
    )
  ]
}

// Upstream rejects a repeated role for a person, otherwise linking them once per role, each link
// with the privileges from every entry; with no personRoles entries, the existing roles are kept
const applyAuthorisation = (
  orgId,
  personId,
  person,
  personRoles,
  personPrivileges
) => {
  const roles = personRoles.map(({ role }) => role)
  if (new Set(roles).size < roles.length) {
    throw Boom.conflict('Relation already exists')
  }
  const privileges = privilegeNamesFor(personPrivileges)

  authorisations[authorisationKey(orgId, personId)] = {
    roles: roles.length
      ? roles
      : authorisationFor(orgId, personId, person).roles,
    privileges
  }
}

// Removes, for each person named in the entries, the roles and privileges named for them, rejecting
// a role the person doesn't have on the organisation with a 404 (a person not linked to it has
// none); removing a person's last role unlinks them from the organisation
const removeAuthorisation = (orgId, personRoles, personPrivileges) => {
  const personIds = [
    ...new Set(
      [...personRoles, ...personPrivileges].map(({ personId }) =>
        String(personId)
      )
    )
  ]
  const changes = personIds.map((personId) => {
    const person = retrieveExistingPerson(personId)
    const rolesToRemove = personRoles
      .filter((entry) => String(entry.personId) === String(personId))
      .map(({ role }) => role)
    const privilegesToRemove = privilegeNamesFor(
      personPrivileges.filter(
        (entry) => String(entry.personId) === String(personId)
      )
    )
    const { roles, privileges } = hasAuthorisation(orgId, personId)
      ? authorisationFor(orgId, personId, person)
      : { roles: [], privileges: [] }

    const missingRole = rolesToRemove.find((role) => !roles.includes(role))
    if (missingRole) {
      throw Boom.notFound(
        `Role ${missingRole} not found for person with personId ${personId}`,
        {
          errorString: 'Entity not found.'
        }
      )
    }
    return {
      personId,
      roles: roles.filter((role) => !rolesToRemove.includes(role)),
      privileges: privileges.filter(
        (name) => !privilegesToRemove.includes(name)
      )
    }
  })

  changes.forEach(({ personId, roles, privileges }) => {
    if (roles.length === 0) {
      unlinkPerson(orgId, personId)
    } else {
      authorisations[authorisationKey(orgId, personId)] = { roles, privileges }
    }
  })
}

/**
 * Create an authorisation (link a person to an organisation with roles + privileges), checking in
 * upstream's order: payload, person, organisation, roles, then existing links. Upstream authorises
 * one person per request, rejecting a body that names more than one with a 400.
 */
export const createAuthorisation = (orgId, payload) => {
  checkAuthorisationPayload(payload, Boom.internal)

  const { personRoles, personPrivileges } = payload
  if (personRoles.length === 0) {
    throw Boom.internal('personRoles must not be empty')
  }
  const entries = [...personRoles, ...personPrivileges]
  if (new Set(entries.map((entry) => String(entry.personId))).size > 1) {
    throw Boom.badRequest('only one person can be authorised per request')
  }

  const { personId } = personRoles[0]
  const person = retrieveExistingPerson(personId)
  retrieveExistingOrganisation(orgId)
  checkRoles(personRoles)

  if (hasAuthorisation(orgId, personId)) {
    throw Boom.conflict('Relation already exists')
  }
  applyAuthorisation(orgId, personId, person, personRoles, personPrivileges)
  linkPerson(orgId, personId)
}

const linkPerson = (orgId, personId) => {
  if (!orgIdToPersonIds[orgId]) orgIdToPersonIds[orgId] = []
  orgIdToPersonIds[orgId].push(Number(personId))

  if (!personIdToOrgIds[personId]) personIdToOrgIds[personId] = []
  if (!personIdToOrgIds[personId].some((id) => sameId(id, orgId))) {
    personIdToOrgIds[personId].push(Number(orgId))
  }
}

const unlinkPerson = (orgId, personId) => {
  orgIdToPersonIds[orgId] = personIdsForOrg(orgId).filter(
    (id) => !sameId(id, personId)
  )
  personIdToOrgIds[personId] = (personIdToOrgIds[personId] || []).filter(
    (id) => !sameId(id, orgId)
  )
  delete authorisations[authorisationKey(orgId, personId)]
}

/**
 * Set a single person’s authorisation on an organisation (idempotent), as upstream does:
 * - a person not yet linked to the organisation is linked
 * - explicitly empty personRoles and personPrivileges arrays remove the link
 * The personId in each entry must match the personId from the route path; upstream reports a
 * mismatch as the person not being found.
 */
export const updateAuthorisation = (orgId, personId, payload) => {
  retrieveExistingOrganisation(orgId)

  const person = retrieveExistingPerson(personId)
  checkAuthorisationPayload(payload, Boom.badRequest)

  const { personRoles, personPrivileges } = payload
  if (personRoles.some((entry) => !sameId(entry.personId, personId))) {
    throw Boom.notFound(
      'personId in personRoles entry must match the personId in the URL path',
      {
        errorString: 'Person not found.'
      }
    )
  }
  if (personPrivileges.some((entry) => !sameId(entry.personId, personId))) {
    throw Boom.notFound(
      'personId in personPrivileges entry must match the personId in the URL path',
      { errorString: 'Person not found.' }
    )
  }
  if (personRoles.length === 0 && personPrivileges.length === 0) {
    unlinkPerson(orgId, personId)
    return
  }

  checkRoles(personRoles)
  applyAuthorisation(orgId, personId, person, personRoles, personPrivileges)
  if (!hasAuthorisation(orgId, personId)) {
    linkPerson(orgId, personId)
  }
}

export const deleteAuthorisation = (orgId, payload) => {
  retrieveExistingOrganisation(orgId)
  checkAuthorisationPayload(payload, Boom.badRequest)

  const { personRoles, personPrivileges } = payload
  checkRoles(personRoles)
  removeAuthorisation(orgId, personRoles, personPrivileges)
}

export const deactivateOrganisation = (orgId) => {
  try {
    const org = retrieveOrganisation(orgId)
    if (!org.locked) {
      throw new Error(`organisation with orgId ${orgId} is already unlocked`)
    }

    org.deactivated = true
  } catch (e) {
    // If not found or not in locked state, throw internal error to match upstream
    throw Boom.internal(e.message)
  }
}

export const reactivateOrganisation = (orgId) => {
  try {
    const org = retrieveOrganisation(orgId)
    if (!org.locked || !org.deactivated) {
      throw new Error(
        `organisation with orgId ${orgId} is not locked and deactivated`
      )
    }

    org.deactivated = false
  } catch (e) {
    // If not found or not locked and deactivated, throw internal error to match upstream
    throw Boom.internal(e.message)
  }
}
