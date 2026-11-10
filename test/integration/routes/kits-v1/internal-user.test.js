import Hapi from '@hapi/hapi'
import {
  KNOWN_INTERNAL_FUNCTIONS,
  retrieveInternalAuthorisationByFunction
} from '../../../../src/factories/siti-agri/permissions.factory.js'
import { internalUser } from '../../../../src/routes/kits-v1/internal-user.js'
import { loadSchema } from '../../../../src/utils/validatePayload.js'

const schemaPath = '/SitiAgriApi/authorisation/byFunction'

describe('Internal user routes', () => {
  let server, schema
  beforeAll(async () => {
    server = Hapi.server()
    server.route(internalUser)
    await Promise.all([
      server.initialize(),
      loadSchema('routes/kits-v1/internal-user-schema.oas.yml').then(
        (s) => (schema = s)
      )
    ])
  })

  describe('POST /authorisation/user', () => {
    const postEmail = (payload, headers = {}) =>
      server.inject({
        method: 'POST',
        url: '/authorisation/user',
        payload,
        headers
      })

    it("returns a known person's id as a plain-text integer", async () => {
      const response = await postEmail('skeleton@the-closet.net')

      expect(response.statusCode).toBe(200)
      expect(response.headers['content-type']).toContain('text/plain')
      expect(response.payload).toBe('11111119')
    })

    it('matches the email case-insensitively, like the upstream', async () => {
      const response = await postEmail('SKELETON@THE-CLOSET.NET')
      expect(response.payload).toBe('11111119')
    })

    it('ignores the request Content-Type and treats the body as the raw email, like the upstream', async () => {
      const raw = await postEmail('skeleton@the-closet.net', {
        'content-type': 'application/json'
      })
      expect(raw.payload).toBe('11111119')

      const quoted = await postEmail('"skeleton@the-closet.net"')
      expect(quoted.payload).toBe('0')
    })

    it('fabricates a stable personId for an unknown internal (Defra) user', async () => {
      const [first, second, other] = await Promise.all([
        postEmail('testuser01@defra.gov.uk'),
        postEmail('testuser01@defra.gov.uk'),
        postEmail('testuser02@defra.gov.uk')
      ])

      expect(first.payload).toMatch(/^[1-9]\d*$/)
      expect(second.payload).toBe(first.payload)
      expect(other.payload).not.toBe(first.payload)
    })

    it("returns 0 for a known person whose email is not validated, like /person/{email}/validateEmail's behavior", async () => {
      const response = await postEmail('unvalidated@the-closet.net')

      expect(response.statusCode).toBe(200)
      expect(response.payload).toBe('0')
    })

    it('returns 0 for an unknown non-Defra email, like the upstream', async () => {
      const response = await postEmail('no-such-user@example.com')

      expect(response.statusCode).toBe(200)
      expect(response.payload).toBe('0')
    })

    it('returns 0 for an empty or missing body, like the upstream', async () => {
      const empty = await postEmail('')
      expect(empty.statusCode).toBe(200)
      expect(empty.payload).toBe('0')

      const missing = await server.inject({
        method: 'POST',
        url: '/authorisation/user'
      })
      expect(missing.statusCode).toBe(200)
      expect(missing.payload).toBe('0')
    })
  })

  describe('GET /SitiAgriApi/authorisation/byFunction', () => {
    const email = 'testuser01@defra.gov.uk'
    const query =
      'functions=viewLand|caseManagement|createNewCustomer&module=CUST_SS_PORTAL&timestamp=1720000000000'
    const getByFunction = (query, headers = { email }) =>
      server.inject({
        method: 'GET',
        url: `/SitiAgriApi/authorisation/byFunction?${query}`,
        headers
      })

    it('returns the requested functions mapped to booleans, wrapped in the standard envelope', async () => {
      const response = await getByFunction(query)

      expect(response.statusCode).toBe(200)
      const json = JSON.parse(response.payload)

      expect(json.success).toBe(true)
      expect(json.errorString).toBeNull()
      expect(json.data).toEqual(
        retrieveInternalAuthorisationByFunction(email, [
          'viewLand',
          'caseManagement',
          'createNewCustomer'
        ])
      )
    })

    it('conforms to the response schema', async () => {
      const { result, statusCode } = await getByFunction(query)

      expect(statusCode).toBe(200)
      expect(result).toConformToSchema(
        schema.paths[schemaPath].get.responses['200'].content[
          'application/json'
        ].schema
      )
    })

    it('keys the results on the authenticated internal user (the email header)', async () => {
      const functions = encodeURIComponent(KNOWN_INTERNAL_FUNCTIONS.join('|'))
      const [first, second] = await Promise.all([
        getByFunction(`functions=${functions}&module=CUST_SS_PORTAL`, {
          email
        }),
        getByFunction(`functions=${functions}&module=CUST_SS_PORTAL`, {
          email: 'testuser02@defra.gov.uk'
        })
      ])

      expect(JSON.parse(second.payload)).not.toEqual(JSON.parse(first.payload))
    })

    it('still responds when the email header is missing (the real gateway rejects these with a 403)', async () => {
      const response = await getByFunction(
        'functions=viewLand&module=CUST_SS_PORTAL',
        {}
      )

      expect(response.statusCode).toBe(200)
      expect(typeof JSON.parse(response.payload).data.viewLand).toBe('boolean')
    })

    it('returns the error envelope as a 500 when functions is missing, like the upstream', async () => {
      const response = await getByFunction(
        'module=CUST_SS_PORTAL&timestamp=1720000000000'
      )

      expect(response.statusCode).toBe(500)
      expect(JSON.parse(response.payload)).toEqual({
        data: null,
        success: false,
        errorString: 'An error has occurred.'
      })
    })

    it('returns the error envelope as a 500 when module is missing, like the upstream', async () => {
      const response = await getByFunction(
        'functions=viewLand&timestamp=1720000000000'
      )

      expect(response.statusCode).toBe(500)
      expect(JSON.parse(response.payload)).toEqual({
        data: null,
        success: false,
        errorString: 'An error has occurred.'
      })
    })

    it('returns false for every function when the module is unrecognised, like the upstream', async () => {
      const response = await getByFunction(
        'functions=viewLand|viewCPH&module=NOPE'
      )

      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.payload).data).toEqual({
        viewLand: false,
        viewCPH: false
      })
    })

    it('matches the module case-insensitively, like the upstream', async () => {
      const [upper, lower] = await Promise.all(
        ['CUST_SS_PORTAL', 'cust_ss_portal'].map((module) =>
          getByFunction(`functions=viewLand&module=${module}`)
        )
      )

      expect(lower.statusCode).toBe(200)
      expect(JSON.parse(lower.payload)).toEqual(JSON.parse(upper.payload))
    })

    it('echoes an empty functions list back as a single empty-named flag, like the upstream', async () => {
      const response = await getByFunction('functions=&module=CUST_SS_PORTAL')

      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.payload).data).toEqual({ '': false })
    })
  })
})
