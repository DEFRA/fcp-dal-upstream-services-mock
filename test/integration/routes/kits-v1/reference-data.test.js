import Hapi from '@hapi/hapi'
import { referenceData } from '../../../../src/routes/kits-v1/reference-data.js'
import { loadSchema } from '../../../../src/utils/validatePayload.js'

describe('Reference Data routes', () => {
  let server, schema
  beforeAll(async () => {
    server = Hapi.server()
    server.route(referenceData)
    await Promise.all([
      server.initialize(),
      loadSchema('/routes/kits-v1/reference-data-schema.oas.yml').then(
        (s) => (schema = s)
      )
    ])
  })

  it.each([
    ['business types', '/reference/business-types'],
    ['legal status', '/reference/legalstatus'],
    ['titles', '/reference/titles']
  ])(
    'should GET %s reference data conforming to the schema',
    async (_description, url) => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url
      })
      expect(statusCode).toBe(200)
      expect(result).toConformToSchema(
        schema.paths[url].get.responses['200'].content['application/json']
          .schema
      )
    }
  )
})
