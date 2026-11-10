/**
 * personLookupEntries: personId -> override object for person details (crn, name, dob, address, phones,
 * email). Entries are merged into staticPersonData in id-lookups.js and applied as overrides in
 * person.factory.js generatePerson(personId, crn, overrides). Only include the keys you need; other
 * person fields come from factory defaults. Edge-case / business test data only. Performance-test
 * person data is in performance.js and merged at sfd-test-data/index.js.
 *
 * - Manual addresses only: We do not use lookup addresses; uprn is always null.
 *   In this mapping, city/town is stored in shared `city` and county is stored in `address4`.
 *   Test data uses manual address fields (address1-5, postalCode, country) and keeps lookup-only
 *   fields (for example `street`) null; see minimalMandatoryAddress below.
 * - Default address: At export time we merge a default (defaultPersonOverride with
 *   address: minimalMandatoryAddress) into every entry. If an entry does not set address, it gets
 *   that default, so address data is predictable. If an entry does set address, that value replaces
 *   the default.
 * - Overriding address: To test invalid or special addresses (e.g. empty, missing address1, too long),
 *   set address on the entry and provide the full address object (e.g. emptyAddress or
 *   { ...minimalMandatoryAddress, address1: null }). We override in full so the mock returns exactly
 *   the address needed for that scenario. The merge block at the bottom of the file applies the
 *   default; see the comment there for details.
 *
 * Example shape for sfdPersonLookup entries:
 *
 * {
 *   crn: '9600000000',
 *   firstName: 'First',
 *   lastName: 'Last',
 *   dateOfBirth: new Date('2000-01-01T00:00:00Z').getTime(),
 *   landline: '01234567890',
 *   mobile: '07123456789',
 *   email: 'person@example.com',
 *   address: {
 *     address1: 'Line 1',
 *     address2: null,
 *     address3: null,
 *     address4: 'Test County',
 *     address5: null,
 *     street: null,
 *     city: 'Test City',
 *     county: null,
 *     postalCode: 'AB1 2CD',
 *     country: 'United Kingdom',
 *     uprn: null  // Set to null for manual entry / test scenarios (no lookup)
 *   }
 * }
 *
 * Omit address to get the default; set address to override (see minimalMandatoryAddress and shared
 * shapes below).
 *
 * Person IDs follow the same numbering/buffer approach as business.js: 1000-person-ID buffer between
 * different scenario types; 10 examples per scenario.
 */

// Shared constants
const nameTooLong = 'A'.repeat(101)

// Shared address shapes
const emptyAddress = {
  address1: '',
  address2: '',
  address3: '',
  address4: '',
  address5: '',
  city: '',
  county: '',
  postalCode: '',
  country: '',
  uprn: null
}

/*
 * Manual address only (no lookup): uprn is null; we do not use lookup data.
 *
 * Manual fields used:
 * - address1: Address line 1 (required). address2, address3, address5: optional lines (null if unused).
 * - address4: County (manual line 4 now stores county in this fixture mapping).
 * - postalCode, country: Required.
 *
 * Shared/lookup fields include city + county. For this mapping, city carries town/city and
 * address4 carries county while lookup-only fields (for example street) remain null.
 */
const minimalMandatoryAddress = {
  address1: '123 Test Street',
  address2: null,
  address3: null,
  address4: 'Test County',
  address5: null,
  street: null,
  city: 'Test City',
  county: null,
  postalCode: 'TE1 2ST',
  country: 'England',
  uprn: null
}

const nullAddress = {
  address1: null,
  address2: null,
  address3: null,
  address4: null,
  address5: null,
  pafOrganisationName: null,
  flatName: null,
  buildingNumberRange: null,
  buildingName: null,
  street: null,
  city: null,
  county: null,
  postalCode: null,
  country: null,
  uprn: null,
  dependentLocality: null,
  doubleDependentLocality: null,
  addressTypeId: null
}

// Base applied to every person so address is predictable unless the entry overrides address.
const defaultPersonOverride = { address: minimalMandatoryAddress }

// Address fields too long
const addressTooLongAddress = {
  address1: 'A'.repeat(101),
  address2: '',
  address3: '',
  address4: 'D'.repeat(61),
  address5: 'D'.repeat(61),
  street: null,
  city: 'C'.repeat(63),
  county: null,
  postalCode: 'P'.repeat(9),
  country: 'E'.repeat(63),
  uprn: null
}

const invalidDOBOnly = {
  firstName: 'Date of birth',
  lastName: 'invalid',
  dateOfBirth: new Date('2049-01-01T00:00:00Z').getTime()
}

const emptyPhoneAndMobile = {
  firstName: 'Phone and mobile',
  lastName: 'empty',
  landline: '',
  mobile: ''
}

const nullPhoneAndMobile = {
  firstName: 'Phone and mobile',
  lastName: 'null',
  landline: null,
  mobile: null
}

const invalidMobileOnly = {
  firstName: 'Mobile',
  lastName: 'invalid',
  mobile: 'not-a-phone'
}

const invalidPhoneOnly = {
  firstName: 'Phone',
  lastName: 'invalid',
  landline: 'not-a-phone'
}

const invalidEmailOnly = {
  firstName: 'Email',
  lastName: 'invalid',
  email: 'not-an-email'
}

// All five invalid: name, DOB, email, phone, address
const allInvalidPersonBase = {
  firstName: '',
  lastName: '',
  dateOfBirth: new Date('2049-01-01T00:00:00Z').getTime(),
  email: '',
  landline: '',
  mobile: '',
  address: { ...emptyAddress }
}

const personLookupEntries = {
  // SFD edge case test users - static entries for testing
  // Starting from person ID 3000000, CRN 9600000000
  // 1000-person-ID buffer between categories, 10 examples per category

  // Clean Control (3000000-3000099) - All valid data for comparison
  3000000: { crn: '9600000000', firstName: 'Clean', lastName: 'Control' },
  3000001: { crn: '9600000001', firstName: 'Clean', lastName: 'Control' },
  3000002: { crn: '9600000002', firstName: 'Clean', lastName: 'Control' },
  3000003: { crn: '9600000003', firstName: 'Clean', lastName: 'Control' },
  3000004: { crn: '9600000004', firstName: 'Clean', lastName: 'Control' },
  3000005: { crn: '9600000005', firstName: 'Clean', lastName: 'Control' },
  3000006: { crn: '9600000006', firstName: 'Clean', lastName: 'Control' },
  3000007: { crn: '9600000007', firstName: 'Clean', lastName: 'Control' },
  3000008: { crn: '9600000008', firstName: 'Clean', lastName: 'Control' },
  3000009: { crn: '9600000009', firstName: 'Clean', lastName: 'Control' },

  // Personal details edge cases (3010000-3010099) - null/empty + invalid
  // Name (3010000-3010019) - null/empty + invalid
  3010000: { crn: '9610000000', firstName: '', lastName: 'invalid first name' },
  3010001: { crn: '9610000001', firstName: '', lastName: 'invalid first name' },
  3010002: { crn: '9610000002', firstName: '', lastName: 'invalid first name' },
  3010003: { crn: '9610000003', firstName: '', lastName: 'invalid first name' },
  3010004: { crn: '9610000004', firstName: '', lastName: 'invalid first name' },
  3010005: { crn: '9610000005', firstName: '', lastName: 'invalid first name' },
  3010006: { crn: '9610000006', firstName: 'invalid last name', lastName: '' },
  3010007: { crn: '9610000007', firstName: 'invalid last name', lastName: '' },
  3010008: { crn: '9610000008', firstName: 'invalid last name', lastName: '' },
  3010009: { crn: '9610000009', firstName: 'invalid last name', lastName: '' },
  3010010: {
    crn: '9610000010',
    firstName: nameTooLong,
    lastName: 'invalid first name'
  },
  3010011: {
    crn: '9610000011',
    firstName: nameTooLong,
    lastName: 'invalid first name'
  },
  3010012: {
    crn: '9610000012',
    firstName: nameTooLong,
    lastName: 'invalid first name'
  },
  3010013: {
    crn: '9610000013',
    firstName: nameTooLong,
    lastName: 'invalid first name'
  },
  3010014: {
    crn: '9610000014',
    firstName: nameTooLong,
    lastName: 'invalid first name'
  },
  3010015: {
    crn: '9610000015',
    firstName: 'invalid last name',
    lastName: nameTooLong
  },
  3010016: {
    crn: '9610000016',
    firstName: 'invalid last name',
    lastName: nameTooLong
  },
  3010017: {
    crn: '9610000017',
    firstName: 'invalid last name',
    lastName: nameTooLong
  },
  3010018: {
    crn: '9610000018',
    firstName: 'invalid last name',
    lastName: nameTooLong
  },
  3010019: {
    crn: '9610000019',
    firstName: 'invalid last name',
    lastName: nameTooLong
  },
  // DOB (3010020-3010039) - null/empty
  3010020: {
    crn: '9610000020',
    firstName: 'Invalid',
    lastName: 'dob',
    dateOfBirth: null
  },
  3010021: {
    crn: '9610000021',
    firstName: 'Invalid',
    lastName: 'dob',
    dateOfBirth: null
  },
  3010022: {
    crn: '9610000022',
    firstName: 'Invalid',
    lastName: 'dob',
    dateOfBirth: null
  },
  3010023: {
    crn: '9610000023',
    firstName: 'Invalid',
    lastName: 'dob',
    dateOfBirth: null
  },
  3010024: {
    crn: '9610000024',
    firstName: 'Invalid',
    lastName: 'dob',
    dateOfBirth: null
  },
  3010025: {
    crn: '9610000025',
    firstName: 'Invalid',
    lastName: 'dob',
    dateOfBirth: null
  },
  3010026: {
    crn: '9610000026',
    firstName: 'Invalid',
    lastName: 'dob',
    dateOfBirth: null
  },
  3010027: {
    crn: '9610000027',
    firstName: 'Invalid',
    lastName: 'dob',
    dateOfBirth: null
  },
  3010028: {
    crn: '9610000028',
    firstName: 'Invalid',
    lastName: 'dob',
    dateOfBirth: null
  },
  3010029: {
    crn: '9610000029',
    firstName: 'Invalid',
    lastName: 'dob',
    dateOfBirth: null
  },
  3010030: {
    crn: '9610000030',
    firstName: 'Invalid',
    lastName: 'dob',
    dateOfBirth: null
  },
  3010031: {
    crn: '9610000031',
    firstName: 'Invalid',
    lastName: 'dob',
    dateOfBirth: null
  },
  3010032: {
    crn: '9610000032',
    firstName: 'Invalid',
    lastName: 'dob',
    dateOfBirth: null
  },
  3010033: {
    crn: '9610000033',
    firstName: 'Invalid',
    lastName: 'dob',
    dateOfBirth: null
  },
  3010034: {
    crn: '9610000034',
    firstName: 'Invalid',
    lastName: 'dob',
    dateOfBirth: null
  },
  3010035: {
    crn: '9610000035',
    firstName: 'Invalid',
    lastName: 'dob',
    dateOfBirth: null
  },
  3010036: {
    crn: '9610000036',
    firstName: 'Invalid',
    lastName: 'dob',
    dateOfBirth: null
  },
  3010037: {
    crn: '9610000037',
    firstName: 'Invalid',
    lastName: 'dob',
    dateOfBirth: null
  },
  3010038: {
    crn: '9610000038',
    firstName: 'Invalid',
    lastName: 'dob',
    dateOfBirth: null
  },
  3010039: {
    crn: '9610000039',
    firstName: 'Invalid',
    lastName: 'dob',
    dateOfBirth: null
  },

  // DOB invalid - future date (3001000-3001099)
  3001000: { crn: '9601000000', ...invalidDOBOnly },
  3001001: { crn: '9601000001', ...invalidDOBOnly },
  3001002: { crn: '9601000002', ...invalidDOBOnly },
  3001003: { crn: '9601000003', ...invalidDOBOnly },
  3001004: { crn: '9601000004', ...invalidDOBOnly },
  3001005: { crn: '9601000005', ...invalidDOBOnly },
  3001006: { crn: '9601000006', ...invalidDOBOnly },
  3001007: { crn: '9601000007', ...invalidDOBOnly },
  3001008: { crn: '9601000008', ...invalidDOBOnly },
  3001009: { crn: '9601000009', ...invalidDOBOnly },

  // Missing Mandatory Address Fields (3002000-3002999) - Missing address fields
  // 3002000-3002099: Missing address1, city
  3002000: {
    crn: '9602000000',
    firstName: 'Missing',
    lastName: 'Address',
    address: { ...minimalMandatoryAddress, address1: null, city: null }
  },
  // 3002100-3002199: Missing address1
  3002100: {
    crn: '9602100000',
    firstName: 'Missing',
    lastName: 'Address',
    address: { ...minimalMandatoryAddress, address1: null }
  },
  // 3002200-3002299: Missing city and postalCode
  3002200: {
    crn: '9602200000',
    firstName: 'Missing',
    lastName: 'Address',
    address: { ...minimalMandatoryAddress, city: null, postalCode: null }
  },
  // 3002300-3002399: Missing address1 only
  3002300: {
    crn: '9602300000',
    firstName: 'Missing',
    lastName: 'Address',
    address: { ...minimalMandatoryAddress, address1: null }
  },
  // 3002500-3002599: Missing city only
  3002500: {
    crn: '9602500000',
    firstName: 'Missing',
    lastName: 'Address',
    address: { ...minimalMandatoryAddress, city: null }
  },
  // 3002600-3002699: Missing address1 and city
  3002600: {
    crn: '9602600000',
    firstName: 'Missing',
    lastName: 'Address',
    address: { ...minimalMandatoryAddress, address1: null, city: null }
  },
  // 3002800-3002899: Missing postalCode
  3002800: {
    crn: '9602800000',
    firstName: 'Missing',
    lastName: 'Address',
    address: { ...minimalMandatoryAddress, postalCode: null }
  },
  // 3002900-3002999: Missing all address fields except country
  3002900: {
    crn: '9602900000',
    firstName: 'Missing',
    lastName: 'Address',
    address: {
      ...minimalMandatoryAddress,
      address1: null,
      city: null,
      postalCode: null
    }
  },

  // Address - empty
  3010040: {
    crn: '9610000040',
    firstName: 'Address',
    lastName: 'empty',
    address: emptyAddress
  },
  3010041: {
    crn: '9610000041',
    firstName: 'Address',
    lastName: 'empty',
    address: emptyAddress
  },
  3010042: {
    crn: '9610000042',
    firstName: 'Address',
    lastName: 'empty',
    address: emptyAddress
  },
  3010043: {
    crn: '9610000043',
    firstName: 'Address',
    lastName: 'empty',
    address: emptyAddress
  },
  3010044: {
    crn: '9610000044',
    firstName: 'Address',
    lastName: 'empty',
    address: emptyAddress
  },
  3010045: {
    crn: '9610000045',
    firstName: 'Address',
    lastName: 'empty',
    address: emptyAddress
  },
  3010046: {
    crn: '9610000046',
    firstName: 'Address',
    lastName: 'empty',
    address: emptyAddress
  },
  3010047: {
    crn: '9610000047',
    firstName: 'Address',
    lastName: 'empty',
    address: emptyAddress
  },
  3010048: {
    crn: '9610000048',
    firstName: 'Address',
    lastName: 'empty',
    address: emptyAddress
  },
  3010049: {
    crn: '9610000049',
    firstName: 'Address',
    lastName: 'empty',
    address: emptyAddress
  },

  // Address - too long
  3010050: {
    crn: '9610000050',
    firstName: 'Address',
    lastName: 'too long',
    address: addressTooLongAddress
  },
  3010051: {
    crn: '9610000051',
    firstName: 'Address',
    lastName: 'too long',
    address: addressTooLongAddress
  },
  3010052: {
    crn: '9610000052',
    firstName: 'Address',
    lastName: 'too long',
    address: addressTooLongAddress
  },
  3010053: {
    crn: '9610000053',
    firstName: 'Address',
    lastName: 'too long',
    address: addressTooLongAddress
  },
  3010054: {
    crn: '9610000054',
    firstName: 'Address',
    lastName: 'too long',
    address: addressTooLongAddress
  },
  3010055: {
    crn: '9610000055',
    firstName: 'Address',
    lastName: 'too long',
    address: addressTooLongAddress
  },
  3010056: {
    crn: '9610000056',
    firstName: 'Address',
    lastName: 'too long',
    address: addressTooLongAddress
  },
  3010057: {
    crn: '9610000057',
    firstName: 'Address',
    lastName: 'too long',
    address: addressTooLongAddress
  },
  3010058: {
    crn: '9610000058',
    firstName: 'Address',
    lastName: 'too long',
    address: addressTooLongAddress
  },
  3010059: {
    crn: '9610000059',
    firstName: 'Address',
    lastName: 'too long',
    address: addressTooLongAddress
  },

  // Phone - both phones empty
  3010060: { crn: '9610000060', ...emptyPhoneAndMobile },
  3010061: { crn: '9610000061', ...emptyPhoneAndMobile },
  3010062: { crn: '9610000062', ...emptyPhoneAndMobile },
  3010063: { crn: '9610000063', ...emptyPhoneAndMobile },
  3010064: { crn: '9610000064', ...emptyPhoneAndMobile },

  // Phone - both phones null
  3010065: { crn: '9610000065', ...nullPhoneAndMobile },
  3010066: { crn: '9610000066', ...nullPhoneAndMobile },
  3010067: { crn: '9610000067', ...nullPhoneAndMobile },
  3010068: { crn: '9610000068', ...nullPhoneAndMobile },
  3010069: { crn: '9610000069', ...nullPhoneAndMobile },

  // Phone - both phones invalid
  3010070: {
    crn: '9610000070',
    firstName: 'Invalid',
    lastName: 'phone',
    landline: '12345',
    mobile: null
  },
  3010071: {
    crn: '9610000071',
    firstName: 'Invalid',
    lastName: 'phone',
    landline: null,
    mobile: '123456789' // sfd-id-check: allow - phone number
  },
  3010072: {
    crn: '9610000072',
    firstName: 'Invalid',
    lastName: 'phone',
    landline: '1'.repeat(51),
    mobile: null
  },
  3010073: {
    crn: '9610000073',
    firstName: 'Invalid',
    lastName: 'phone',
    landline: null,
    mobile: '2'.repeat(51)
  },
  3010074: {
    crn: '9610000074',
    firstName: 'Invalid',
    lastName: 'phone',
    landline: '123456789', // sfd-id-check: allow - phone number
    mobile: null
  },
  3010075: {
    crn: '9610000075',
    firstName: 'Invalid',
    lastName: 'phone',
    landline: null,
    mobile: '12345'
  },
  3010076: {
    crn: '9610000076',
    firstName: 'Invalid',
    lastName: 'phone',
    landline: '3'.repeat(51),
    mobile: ''
  },
  3010077: {
    crn: '9610000077',
    firstName: 'Invalid',
    lastName: 'phone',
    landline: '',
    mobile: '4'.repeat(51)
  },
  3010078: {
    crn: '9610000078',
    firstName: 'Invalid',
    lastName: 'phone',
    landline: '12',
    mobile: ''
  },
  3010079: {
    crn: '9610000079',
    firstName: 'Invalid',
    lastName: 'phone',
    landline: '',
    mobile: '34'
  },

  // Invalid Phone (3004000-3004999) - Invalid phone formats
  // 3004000-3004099: Invalid phone 'not-a-phone'
  3004000: {
    crn: '9604000000',
    firstName: 'Invalid',
    lastName: 'Phone',
    mobile: 'not-a-phone'
  },
  // 3004100-3004199: Too short
  3004100: {
    crn: '9604100000',
    firstName: 'Invalid',
    lastName: 'Phone',
    mobile: '123'
  },
  // 3004200-3004299: Contains letters
  3004200: {
    crn: '9604200000',
    firstName: 'Invalid',
    lastName: 'Phone',
    mobile: 'abc-def-ghij'
  },
  // 3004300-3004399: Special characters only
  3004300: {
    crn: '9604300000',
    firstName: 'Invalid',
    lastName: 'Phone',
    mobile: '!@#$%^&*()'
  },
  // 3004400-3004499: Empty string
  3004400: {
    crn: '9604400000',
    firstName: 'Invalid',
    lastName: 'Phone',
    mobile: ''
  },
  // 3004500-3004599: Spaces only
  3004500: {
    crn: '9604500000',
    firstName: 'Invalid',
    lastName: 'Phone',
    mobile: '   '
  },
  // 3004600-3004699: Wrong format
  3004600: {
    crn: '9604600000',
    firstName: 'Invalid',
    lastName: 'Phone',
    mobile: '123-45'
  },
  // 3004700-3004799: Mixed invalid (letters and numbers)
  3004700: {
    crn: '9604700000',
    firstName: 'Invalid',
    lastName: 'Phone',
    mobile: '12abc34'
  },
  // 3004800-3004899: Too long
  3004800: {
    crn: '9604800000',
    firstName: 'Invalid',
    lastName: 'Phone',
    mobile: '12345678901234567890'
  },
  // 3004900-3004999: Null as string
  3004900: {
    crn: '9604900000',
    firstName: 'Invalid',
    lastName: 'Phone',
    mobile: 'null'
  },

  // Email (3010080-3010099) - null/empty + invalid
  3010080: {
    crn: '9610000080',
    firstName: 'Email',
    lastName: 'empty',
    email: ''
  },
  3010081: {
    crn: '9610000081',
    firstName: 'Email',
    lastName: 'empty',
    email: ''
  },
  3010082: {
    crn: '9610000082',
    firstName: 'Email',
    lastName: 'empty',
    email: ''
  },
  3010083: {
    crn: '9610000083',
    firstName: 'Email',
    lastName: 'empty',
    email: ''
  },
  3010084: {
    crn: '9610000084',
    firstName: 'Email',
    lastName: 'empty',
    email: ''
  },
  3010085: {
    crn: '9610000085',
    firstName: 'Email',
    lastName: 'null',
    email: null
  },
  3010086: {
    crn: '9610000086',
    firstName: 'Email',
    lastName: 'null',
    email: null
  },
  3010087: {
    crn: '9610000087',
    firstName: 'Email',
    lastName: 'null',
    email: null
  },
  3010088: {
    crn: '9610000088',
    firstName: 'Email',
    lastName: 'null',
    email: null
  },
  3010089: {
    crn: '9610000089',
    firstName: 'Email',
    lastName: 'null',
    email: null
  },
  3010090: { crn: '9610000090', ...invalidEmailOnly },
  3010091: { crn: '9610000091', ...invalidEmailOnly },
  3010092: { crn: '9610000092', ...invalidEmailOnly },
  3010093: { crn: '9610000093', ...invalidEmailOnly },
  3010094: { crn: '9610000094', ...invalidEmailOnly },
  3010095: { crn: '9610000095', ...invalidEmailOnly },
  3010096: { crn: '9610000096', ...invalidEmailOnly },
  3010097: { crn: '9610000097', ...invalidEmailOnly },
  3010098: { crn: '9610000098', ...invalidEmailOnly },
  3010099: {
    crn: '9610000099',
    firstName: 'Email',
    lastName: 'too long',
    email: 'a'.repeat(251) + '@example.com'
  },

  // Invalid Email (3003000-3003999) - Invalid email formats
  // 3003000-3003099: Invalid email format 'not-an-email'
  3003000: {
    crn: '9603000000',
    firstName: 'Invalid',
    lastName: 'Email',
    email: 'not-an-email'
  },
  // 3003100-3003199: Missing @ symbol
  3003100: {
    crn: '9603100000',
    firstName: 'Invalid',
    lastName: 'Email',
    email: 'invalidemail.com'
  },
  // 3003200-3003299: Missing domain
  3003200: {
    crn: '9603200000',
    firstName: 'Invalid',
    lastName: 'Email',
    email: 'invalid@'
  },
  // 3003300-3003399: Missing local part
  3003300: {
    crn: '9603300000',
    firstName: 'Invalid',
    lastName: 'Email',
    email: '@example.com'
  },
  // 3003400-3003499: Contains spaces
  3003400: {
    crn: '9603400000',
    firstName: 'Invalid',
    lastName: 'Email',
    email: 'invalid email@example.com'
  },
  // 3003500-3003599: Multiple @ symbols
  3003500: {
    crn: '9603500000',
    firstName: 'Invalid',
    lastName: 'Email',
    email: 'invalid@@example.com'
  },
  // 3003600-3003699: No TLD
  3003600: {
    crn: '9603600000',
    firstName: 'Invalid',
    lastName: 'Email',
    email: 'invalid@example'
  },
  // 3003700-3003799: Just text (no @ or domain)
  3003700: {
    crn: '9603700000',
    firstName: 'Invalid',
    lastName: 'Email',
    email: 'justtext'
  },
  // 3003800-3003899: Special characters
  3003800: {
    crn: '9603800000',
    firstName: 'Invalid',
    lastName: 'Email',
    email: 'invalid!@#$%example.com'
  },
  // 3003900-3003999: Empty string
  3003900: {
    crn: '9603900000',
    firstName: 'Invalid',
    lastName: 'Email',
    email: ''
  },

  // Multiple Invalid Fields (3005000-3005999) - Multiple invalid fields
  // 3005000-3005099: Invalid email + phone + future DOB
  3005000: {
    // Invalid email + phone + future DOB - example 1
    crn: '9605000000',
    firstName: 'Multiple',
    lastName: 'Invalid',
    email: 'not-an-email',
    mobile: 'not-a-phone',
    dateOfBirth: new Date('2030-01-01T00:00:00Z').getTime()
  },
  // 3005100-3005199: Invalid email + phone + missing address
  3005100: {
    // Invalid email + phone + missing address - example 1
    crn: '9605100000',
    firstName: 'Multiple',
    lastName: 'Invalid',
    email: 'invalid@',
    mobile: '123',
    address: {
      address1: null,
      street: null,
      city: null,
      postalCode: 'TE1 2ST',
      country: 'England',
      uprn: null
    }
  },
  // 3005200-3005299: Future DOB + invalid email + missing address
  3005200: {
    // Future DOB + invalid email + missing address - example 1
    crn: '9605200000',
    firstName: 'Multiple',
    lastName: 'Invalid',
    dateOfBirth: new Date('2035-06-15T00:00:00Z').getTime(),
    email: 'bad-email',
    address: {
      address1: null,
      street: null,
      city: 'Test City',
      postalCode: null,
      country: 'England',
      uprn: null
    }
  },
  // 3005300-3005399: Invalid phone + missing address + future DOB
  3005300: {
    // Invalid phone + missing address + future DOB - example 1
    crn: '9605300000',
    firstName: 'Multiple',
    lastName: 'Invalid',
    mobile: 'abc',
    dateOfBirth: new Date('2029-12-31T00:00:00Z').getTime(),
    address: {
      address1: null,
      street: 'Test Street',
      city: null,
      postalCode: null,
      country: 'England',
      uprn: null
    }
  },
  // 3005400-3005499: Multiple invalid (email, phone, DOB, address)
  3005400: {
    // Multiple invalid: email, phone, DOB, address - example 1
    crn: '9605400000',
    firstName: 'Multiple',
    lastName: 'Invalid',
    email: 'invalid@@example.com',
    mobile: 'not-a-phone',
    dateOfBirth: new Date('2040-01-01T00:00:00Z').getTime(),
    address: { ...emptyAddress }
  },
  // 3005500-3005599: Invalid email + phone
  3005500: {
    // Invalid email + phone - example 1
    crn: '9605500000',
    firstName: 'Multiple',
    lastName: 'Invalid',
    email: 'bad@email',
    mobile: '12345'
  },
  // 3005600-3005699: Future DOB + invalid email
  3005600: {
    // Future DOB + invalid email - example 1
    crn: '9605600000',
    firstName: 'Multiple',
    lastName: 'Invalid',
    dateOfBirth: new Date('2032-11-11T00:00:00Z').getTime(),
    email: 'invalid email@example.com'
  },
  // 3005700-3005799: Invalid phone + missing address
  3005700: {
    // Invalid phone + missing address - example 1
    crn: '9605700000',
    firstName: 'Multiple',
    lastName: 'Invalid',
    mobile: '!@#$%',
    address: { ...emptyAddress }
  },
  // 3005800-3005899: Future DOB + missing address + invalid phone
  3005800: {
    // Future DOB + missing address + invalid phone - example 1
    crn: '9605800000',
    firstName: 'Multiple',
    lastName: 'Invalid',
    dateOfBirth: new Date('2027-05-15T00:00:00Z').getTime(),
    mobile: 'abc123',
    address: { ...emptyAddress }
  },
  // 3005900-3005999: Invalid email + phone + future DOB + missing address
  3005900: {
    // Invalid email + phone + future DOB + missing address - example 1
    crn: '9605900000',
    firstName: 'Multiple',
    lastName: 'Invalid',
    email: '',
    mobile: '',
    dateOfBirth: new Date('2033-09-30T00:00:00Z').getTime(),
    address: { ...emptyAddress }
  },

  // One Field Wrong (3006000-3006999) - Single invalid field combinations
  // 3006000-3006099: Invalid DOB only
  3006000: {
    // Invalid DOB only - example 1
    crn: '9606000000',
    firstName: 'One',
    lastName: 'Wrong',
    dateOfBirth: new Date('2030-01-01T00:00:00Z').getTime()
  },
  // 3006100-3006199: Invalid email only
  3006100: {
    // Invalid email only - example 1
    crn: '9606100000',
    firstName: 'One',
    lastName: 'Wrong',
    email: 'not-an-email'
  },
  // Invalid mobile only
  3006200: { crn: '9606200000', ...invalidMobileOnly },
  3006201: { crn: '9606201000', ...invalidMobileOnly },
  3006202: { crn: '9606202000', ...invalidMobileOnly },
  3006203: { crn: '9606203000', ...invalidMobileOnly },
  3006204: { crn: '9606204000', ...invalidMobileOnly },
  3006205: { crn: '9606205000', ...invalidMobileOnly },
  3006206: { crn: '9606206000', ...invalidMobileOnly },
  3006207: { crn: '9606207000', ...invalidMobileOnly },
  3006208: { crn: '9606208000', ...invalidMobileOnly },
  3006209: { crn: '9606209000', ...invalidMobileOnly },

  // Invalid phone only
  3006250: { crn: '9606250000', ...invalidPhoneOnly },
  3006251: { crn: '9606251000', ...invalidPhoneOnly },
  3006252: { crn: '9606252000', ...invalidPhoneOnly },
  3006253: { crn: '9606253000', ...invalidPhoneOnly },
  3006254: { crn: '9606254000', ...invalidPhoneOnly },
  3006255: { crn: '9606255000', ...invalidPhoneOnly },
  3006256: { crn: '9606256000', ...invalidPhoneOnly },
  3006257: { crn: '9606257000', ...invalidPhoneOnly },
  3006258: { crn: '9606258000', ...invalidPhoneOnly },
  3006259: { crn: '9606259000', ...invalidPhoneOnly },

  // Multiple fields invalid - Two or more invalid fields together

  // Two Fields Wrong (3007000-3007999) - Two invalid fields together
  // 3007000-3007099: DOB + email
  3007000: {
    // DOB + email - example 1
    crn: '9607000000',
    firstName: 'Two',
    lastName: 'Wrong',
    dateOfBirth: new Date('2030-01-01T00:00:00Z').getTime(),
    email: 'not-an-email'
  },
  // 3007100-3007199: DOB + phone
  3007100: {
    // DOB + phone - example 1
    crn: '9607100000',
    firstName: 'Two',
    lastName: 'Wrong',
    dateOfBirth: new Date('2031-06-15T00:00:00Z').getTime(),
    mobile: 'not-a-phone'
  },
  // 3007200-3007299: Address + email
  3007200: {
    // Address + email - example 1
    crn: '9607200000',
    firstName: 'Two',
    lastName: 'Wrong',
    address: { ...addressTooLongAddress },
    email: 'invalid@'
  },
  // 3007300-3007399: Address + phone
  3007300: {
    // Address + phone - example 1
    crn: '9607300000',
    firstName: 'Two',
    lastName: 'Wrong',
    address: { ...addressTooLongAddress },
    mobile: '123'
  },
  // 3007400-3007499: Email + phone
  3007400: {
    // Email + phone - example 1
    crn: '9607400000',
    firstName: 'Two',
    lastName: 'Wrong',
    email: 'bad-email',
    mobile: 'abc'
  },
  // 3007500-3007599: DOB + address
  3007500: {
    // DOB + address - example 1
    crn: '9607500000',
    firstName: 'Two',
    lastName: 'Wrong',
    dateOfBirth: new Date('2035-03-20T00:00:00Z').getTime(),
    address: { ...addressTooLongAddress }
  },
  // 3007600-3007699: DOB + email (different values)
  3007600: {
    // DOB + email (different values) - example 1
    crn: '9607600000',
    firstName: 'Two',
    lastName: 'Wrong',
    dateOfBirth: new Date('2029-12-31T00:00:00Z').getTime(),
    email: 'invalid email@example.com'
  },
  // 3007700-3007799: Address + phone (different fields)
  3007700: {
    // Address + phone (different fields) - example 1
    crn: '9607700000',
    firstName: 'Two',
    lastName: 'Wrong',
    address: { ...addressTooLongAddress },
    mobile: '!@#$%'
  },
  // 3007800-3007899: Email + phone (different formats)
  3007800: {
    // Email + phone (different formats) - example 1
    crn: '9607800000',
    firstName: 'Two',
    lastName: 'Wrong',
    email: 'invalid@@example.com',
    mobile: '12345'
  },
  // 3007900-3007999: DOB + address (different combinations)
  3007900: {
    // DOB + address (different combinations) - example 1
    crn: '9607900000',
    firstName: 'Two',
    lastName: 'Wrong',
    dateOfBirth: new Date('2040-01-01T00:00:00Z').getTime(),
    address: { ...addressTooLongAddress }
  },

  // Three+ Fields Wrong (3008000-3008999) - Three or more invalid fields
  // 3008000-3008099: DOB + email + phone
  3008000: {
    // DOB + email + phone - example 1
    crn: '9608000000',
    firstName: 'Three',
    lastName: 'Plus',
    dateOfBirth: new Date('2030-01-01T00:00:00Z').getTime(),
    email: 'not-an-email',
    mobile: 'not-a-phone'
  },
  // 3008100-3008199: DOB + email + address
  3008100: {
    // DOB + email + address - example 1
    crn: '9608100000',
    firstName: 'Three',
    lastName: 'Plus',
    dateOfBirth: new Date('2031-06-15T00:00:00Z').getTime(),
    email: 'invalid@',
    address: { ...addressTooLongAddress }
  },
  // 3008200-3008299: DOB + phone + address
  3008200: {
    // DOB + phone + address - example 1
    crn: '9608200000',
    firstName: 'Three',
    lastName: 'Plus',
    dateOfBirth: new Date('2035-03-20T00:00:00Z').getTime(),
    mobile: '123',
    address: { ...addressTooLongAddress }
  },
  // 3008300-3008399: Email + phone + address
  3008300: {
    // Email + phone + address - example 1
    crn: '9608300000',
    firstName: 'Three',
    lastName: 'Plus',
    email: 'bad-email',
    mobile: 'abc',
    address: { ...addressTooLongAddress }
  },
  // 3008400-3008499: DOB + email + phone + address
  3008400: {
    // DOB + email + phone + address - example 1
    crn: '9608400000',
    firstName: 'Three',
    lastName: 'Plus',
    dateOfBirth: new Date('2029-12-31T00:00:00Z').getTime(),
    email: 'invalid email@example.com',
    mobile: '!@#$%',
    address: { ...addressTooLongAddress }
  },
  // 3008500-3008599: DOB + email + phone (different values)
  3008500: {
    // DOB + email + phone (different values) - example 1
    crn: '9608500000',
    firstName: 'Three',
    lastName: 'Plus',
    dateOfBirth: new Date('2040-01-01T00:00:00Z').getTime(),
    email: 'invalid@@example.com',
    mobile: '12345'
  },
  // 3008600-3008699: DOB + email + address (different combinations)
  3008600: {
    // DOB + email + address (different combinations) - example 1
    crn: '9608600000',
    firstName: 'Three',
    lastName: 'Plus',
    dateOfBirth: new Date('2028-07-04T00:00:00Z').getTime(),
    email: 'bad@email',
    address: { ...addressTooLongAddress }
  },
  // 3008700-3008799: Email + phone + address (different fields)
  3008700: {
    // Email + phone + address (different fields) - example 1
    crn: '9608700000',
    firstName: 'Three',
    lastName: 'Plus',
    email: '',
    mobile: '',
    address: { ...addressTooLongAddress }
  },
  // 3008800-3008899: DOB + email + phone + address (different combinations)
  3008800: {
    // DOB + phone + address (different combinations) - example 1
    crn: '9608800000',
    firstName: 'Three',
    lastName: 'Plus',
    dateOfBirth: new Date('2032-11-11T00:00:00Z').getTime(),
    email: 'invalid@',
    mobile: 'abc123',
    address: { ...addressTooLongAddress }
  },
  // 3008900-3008999: All four fields (DOB + email + phone + address)
  3008900: {
    // All four fields: DOB + email + phone + address - example 1
    crn: '9608900000',
    firstName: 'Three',
    lastName: 'Plus',
    dateOfBirth: new Date('2027-05-15T00:00:00Z').getTime(),
    email: 'invalid@',
    mobile: 'not-a-phone',
    address: { ...addressTooLongAddress }
  },
  // 3010100-3010109: All five invalid: (name + DOB + email + phone + address)
  3010100: { crn: '9610000100', ...allInvalidPersonBase },
  3010101: { crn: '9610000101', ...allInvalidPersonBase },
  3010102: { crn: '9610000102', ...allInvalidPersonBase },
  3010103: { crn: '9610000103', ...allInvalidPersonBase },
  3010104: { crn: '9610000104', ...allInvalidPersonBase },
  3010105: { crn: '9610000105', ...allInvalidPersonBase },
  3010106: { crn: '9610000106', ...allInvalidPersonBase },
  3010107: { crn: '9610000107', ...allInvalidPersonBase },
  3010108: { crn: '9610000108', ...allInvalidPersonBase },
  3010109: { crn: '9610000109', ...allInvalidPersonBase },

  // Person stub for the Business details test user (CRN 9020000000 in defra-id.data.json; orgs 3009000–3009007 in business.js).
  3009100: {
    crn: '9620000000',
    firstName: 'Business',
    lastName: 'Details Test'
  },

  // Permission-level test users (View / Amend) for Business Details.
  // Privilege strings must match fcp-dal-api mapping.
  // VIEW (2): 3011010–3011011
  3011010: {
    crn: '9610001000',
    firstName: 'View Level Permission',
    lastName: 'Example 1',
    privileges: ['View - business']
  },
  3011011: {
    crn: '9610002000',
    firstName: 'View Level Permission',
    lastName: 'Example 2',
    privileges: ['View - business']
  },
  // AMEND all valid (5): 3011012–3011016
  3011012: {
    crn: '9610003000',
    firstName: 'Amend Level Permission',
    lastName: 'All Valid - example 1',
    privileges: ['Amend - business']
  },
  3011013: {
    crn: '9610004000',
    firstName: 'Amend Level Permission',
    lastName: 'All Valid - example 2',
    privileges: ['Amend - business']
  },
  3011014: {
    crn: '9610005000',
    firstName: 'Amend Level Permission',
    lastName: 'All Valid - example 3',
    privileges: ['Amend - business']
  },
  3011015: {
    crn: '9610006000',
    firstName: 'Amend Level Permission',
    lastName: 'All Valid - example 4',
    privileges: ['Amend - business']
  },
  3011016: {
    crn: '9610007000',
    firstName: 'Amend Level Permission',
    lastName: 'All Valid - example 5',
    privileges: ['Amend - business']
  },
  // AMEND one invalid (10): 3011017–3011026
  3011017: {
    crn: '9610008000',
    firstName: 'Amend Level Permission',
    lastName: 'One Invalid - example 1',
    privileges: ['Amend - business']
  },
  3011018: {
    crn: '9610009000',
    firstName: 'Amend Level Permission',
    lastName: 'One Invalid - example 2',
    privileges: ['Amend - business']
  },
  3011019: {
    crn: '9610010000',
    firstName: 'Amend Level Permission',
    lastName: 'One Invalid - example 3',
    privileges: ['Amend - business']
  },
  3011020: {
    crn: '9610011000',
    firstName: 'Amend Level Permission',
    lastName: 'One Invalid - example 4',
    privileges: ['Amend - business']
  },
  3011021: {
    crn: '9610012000',
    firstName: 'Amend Level Permission',
    lastName: 'One Invalid - example 5',
    privileges: ['Amend - business']
  },
  3011022: {
    crn: '9610013000',
    firstName: 'Amend Level Permission',
    lastName: 'One Invalid - example 6',
    privileges: ['Amend - business']
  },
  3011023: {
    crn: '9610014000',
    firstName: 'Amend Level Permission',
    lastName: 'One Invalid - example 7',
    privileges: ['Amend - business']
  },
  3011024: {
    crn: '9610015000',
    firstName: 'Amend Level Permission',
    lastName: 'One Invalid - example 8',
    privileges: ['Amend - business']
  },
  3011025: {
    crn: '9610016000',
    firstName: 'Amend Level Permission',
    lastName: 'One Invalid - example 9',
    privileges: ['Amend - business']
  },
  3011026: {
    crn: '9610017000',
    firstName: 'Amend Level Permission',
    lastName: 'One Invalid - example 10',
    privileges: ['Amend - business']
  },
  // AMEND two invalid (10): 3011000–3011009
  3011000: {
    crn: '9610018000',
    firstName: 'Amend Level Permission',
    lastName: 'Two Invalid - example 1',
    privileges: ['Amend - business']
  },
  3011001: {
    crn: '9610019000',
    firstName: 'Amend Level Permission',
    lastName: 'Two Invalid - example 2',
    privileges: ['Amend - business']
  },
  3011002: {
    crn: '9610020000',
    firstName: 'Amend Level Permission',
    lastName: 'Two Invalid - example 3',
    privileges: ['Amend - business']
  },
  3011003: {
    crn: '9610021000',
    firstName: 'Amend Level Permission',
    lastName: 'Two Invalid - example 4',
    privileges: ['Amend - business']
  },
  3011004: {
    crn: '9610022000',
    firstName: 'Amend Level Permission',
    lastName: 'Two Invalid - example 5',
    privileges: ['Amend - business']
  },
  3011005: {
    crn: '9610023000',
    firstName: 'Amend Level Permission',
    lastName: 'Two Invalid - example 6',
    privileges: ['Amend - business']
  },
  3011006: {
    crn: '9610024000',
    firstName: 'Amend Level Permission',
    lastName: 'Two Invalid - example 7',
    privileges: ['Amend - business']
  },
  3011007: {
    crn: '9610025000',
    firstName: 'Amend Level Permission',
    lastName: 'Two Invalid - example 8',
    privileges: ['Amend - business']
  },
  3011008: {
    crn: '9610026000',
    firstName: 'Amend Level Permission',
    lastName: 'Two Invalid - example 9',
    privileges: ['Amend - business']
  },
  3011009: {
    crn: '9610027000',
    firstName: 'Amend Level Permission',
    lastName: 'Two Invalid - example 10',
    privileges: ['Amend - business']
  }
}

/*
 * Without this merge, any entry that does not set `address` would get a
 * faker-generated address from the person factory, which is unpredictable and
 * can cause missing address lines or frontend validation failures. We want
 * every person to get the minimalMandatoryAddress instead.
 *
 * personLookupEntries lists only what each person overrides (crn, name,
 * phone, address when needed). We merge defaultPersonOverride (which sets
 * address: minimalMandatoryAddress) into each entry here. Entries that omit
 * address get the default; entries that set address (e.g. emptyAddress,
 * addressTooLongAddress) override it.
 */
export const sfdPersonLookup = Object.fromEntries(
  Object.entries(personLookupEntries).map(([id, entry]) => [
    id,
    {
      ...defaultPersonOverride,
      ...entry,
      address: {
        ...nullAddress,
        ...(entry.address ?? defaultPersonOverride.address)
      }
    }
  ])
)

// Person IDs that use the shared Test Org (3001458) in defra-id. Derived from sfdPersonLookup keys
// excluding 3009100 (Business Details Test) and permission-test users (3011000–3011026) who use
// business-details orgs only. When adding a test user with org 3001458 in defra-id, add their
// person ID to sfdPersonLookup; they appear here automatically.
const PERMISSION_TEST_PERSON_IDS = new Set([
  3011000, 3011001, 3011002, 3011003, 3011004, 3011005, 3011006, 3011007,
  3011008, 3011009, 3011010, 3011011, 3011012, 3011013, 3011014, 3011015,
  3011016, 3011017, 3011018, 3011019, 3011020, 3011021, 3011022, 3011023,
  3011024, 3011025, 3011026
])
export const SHARED_TEST_ORG_PERSON_IDS = Object.keys(sfdPersonLookup)
  .map(Number)
  .filter((id) => id !== 3009100 && !PERMISSION_TEST_PERSON_IDS.has(id))
  .sort((a, b) => a - b)
