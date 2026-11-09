import fs from 'node:fs'
import { fakeId, faker, safeSeed } from './common.js'
import {
  fcpBusinessLookupPerformance,
  fcpPersonLookupPerformance
} from './fcp-test-data/performance.js'
import { sfdBusinessLookup, sfdPersonLookup } from './sfd-test-data/index.js'

// CRN ranges (all CRNs are 10 digits and at least 9000000000):
// - SFD (sfd-test-data): 9500000000-9699999999
// - DAL and everything else, including generated people: any other CRN from 9000000000 upwards
export const staticPersonData = {
  ...sfdPersonLookup,
  ...fcpPersonLookupPerformance,

  // people in org 111111111 only (sfd-id-check: allow)
  11111111: { crn: '9111111100' },
  11111112: { crn: '9111111200' },
  11111113: { crn: '9111111300' },
  11111114: { crn: '9111111400' },
  11111115: { crn: '9111111500' },
  11111116: { crn: '9111111600' },
  11111117: { crn: '9111111700' },
  11111118: { crn: '9111111800' },
  11111119: {
    // static data overrides example
    crn: '9111111900',
    firstName: 'Big',
    middleName: null,
    lastName: 'Skeleton',
    address: {
      address1: 'A dark dark cellar',
      address2: 'A dark dark staircase',
      address3: 'A dark dark house',
      street: 'A dark dark street',
      city: 'A dark dark town',
      dependentLocality: 'A dark dark hill'
    },
    dateOfBirth: 1065270380449,
    email: 'skeleton@the-closet.net',
    emailValidated: true,
    confirmed: true,
    mobile: null,
    landline: '01632 960627',
    title: null,
    otherTitle: null
  },
  11111121: {
    // static data overrides example - duplicate email that is NOT validated
    crn: '9111112100',
    firstName: 'Baby',
    middleName: null,
    lastName: 'Skeleton',
    email: 'unvalidated@the-closet.net',
    emailValidated: false,
    confirmed: true
  },
  // Person in org 333333333 (sfd-id-check: allow)
  11111120: {
    crn: '9111111901',
    title: 'Lady',
    otherTitle: 'Lady',
    firstName: null,
    middleName: '',
    lastName: 'Grey',
    privileges: []
  },
  // Person in org 333333334 (sfd-id-check: allow)
  11111141: {
    crn: '9111111902',
    title: 'Mr',
    otherTitle: '',
    firstName: 'Frederick',
    middleName: '',
    lastName: 'Forsyth'
  },
  // people in org 111111111 and 222222222 (sfd-id-check: allow)
  11111122: { crn: '9111112200' },
  11111222: { crn: '9111122200' },
  11112222: { crn: '9111222200' },
  11122222: { crn: '9112222200' },
  11222222: { crn: '9122222200' },
  12222222: { crn: '9222222200' },
  // people in org 222222222 only (sfd-id-check: allow)
  22222220: { crn: '9222222000' },
  22222221: { crn: '9222222100' },
  22222222: { crn: '9222222201' },
  22222223: { crn: '9222222300' },
  22222224: { crn: '9222222400' },
  22222225: { crn: '9222222500' },
  22222226: { crn: '9222222600' },
  22222227: { crn: '9222222700' },
  22222228: { crn: '9222222800' },
  22222229: { crn: '9222222900' },
  22222230: { crn: '9222223000' },
  22222231: { crn: '9222223100' },
  22222232: { crn: '9222223200' },
  22222233: { crn: '9222223300' },
  22222234: { crn: '9222223400' },
  22222235: { crn: '9222223500' },
  22222236: { crn: '9222223600' },
  22222237: { crn: '9222223700' },
  22222238: { crn: '9222223800' },
  22222239: { crn: '9222223900' },
  22222240: { crn: '9222224000' },
  22222241: { crn: '9222224100' },
  22222242: { crn: '9222224200' },
  22222243: { crn: '9222224300' },
  22222244: { crn: '9222224400' },
  22222245: { crn: '9222224500' },
  22222246: { crn: '9222224600' },
  22222247: { crn: '9222224700' },
  22222248: { crn: '9222224800' },
  22222249: { crn: '9222224900' },
  22222250: { crn: '9222225000' },
  22222251: { crn: '9222225100' },
  22222252: { crn: '9222225200' },
  22222253: { crn: '9222225300' },
  22222254: { crn: '9222225400' },
  22222255: { crn: '9222225500' },
  22222256: { crn: '9222225600' },
  22222257: { crn: '9222225700' },
  22222258: { crn: '9222225800' },
  22222259: { crn: '9222225900' },
  22222260: { crn: '9222226000' },
  22222261: { crn: '9222226100' },
  22222262: { crn: '9222226200' },
  22222263: { crn: '9222226300' },
  22222264: { crn: '9222226400' },
  22222265: { crn: '9222226500' },
  22222266: { crn: '9222226600' },
  22222267: { crn: '9222226700' },
  22222268: { crn: '9222226800' },
  22222269: { crn: '9222226900' },
  22222270: { crn: '9222227000' },
  22222271: { crn: '9222227100' },
  22222272: { crn: '9222227200' },
  22222273: { crn: '9222227300' },
  22222274: { crn: '9222227400' },
  22222275: { crn: '9222227500' },
  22222276: { crn: '9222227600' },
  22222277: { crn: '9222227700' },
  22222278: { crn: '9222227800' },
  22222279: { crn: '9222227900' },

  // customers not in any org - useful for DAL acceptance tests and the like
  9000000: { crn: '9000000000' },
  9000001: { crn: '9000000001' },

  // dedicated person for every /person/search searchFieldType
  9100000: {
    crn: '9100000000',
    firstName: 'Searchable',
    lastName: 'Searchington',
    personalIdentifiers: ['910000001'], // sfd-id-check: allow - personal identifier
    address: {
      address1: '1 Search Lane',
      address2: null,
      address3: null,
      address4: null,
      address5: null,
      pafOrganisationName: null,
      flatName: null,
      buildingNumberRange: null,
      buildingName: null,
      street: null,
      city: 'Searchton',
      county: null,
      postalCode: 'AB12 3CD',
      country: 'England',
      uprn: '910000000000',
      dependentLocality: null,
      doubleDependentLocality: null,
      addressTypeId: null
    }
  },

  // synthetic replacement for a dev CRM person (real IDs removed)
  9800001: { crn: '9800001000' },

  // midsummer birthdays for testing DoB edge cases - UTC timestamps as millis since the epoch
  9000010: {
    crn: '9000001000',
    dateOfBirth: new Date('2000-06-30T00:00:00Z').getTime()
  },
  9000011: {
    crn: '9000001100',
    dateOfBirth: new Date('1950-06-01T00:00:00Z').getTime()
  },
  // midwinter birthdays for testing DoB edge cases - UTC timestamps as millis since the epoch
  9000012: {
    crn: '9000001200',
    dateOfBirth: new Date('2000-01-01T00:00:00Z').getTime()
  },
  9000013: {
    crn: '9000001300',
    dateOfBirth: new Date('1950-12-31T00:00:00Z').getTime()
  },

  // and now for something completely stupid; dates stored in random timezones 🤦
  // midsummer birthdays for testing DoB edge cases
  9000014: {
    crn: '9000001400',
    dateOfBirth: new Date('01 Jun 2001 GMT+1').getTime()
  },
  9000015: {
    crn: '9000001500',
    dateOfBirth: new Date('30 Jun 1940 GMT+3').getTime()
  },
  9000016: {
    crn: '9000001600',
    dateOfBirth: new Date('01 Jun 2001 GMT-1').getTime()
  },
  9000017: {
    crn: '9000001700',
    dateOfBirth: new Date('30 Jun 1940 GMT-3').getTime()
  },
  // midwinter birthdays for testing DoB edge cases
  9000018: {
    crn: '9000001800',
    dateOfBirth: new Date('01 Jan 2001 GMT+3').getTime()
  },
  9000019: {
    crn: '9000001900',
    dateOfBirth: new Date('31 Dec 1969 GMT+1').getTime()
  },
  9000020: {
    crn: '9000002000',
    dateOfBirth: new Date('01 Jan 2001 GMT-3').getTime()
  },
  9000021: {
    crn: '9000002100',
    dateOfBirth: new Date('31 Dec 1969 GMT-1').getTime()
  }
}

const validGeometries = JSON.parse(
  // Generated using scripts/generate_geometries.sh
  fs.readFileSync(new URL('./valid-geometries.json', import.meta.url))
)
// SBI ranges (all SBIs are 9 digits in the 8xxxxxxxx range):
// - SFD (sfd-test-data): 850000000-869999999
// - Generated organisations: from 880000001 upwards
// - DAL and everything else: any other SBI in the 8xxxxxxxx range
export const orgIdLookup = {
  ...sfdBusinessLookup,
  ...fcpBusinessLookupPerformance,
  /* sfd-id-check: allow - organisation ID */ 100000000: {
    sbi: 800000000,
    customers: [], // org with no customers
    agreements: [], // ... no agreements
    applications: [], // ... no applications
    cphs: [], // ... no CPHs
    land: [], // ... no land
    payments: { parmPayments: [] }, // ... no payments
    overrides: {} // any static overrides for this org can go here
  },
  /* sfd-id-check: allow - organisation ID */ 111111111: {
    sbi: 811111111,
    // Bank-change attempts for this person are locked
    bankLockedPersonIds: [11111119],
    customers: [
      { personId: 11111111 },
      { personId: 11111112 },
      { personId: 11111113 },
      { personId: 11111114 },
      { personId: 11111115 },
      { personId: 11111116 },
      { personId: 11111117 },
      { personId: 11111118 },
      { personId: 11111119 },
      { personId: 11111122 },
      { personId: 11111222 },
      { personId: 11112222 },
      { personId: 11122222 },
      { personId: 11222222 },
      { personId: 12222222 }
    ],
    agreements: [
      {
        contract_id: '111111111', // sfd-id-check: allow - agreement IDs
        payment_schedules: [111111111, 111111112, 111111113] // sfd-id-check: allow - agreement IDs
      },
      {
        contract_id: '111111112', // sfd-id-check: allow - agreement IDs
        payment_schedules: [111111121, 111111122, 111111123] // sfd-id-check: allow - agreement IDs
      },
      {
        contract_id: '111111113', // sfd-id-check: allow - agreement IDs
        payment_schedules: [111111131, 111111132, 111111133] // sfd-id-check: allow - agreement IDs
      }
    ],
    applications: [{ application_history: [{}] }],
    cphs: [{}], // 1 CPH
    land: {
      parcels: [
        {
          id: 7386091,
          properties: {
            area: '10270.39',
            pendingDigitisation: false,
            sheetId: 'TE0001',
            parcelId: '1001'
          },
          geometry: validGeometries[0],
          covers: [
            {
              id: 11769295,
              properties: {
                area: '10270.38',
                code: '110',
                name: 'Arable Land',
                isBpsEligible: 'true'
              },
              type: 'Feature',
              geometry: validGeometries[2]
            },
            {
              id: 11769235,
              properties: {
                area: '25409.79',
                code: '131',
                name: 'Permanent Grassland',
                isBpsEligible: 'true'
              },
              type: 'Feature',
              geometry: validGeometries[3]
            }
          ],
          uses: [
            {
              lu_code: 'WO25'
            }
          ]
        },
        {
          id: 7386092,
          properties: {
            area: '10270.39',
            pendingDigitisation: 'false',
            sheetId: 'TE0002',
            parcelId: '1002'
          },
          geometry: validGeometries[1],
          uses: [{}]
        }
      ]
    }
  },
  /* sfd-id-check: allow - organisation ID */ 222222222: {
    sbi: 822222222,
    // FRN: pinned to match the orgId so bank example payloads stay readable.
    overrides: { businessReference: '2222222222' }, // sfd-id-check: allow - FRN
    // Bank details not editable.
    bankAccountStatus: { submitted: true, updatedRecently: true, new: false },
    existingAccounts: [
      { number: '1234', currency: 'GBP' },
      { number: '5678', currency: 'EUR' }
    ],
    customers: [
      { personId: 11111122 },
      { personId: 11111222 },
      { personId: 11112222 },
      { personId: 11122222 },
      { personId: 11222222 },
      { personId: 12222222 },
      { personId: 22222220 },
      { personId: 22222221 },
      { personId: 22222222 },
      { personId: 22222223 },
      { personId: 22222224 },
      { personId: 22222225 },
      { personId: 22222226 },
      { personId: 22222227 },
      { personId: 22222228 },
      { personId: 22222229 },
      { personId: 22222230 },
      { personId: 22222231 },
      { personId: 22222232 },
      { personId: 22222233 },
      { personId: 22222234 },
      { personId: 22222235 },
      { personId: 22222236 },
      { personId: 22222237 },
      { personId: 22222238 },
      { personId: 22222239 },
      { personId: 22222240 },
      { personId: 22222241 },
      { personId: 22222242 },
      { personId: 22222243 },
      { personId: 22222244 },
      { personId: 22222245 },
      { personId: 22222246 },
      { personId: 22222247 },
      { personId: 22222248 },
      { personId: 22222249 },
      { personId: 22222250 },
      { personId: 22222251 },
      { personId: 22222252 },
      { personId: 22222253 },
      { personId: 22222254 },
      { personId: 22222255 },
      { personId: 22222256 },
      { personId: 22222257 },
      { personId: 22222258 },
      { personId: 22222259 },
      { personId: 22222260 },
      { personId: 22222261 },
      { personId: 22222262 },
      { personId: 22222263 },
      { personId: 22222264 },
      { personId: 22222265 },
      { personId: 22222266 },
      { personId: 22222267 },
      { personId: 22222268 },
      { personId: 22222269 },
      { personId: 22222270 },
      { personId: 22222271 },
      { personId: 22222272 },
      { personId: 22222273 },
      { personId: 22222274 },
      { personId: 22222275 },
      { personId: 22222276 },
      { personId: 22222277 },
      { personId: 22222278 },
      { personId: 22222279 }
    ],
    agreements: [
      {
        contract_id: '222222222', // sfd-id-check: allow - agreement IDs
        payment_schedules: [2222222212, 2222222213, 2222222214] // sfd-id-check: allow - agreement IDs
      },
      {
        contract_id: '222222223', // sfd-id-check: allow - agreement IDs
        payment_schedules: [222222222, 222222223, 222222224] // sfd-id-check: allow - agreement IDs
      },
      {
        contract_id: '222222224', // sfd-id-check: allow - agreement IDs
        payment_schedules: [222222232, 222222233, 222222234] // sfd-id-check: allow - agreement IDs
      }
    ]
  },
  // Contains user with no first name and no messages
  /* sfd-id-check: allow - organisation ID */ 333333333: {
    sbi: 833333333,
    bankAccountStatus: { submitted: false, updatedRecently: false, new: true },
    customers: [
      {
        personId: 11111120,
        messages: []
      }
    ]
  },

  // Contains user with 10 messages, 5 deleted messages
  /* sfd-id-check: allow - organisation ID */ 333333334: {
    sbi: 833333334,
    customers: [
      {
        personId: 11111141,
        messages: [
          {},
          {},
          {},
          {},
          {},
          {},
          {},
          {},
          {},
          {}, // 10 faked messages
          { archive: true },
          { archive: true },
          { archive: true },
          { archive: true }, // 4 faked message that've been deleted
          {
            readAt: '2020-01-31T18:01:30.000Z', // read
            archivedAt: '2020-03-31T18:01:30.000Z', // deleted
            archive: true,
            title: 'Static title',
            body: '<i>static body<i>'
          } // deleted message with comprehensive static data
        ]
      }
    ]
  },

  // Orgs that always returns specific status when requested
  300000206: { sbi: 800000206, customers: [] }, // sfd-id-check: allow - organisation ID
  300000401: { sbi: 800000401, customers: [] }, // sfd-id-check: allow - organisation ID
  300000403: { sbi: 800000403, customers: [] }, // sfd-id-check: allow - organisation ID
  300000500: { sbi: 800000500, customers: [] }, // sfd-id-check: allow - organisation ID

  8910001: {
    sbi: 890000001,
    customers: [],
    applications: [{ application_history: [{}] }], // 1 application with 1 transition entry
    cphs: Array.from({ length: 8 }, () => ({})) // 8 CPHs
  },
  8910002: { sbi: 890000002, customers: [{ personId: 9800001 }] },
  8910003: {
    sbi: 890000003,
    customers: [
      { personId: 9800001 },
      { personId: 9900000 },
      { personId: 9900001 }
    ]
  },
  8910004: {
    sbi: 890000004,
    customers: [{ personId: 9800001 }, { personId: 9500568 }]
  },
  8910005: { sbi: 890000005, customers: [{ personId: 9800001 }] },

  // dedicated org for every /organisation/search searchFieldType
  9100000: {
    sbi: 810000000,
    customers: [{ personId: 9100000 }],
    overrides: {
      name: 'Blue Barn Farm',
      vendorNumber: '123456',
      traderNumber: '654321',
      address: {
        address1: 'Blue Barn',
        address2: null,
        address3: null,
        address4: null,
        address5: null,
        pafOrganisationName: 'Blue Barn Farm',
        flatName: null,
        buildingNumberRange: null,
        buildingName: null,
        street: null,
        city: 'Searchton',
        county: null,
        postalCode: 'AB12 3CD',
        country: 'England',
        uprn: '910000000001',
        dependentLocality: null,
        doubleDependentLocality: null,
        addressTypeId: null
      }
    }
  },

  // for DAL mutation tests
  9000001: {
    sbi: 800000001,
    customers: [],
    bankAccountStatus: { submitted: false, updatedRecently: true, new: false }
  },
  9000002: { sbi: 800000002, customers: [] },
  // for CV/DAL DoB edge case tests
  9000003: {
    sbi: 800000003,
    customers: [
      { personId: 9000010 },
      { personId: 9000011 },
      { personId: 9000012 },
      { personId: 9000013 },
      { personId: 9000014 },
      { personId: 9000015 },
      { personId: 9000016 },
      { personId: 9000017 },
      { personId: 9000018 },
      { personId: 9000019 },
      { personId: 9000020 },
      { personId: 9000021 }
    ]
  },
  // dedicated org for deactivate/reactivate
  9200000: {
    sbi: 820000000,
    customers: [{ personId: 9200000 }],
    overrides: {
      name: 'Blue Barn',
      vendorNumber: '123456',
      traderNumber: '654321',
      address: {
        address1: 'Blue Barn',
        address2: null,
        address3: null,
        address4: null,
        address5: null,
        pafOrganisationName: 'Blue Barn Farm',
        flatName: null,
        buildingNumberRange: null,
        buildingName: null,
        street: null,
        city: 'Searchton',
        county: null,
        postalCode: 'AB12 3XX',
        country: 'England',
        uprn: '920000000001',
        dependentLocality: null,
        doubleDependentLocality: null,
        addressTypeId: null
      },
      locked: true,
      deactivated: false
    }
  },
  // dedicated org for reactivate, starts locked and deactivated
  9200001: {
    sbi: 820000001,
    customers: [],
    overrides: {
      name: 'Green Gate',
      locked: true,
      deactivated: true
    }
  },
  // dedicated org for lock, starts unlocked.
  9200003: {
    sbi: 820000003,
    customers: [],
    overrides: {
      name: 'Locking Tests',
      locked: false,
      deactivated: false
    }
  }
}

// Derived inverses — calculated once
export const crnToPersonId = Object.fromEntries(
  Object.entries(staticPersonData).map(([personId, { crn }]) => [crn, personId])
)

// The id of each person's PartyDigitalContact record (see /person/{personId}/{email}/confirm),
// derived the same way for every known person so it can be looked up in either direction.
export const personIdToDigitalContactPartyId = {}
export const digitalContactPartyIdToPersonId = {}

Object.keys(staticPersonData).forEach((personId) => {
  safeSeed([personId, 'partyDigitalContactId'])
  const digitalContactPartyId = fakeId()
  personIdToDigitalContactPartyId[personId] = digitalContactPartyId
  digitalContactPartyIdToPersonId[digitalContactPartyId] = personId
})
export const sbiToOrgId = {}
export const orgIdToSbi = {}
export const frnToOrgId = {}
export const frnToPaymentOverrides = {}
export const orgIdToPersonIds = {}
export const personIdToOrgIds = {}
export const bankAccountStatusByOrgId = {}
export const bankExistingAccountsByOrgId = {}
export const bankLockedPairs = new Set()

// Bank account test accounts. Key is account number
export const bankValidateTestAccounts = {
  11111100: { sortCode: '111111', bankName: 'Match Bank', status: 'MATCH' },
  22222200: {
    sortCode: '222222',
    bankName: 'Partial Match Bank',
    status: 'PARTIAL_MATCH'
  },
  33333300: { sortCode: '333333', bankName: 'No Match Bank', status: 'FAILED' }
}

Object.entries(orgIdLookup).forEach(([orgId, orgDetails]) => {
  const {
    sbi,
    customers,
    overrides,
    bankAccountStatus,
    bankLockedPersonIds,
    existingAccounts
  } = orgDetails
  orgIdToSbi[orgId] = sbi
  sbiToOrgId[sbi] = orgId

  // NOTE: we expect FRNs for Hitachi payments API, the "businessReference" from overrides
  if (overrides?.businessReference === undefined) {
    safeSeed(orgId) // set consistent seed point for repeatable FRNs for businesses
    const frn = faker.string.numeric(10)
    frnToPaymentOverrides[frn] = orgDetails.payments ?? {}
    // store FRN with static data overrides for later use
    orgDetails.overrides = { ...overrides, businessReference: frn }
    frnToOrgId[frn] = orgId
  } else {
    // businessReference is the FRN!
    frnToPaymentOverrides[overrides.businessReference] =
      orgDetails.payments ?? {}
    frnToOrgId[overrides.businessReference] = orgId
  }

  // customers may be raw person-id numbers (e.g. fcp-test-data/performance.js) or { personId }
  orgIdToPersonIds[orgId] = customers.map((customer) => {
    const personId = typeof customer === 'number' ? customer : customer.personId
    if (!personIdToOrgIds[personId]) {
      personIdToOrgIds[personId] = []
    }
    personIdToOrgIds[personId].push(Number(orgId))
    return personId
  })

  if (bankAccountStatus) {
    bankAccountStatusByOrgId[orgId] = bankAccountStatus
  }
  bankLockedPersonIds?.forEach((personId) => {
    bankLockedPairs.add(`${orgId}:${personId}`)
  })

  if (existingAccounts) {
    bankExistingAccountsByOrgId[orgId] = existingAccounts
  }
})
