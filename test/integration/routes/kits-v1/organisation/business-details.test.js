import Hapi from '@hapi/hapi'
import { emulateUpstreamErrors } from '../../../../../src/common/helpers/fail-action.js'
import { orgIdLookup } from '../../../../../src/factories/id-lookups.js'
import { organisation } from '../../../../../src/routes/kits-v1/organisation.js'

// expected responses are what upstream (KITS upgrade) returned for the same kinds of request
describe('PUT /organisation/{organisationId}/business-details', () => {
  const organisationId = '8600001'
  let server
  let original

  const put = (payload, id = organisationId) =>
    server.inject({
      method: 'PUT',
      url: `/organisation/${id}/business-details`,
      headers: { 'content-type': 'application/json' },
      payload
    })
  const get = async (id = organisationId) => {
    const { payload } = await server.inject(`/organisation/${id}`)
    return JSON.parse(payload)._data
  }

  beforeAll(async () => {
    server = Hapi.server()
    server.route(organisation)
    server.ext('onPreResponse', emulateUpstreamErrors)
    await server.initialize()
    original = {
      ...(await get()),
      landline: '01632960020',
      taxRegistrationNumber: null
    }
  })
  beforeEach(() => put(original))

  it('should accept an organisation as returned by GET, with no response body', async () => {
    // arrange
    const before = await get()

    // act
    const { statusCode, payload } = await put(before)

    // assert
    expect(statusCode).toBe(204)
    expect(payload).toBe('')
    expect(await get()).toEqual(before)
  })

  it('should accept every organisation in the mock, other than deliberately invalid ones', async () => {
    // arrange
    const rejected = []
    // the sfd business-details orgs include over-long and malformed values
    const ids = Object.keys(orgIdLookup).filter((id) => !/^301\d{4}$/.test(id))

    // act
    for (const id of ids) {
      const { statusCode } = await put(await get(id), id)
      if (statusCode !== 204) rejected.push(id)
    }

    // assert
    expect(ids.length).toBeGreaterThan(0)
    expect(rejected).toEqual([])
  })

  it('should ignore fields that cannot be updated', async () => {
    // arrange
    const body = { ...original, id: 1, sbi: 2, unknown: 'x', name: 'New' }

    // act
    const { statusCode } = await put(body)

    // assert
    expect(statusCode).toBe(204)
    const after = await get()
    expect(after).toMatchObject({
      id: original.id,
      sbi: original.sbi,
      name: 'New'
    })
    expect(after).not.toHaveProperty('unknown')
  })

  it('should clear fields left out of the body', async () => {
    // arrange
    const { email, ...body } = original
    const { address1, city, ...address } = original.address

    // act
    await put({ ...body, address })

    // assert
    const after = await get()
    expect(after.email).toBeNull()
    expect(after.address).toEqual({
      ...original.address,
      address1: null,
      city: null
    })
  })

  it('should clear an address given as null', async () => {
    // arrange / act
    await put({ ...original, correspondenceAddress: null })

    // assert
    expect((await get()).correspondenceAddress).toBeNull()
  })

  it('should reset emailValidated when the email changes', async () => {
    // arrange
    const body = { ...original, email: 'a@example.com', emailValidated: true }

    // act
    await put(body)

    // assert
    expect(await get()).toMatchObject({
      email: 'a@example.com',
      emailValidated: false
    })
  })

  it('should store a numeric name as a string', async () => {
    // arrange / act
    const { statusCode } = await put({ ...original, name: 123 })

    // assert
    expect(statusCode).toBe(204)
    expect((await get()).name).toBe('123')
  })

  it.each([
    ['a tax registration number', { taxRegistrationNumber: '123456789' }], // sfd-id-check: allow - tax registration number
    ['a 160 character name', { name: 'x'.repeat(160) }],
    ['a mobile but no landline', { landline: null, mobile: '07111222333' }]
  ])('should accept %s', async (_, changes) => {
    // arrange / act
    const { statusCode } = await put({ ...original, ...changes })

    // assert
    expect(statusCode).toBe(204)
    expect(await get()).toMatchObject(changes)
  })

  it('should store an empty tax registration number as null', async () => {
    // arrange / act
    await put({ ...original, taxRegistrationNumber: '' })

    // assert
    expect((await get()).taxRegistrationNumber).toBeNull()
  })

  it.each([
    [400, 'no name', { name: undefined }],
    [400, 'an empty name', { name: '' }],
    [400, 'no phone number', { landline: null, mobile: null }],
    [400, 'a short VAT number', { taxRegistrationNumber: '12345678' }],
    [400, 'a long VAT number', { taxRegistrationNumber: '1234567890' }], // sfd-id-check: allow - tax registration number
    [400, 'a non-numeric VAT number', { taxRegistrationNumber: 'abcdefghi' }],
    [500, 'no businessType', { businessType: undefined }],
    [500, 'a 161 character name', { name: 'x'.repeat(161) }],
    [500, 'a malformed email', { email: 'notanemail' }],
    [500, 'a 255 character email', { email: `${'a'.repeat(243)}@example.com` }],
    [500, 'a 51 character landline', { landline: '1'.repeat(51) }],
    [
      500,
      'a 9 character postcode',
      { address: { city: 'TESTVILLE', postalCode: 'AA11 1AAA' } }
    ]
  ])('should return %i and change nothing for %s', async (code, _, changes) => {
    // arrange
    const before = await get()

    // act
    const { statusCode } = await put({ ...original, ...changes })

    // assert
    expect(statusCode).toBe(code)
    expect(await get()).toEqual(before)
  })

  it('should accept a body with only some of the fields', async () => {
    // arrange
    const body = {
      name: 'New',
      landline: '01632960020',
      businessType: { id: 101422 },
      address: { city: 'TESTVILLE' }
    }

    // act
    const { statusCode } = await put(body)

    // assert
    expect(statusCode).toBe(204)
    expect(await get()).toMatchObject({
      name: 'New',
      email: null,
      address: { address1: null, city: 'TESTVILLE' }
    })
  })

  it.each([
    [500, 'an empty body', ''],
    [500, 'an empty object', '{}'],
    [400, 'an empty array', '[]'],
    [400, 'a string', '"x"'],
    [400, 'malformed JSON', '{"a":']
  ])('should return %i for %s', async (code, _, body) => {
    // arrange / act
    const { statusCode } = await put(body)

    // assert
    expect(statusCode).toBe(code)
  })

  it.each([
    [403, 'a non-numeric id', 'abc'],
    [403, 'a negative id', '-1'],
    [403, 'a decimal id', '1.5'],
    [500, 'zero', '0'],
    [500, 'a 20 digit id', '99999999999999999999'],
    [500, 'an unknown id', '9999999']
  ])('should return %i for %s', async (code, _, id) => {
    // arrange / act
    const { statusCode } = await put(original, id)

    // assert
    expect(statusCode).toBe(code)
  })
})
