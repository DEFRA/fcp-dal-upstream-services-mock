import Hapi from '@hapi/hapi'
import { authenticate } from '../../../../../src/routes/kits-v1/authenticate-data.js'
import { loadSchema } from '../../../../../src/utils/validatePayload.js'

describe('Fake Authenticate data', () => {
  let server, schema
  beforeAll(async () => {
    server = Hapi.server()
    server.route(authenticate)
    await Promise.all([
      server.initialize(),
      loadSchema('/routes/kits-v1/authenticate-schema.oas.yml').then(
        (s) => (schema = s)
      )
    ])
  })

  it('should return 204 if person found with no authenticate data set', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/external-auth/security-answers/9111111400'
    })
    expect(statusCode).toBe(204)
  })

  it('should GET authenticate data conforming to the schema', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/external-auth/security-answers/9111111200'
    })
    expect(statusCode).toBe(200)
    expect(result.customerReference).toBe('9111111200')
    expect(result).toConformToSchema(
      schema.paths['/external-auth/security-answers/{crn}'].get.responses['200']
        .content['application/json'].schema
    )
  })

  describe('POST /external-auth/security-answers/{crn}', () => {
    it('should save security answers that are then returned by GET', async () => {
      const { statusCode } = await server.inject({
        method: 'POST',
        url: '/external-auth/security-answers/9111111400',
        payload: {
          date: '2020-01-01',
          event: 'Graduation',
          location: 'London',
          email: 'a@b.com'
        }
      })
      expect(statusCode).toBe(200)

      const { result } = await server.inject({
        method: 'GET',
        url: '/external-auth/security-answers/9111111400'
      })
      expect(result).toEqual({
        customerReference: '9111111400',
        memorableDate: '2020-01-01',
        memorableEvent: 'Graduation',
        memorableLocation: 'London',
        lastUpdatedOn: expect.any(String)
      })
      expect(result).toConformToSchema(
        schema.paths['/external-auth/security-answers/{crn}'].get.responses[
          '200'
        ].content['application/json'].schema
      )
    })

    it('should save null for omitted answers', async () => {
      await server.inject({
        method: 'POST',
        url: '/external-auth/security-answers/9111111300',
        payload: { date: '2021-02-02' }
      })

      const { result } = await server.inject({
        method: 'GET',
        url: '/external-auth/security-answers/9111111300'
      })
      expect(result).toMatchObject({
        memorableDate: '2021-02-02',
        memorableEvent: null,
        memorableLocation: null
      })
    })

    it('should not reject a payload with unknown fields', async () => {
      const { statusCode } = await server.inject({
        method: 'POST',
        url: '/external-auth/security-answers/9111111100',
        payload: { date: '2020-01-01', unknown: 'field' }
      })
      expect(statusCode).toBe(200)
    })

    it('should not reject an empty payload', async () => {
      const { statusCode } = await server.inject({
        method: 'POST',
        url: '/external-auth/security-answers/9111111100'
      })
      expect(statusCode).toBe(200)
    })

    it.each(['date', 'event', 'location'])(
      'should return 500 when %s is longer than 256 characters',
      async (field) => {
        const { statusCode } = await server.inject({
          method: 'POST',
          url: '/external-auth/security-answers/9111111100',
          payload: { [field]: 'a'.repeat(257) }
        })
        expect(statusCode).toBe(500)
      }
    )

    it('should save answers that are exactly 256 characters', async () => {
      const answer = 'a'.repeat(256)
      const { statusCode } = await server.inject({
        method: 'POST',
        url: '/external-auth/security-answers/9111111100',
        payload: { date: answer, event: answer, location: answer }
      })
      expect(statusCode).toBe(200)
    })

    it('should return 403 for an invalid CRN', async () => {
      const { statusCode } = await server.inject({
        method: 'POST',
        url: '/external-auth/security-answers/abc',
        payload: { date: '2020-01-01' }
      })
      expect(statusCode).toBe(403)
    })

    it('should return 404 for an unknown CRN', async () => {
      const { statusCode } = await server.inject({
        method: 'POST',
        url: '/external-auth/security-answers/9999999999',
        payload: { date: '2020-01-01' }
      })
      expect(statusCode).toBe(404)
    })
  })
})
