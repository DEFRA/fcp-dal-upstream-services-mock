import Hapi from '@hapi/hapi'
import { emulateUpstreamErrors } from '../../../../../src/common/helpers/fail-action.js'
import { organisation } from '../../../../../src/routes/kits-v1/organisation.js'

// expected responses are what upstream (KITS upgrade) returned for the same kinds of request
describe('PUT /organisation/{organisationId}/additional-business-details', () => {
  const organisationId = '8600001'
  const body = {
    businessType: { id: 101404 },
    legalStatus: { id: 102108 },
    companiesHouseRegistrationNumber: 'AB123456',
    charityCommissionRegistrationNumber: 'CC12345678',
    dateStartedFarming: '2020-01-31'
  }
  let server

  const put = (payload, id = organisationId) =>
    server.inject({
      method: 'PUT',
      url: `/organisation/${id}/additional-business-details`,
      headers: { 'content-type': 'application/json' },
      payload
    })
  const get = async () => {
    const { payload } = await server.inject(`/organisation/${organisationId}`)
    return JSON.parse(payload)._data
  }

  beforeAll(async () => {
    server = Hapi.server()
    server.route(organisation)
    server.ext('onPreResponse', emulateUpstreamErrors)
    await server.initialize()
  })
  beforeEach(() => put(body))

  it('should update the additional details, with no response body', async () => {
    // arrange
    const before = await get()

    // act
    const { statusCode, payload } = await put(body)

    // assert
    expect(statusCode).toBe(204)
    expect(payload).toBe('')
    expect(await get()).toEqual({
      ...before,
      businessType: { id: 101404, type: 'Set from reference data' },
      legalStatus: { id: 102108, type: 'Set from reference data' },
      companiesHouseRegistrationNumber: 'AB123456',
      charityCommissionRegistrationNumber: 'CC12345678',
      dateStartedFarming: new Date('2020-01-31T00:00:00Z').getTime()
    })
  })

  it('should accept an organisation as returned by GET', async () => {
    // arrange
    const before = await get()

    // act
    const { statusCode } = await put({ ...before, unknown: 'x' })

    // assert
    expect(statusCode).toBe(204)
    expect(await get()).toEqual(before)
  })

  it.each([
    ['left out', undefined],
    ['null', null]
  ])('should clear the numbers and date when %s', async (_, value) => {
    // arrange
    const cleared = {
      ...body,
      companiesHouseRegistrationNumber: value,
      charityCommissionRegistrationNumber: value,
      dateStartedFarming: value
    }

    // act
    const { statusCode } = await put(cleared)

    // assert
    expect(statusCode).toBe(204)
    expect(await get()).toMatchObject({
      companiesHouseRegistrationNumber: null,
      charityCommissionRegistrationNumber: null,
      dateStartedFarming: null
    })
  })

  it('should clear a registration number when empty', async () => {
    // arrange / act
    const { statusCode } = await put({
      ...body,
      companiesHouseRegistrationNumber: ''
    })

    // assert
    expect(statusCode).toBe(204)
    expect((await get()).companiesHouseRegistrationNumber).toBeNull()
  })

  it.each([
    [
      'a numeric registration number',
      { companiesHouseRegistrationNumber: 12345678 },
      { companiesHouseRegistrationNumber: '12345678' }
    ],
    [
      'a string reference id',
      { legalStatus: { id: '102111' } },
      { legalStatus: { id: 102111 } }
    ],
    [
      'a date-time with an offset',
      { dateStartedFarming: '2020-01-31T10:00:00+01:00' },
      { dateStartedFarming: Date.UTC(2020, 0, 31, 9) }
    ],
    [
      'a date as epoch milliseconds, kept to the second',
      { dateStartedFarming: 1580428801500 },
      { dateStartedFarming: 1580428801000 }
    ],
    [
      'a date before 1970',
      { dateStartedFarming: -1 },
      { dateStartedFarming: -1000 }
    ]
  ])('should accept %s', async (_, changes, expected) => {
    // arrange / act
    const { statusCode } = await put({ ...body, ...changes })

    // assert
    expect(statusCode).toBe(204)
    expect(await get()).toMatchObject(expected)
  })

  it.each([
    [400, 'no business type', { businessType: undefined }],
    [400, 'no legal status', { legalStatus: undefined }],
    [400, 'a null business type', { businessType: null }],
    [400, 'a business type with no id', { businessType: {} }],
    [400, 'a date that is not a date', { dateStartedFarming: 'notadate' }],
    [400, 'a boolean date', { dateStartedFarming: true }],
    [500, 'an unknown business type id', { businessType: { id: 999999 } }],
    [500, 'an unknown legal status id', { legalStatus: { id: 999999 } }],
    [
      500,
      'a legal status id as the business type',
      { businessType: { id: 102108 } }
    ],
    [
      500,
      'a 9 character Companies House number',
      { companiesHouseRegistrationNumber: 'AB1234567' }
    ],
    [
      500,
      'an 11 character Charity Commission number',
      { charityCommissionRegistrationNumber: '12345678901' }
    ]
  ])('should return %i and change nothing for %s', async (code, _, changes) => {
    // arrange
    const before = await get()

    // act
    const { statusCode } = await put({ ...body, ...changes })

    // assert
    expect(statusCode).toBe(code)
    expect(await get()).toEqual(before)
  })

  it.each([
    ['an empty body', ''],
    ['an empty object', '{}'],
    ['an array', '[]'],
    ['a string', '"x"'],
    ['malformed JSON', '{"a":']
  ])('should return 400 for %s', async (_, payload) => {
    // arrange / act
    const { statusCode } = await put(payload)

    // assert
    expect(statusCode).toBe(400)
  })

  it.each([
    [403, 'a non-numeric id', 'abc'],
    [403, 'a negative id', '-1'],
    [403, 'a decimal id', '1.5'],
    [500, 'zero', '0'],
    [500, 'a 20 digit id', '99999999999999999999'],
    [500, 'an unknown id', '9999999'],
    [204, 'an id with leading zeros', `00${organisationId}`]
  ])('should return %i for %s', async (code, _, id) => {
    // arrange / act
    const { statusCode } = await put(body, id)

    // assert
    expect(statusCode).toBe(code)
  })
})
