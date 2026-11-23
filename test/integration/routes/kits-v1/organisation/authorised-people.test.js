import Hapi from '@hapi/hapi'
import { emulateUpstreamErrors } from '../../../../../src/common/helpers/fail-action.js'
import { organisation } from '../../../../../src/routes/kits-v1/organisation.js'

// expected responses are what upstream (KITS upgrade) returned for the same kinds of organisationId
describe('GET /authorisation/organisation/{organisationId}', () => {
  let server
  beforeAll(async () => {
    server = Hapi.server()
    server.route(organisation)
    server.ext('onPreResponse', emulateUpstreamErrors)
    await server.initialize()
  })

  it('lists the people authorised on an organisation', async () => {
    // arrange
    const organisationId = '111111111' // sfd-id-check: allow - organisation ID

    // act
    const { statusCode, payload } = await server.inject({
      method: 'GET',
      url: `/authorisation/organisation/${organisationId}`
    })

    // assert
    expect(statusCode).toBe(200)
    const { _data } = JSON.parse(payload)
    expect(_data.length).toBeGreaterThan(0)
    expect(Object.keys(_data[0]).sort()).toEqual([
      'confirmed',
      'customerReference',
      'firstName',
      'id',
      'lastName',
      'lastUpdatedOn',
      'privileges',
      'role'
    ])
  })

  it('ignores leading zeros on the organisationId', async () => {
    // arrange
    const organisationId = '111111111' // sfd-id-check: allow - organisation ID
    const plain = await server.inject({
      method: 'GET',
      url: `/authorisation/organisation/${organisationId}`
    })

    // act
    const padded = await server.inject({
      method: 'GET',
      url: `/authorisation/organisation/000${organisationId}`
    })

    // assert
    expect(padded.statusCode).toBe(200)
    expect(padded.payload).toEqual(plain.payload)
  })

  it.each([
    ['an unknown organisationId', '999999999'], // sfd-id-check: allow - organisation ID
    ['zero', '0'],
    ['the largest 20 digit value', '99999999999999999999']
  ])('returns not found for %s', async (_, organisationId) => {
    // arrange / act
    const { statusCode, payload } = await server.inject({
      method: 'GET',
      url: `/authorisation/organisation/${organisationId}`
    })

    // assert
    expect(statusCode).toBe(404)
    expect(JSON.parse(payload)).toEqual({
      code: 404,
      message: 'HTTP 404 Not Found'
    })
  })

  it.each([
    ['letters', 'abc'],
    ['a negative number', '-1'],
    ['a decimal', '1.5'],
    ['a plus sign', '+1'],
    ['21 digits', '123456789012345678901'],
    ['trailing letters', '111111111x']
  ])(
    'blocks %s as forbidden, like the upstream WAF',
    async (_, organisationId) => {
      // arrange / act
      const { statusCode, payload } = await server.inject({
        method: 'GET',
        url: `/authorisation/organisation/${encodeURIComponent(organisationId)}`
      })

      // assert
      expect(statusCode).toBe(403)
      expect(payload).toContain('403 Forbidden')
    }
  )
})
