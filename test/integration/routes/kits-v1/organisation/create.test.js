import Hapi from '@hapi/hapi'
import { emulateUpstreamErrors } from '../../../../../src/common/helpers/fail-action.js'
import { organisation } from '../../../../../src/routes/kits-v1/organisation.js'

// expected responses are what upstream (KITS upgrade) returned for the same kinds of request
describe('POST /organisation/create/{personId}', () => {
  const personId = '11111111'
  const body = {
    name: 'Contract Test Farm',
    businessType: { id: 101404 },
    legalStatus: { id: 102111 },
    taxRegistrationNumber: '123456789', // sfd-id-check: allow - tax registration number
    landline: '01632960020',
    email: 'contract.test@example.com',
    address: {
      address1: '1 Contract Test',
      city: 'TESTVILLE',
      postalCode: 'TE1 2ST',
      country: 'United Kingdom'
    }
  }
  let server

  const create = (payload, id = personId) =>
    server.inject({
      method: 'POST',
      url: `/organisation/create/${id}`,
      headers: { 'content-type': 'application/json' },
      payload
    })

  beforeAll(async () => {
    server = Hapi.server()
    server.route(organisation)
    server.ext('onPreResponse', emulateUpstreamErrors)
    await server.initialize()
  })

  it('should create and return the organisation', async () => {
    // arrange / act
    const { statusCode, payload } = await create(body)

    // assert
    expect(statusCode).toBe(200)
    const { _data } = JSON.parse(payload)
    expect(_data).toMatchObject({
      name: 'Contract Test Farm',
      businessType: { id: 101404 },
      legalStatus: { id: 102111 },
      confirmed: true,
      lastUpdatedOn: null,
      landConfirmed: null,
      emailValidated: false,
      correspondenceEmailValidated: false
    })
    expect(_data.id).toEqual(expect.any(Number))
    expect(_data.sbi).toEqual(expect.any(Number))
    expect(_data.businessReference).toMatch(/^\d{10}$/)
  })

  it.each([
    ['no tax registration number', { taxRegistrationNumber: undefined }, {}],
    [
      'no legal status, stored as null',
      { legalStatus: undefined },
      { legalStatus: null }
    ],
    [
      'an unknown business type, stored as Not Specified',
      { businessType: { id: 999999 } },
      { businessType: { id: 101443 } }
    ],
    [
      'a mobile but no landline',
      { landline: undefined, mobile: '07111222333' },
      {}
    ],
    ['a uprn only address', { address: { uprn: '910000000002' } }, {}],
    [
      'unknown fields and nulls',
      { unknown: 'x', id: null, businessReference: null },
      {}
    ]
  ])('should accept %s', async (_, changes, expected) => {
    // arrange / act
    const { statusCode, payload } = await create({ ...body, ...changes })

    // assert
    expect(statusCode).toBe(200)
    expect(JSON.parse(payload)._data).toMatchObject(expected)
  })

  it.each([
    [400, 'an id', { id: 1 }],
    [400, 'no name', { name: undefined }],
    [400, 'an empty name', { name: '' }],
    [400, 'a 161 character name', { name: 'x'.repeat(161) }],
    [400, 'no phone number', { landline: undefined }],
    [
      400,
      'a manual address without a city',
      { address: { ...body.address, city: undefined } }
    ],
    [400, 'a bad tax registration number', { taxRegistrationNumber: '123' }],
    [500, 'no business type', { businessType: undefined }],
    [500, 'no address', { address: undefined }],
    [
      500,
      'a 9 character postcode',
      { address: { ...body.address, postalCode: 'AA11 1AAA' } }
    ],
    [500, 'a malformed email', { email: 'notanemail' }]
  ])('should return %i for %s', async (code, _, changes) => {
    // arrange / act
    const { statusCode } = await create({ ...body, ...changes })

    // assert
    expect(statusCode).toBe(code)
  })

  it.each([
    [500, 'an empty body', ''],
    [500, 'an empty object', '{}'],
    [400, 'an array', '[]'],
    [400, 'a string', '"x"'],
    [400, 'malformed JSON', '{"a":']
  ])('should return %i for %s', async (code, _, payload) => {
    // arrange / act
    const { statusCode } = await create(payload)

    // assert
    expect(statusCode).toBe(code)
  })

  it.each([
    [403, 'a non-numeric id', 'abc'],
    [403, 'a negative id', '-1'],
    [403, 'a decimal id', '1.5'],
    [500, 'zero', '0'],
    [500, 'a 20 digit id', '99999999999999999999'],
    [500, 'an unknown id', '9999999999'],
    [200, 'an id with leading zeros', `00${personId}`]
  ])('should return %i for %s', async (code, _, id) => {
    // arrange / act
    const { statusCode } = await create(body, id)

    // assert
    expect(statusCode).toBe(code)
  })
})
