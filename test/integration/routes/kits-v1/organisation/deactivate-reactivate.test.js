import Hapi from '@hapi/hapi'
import { organisation } from '../../../../../src/routes/kits-v1/organisation.js'

describe('Organisation Deactivate/Reactivate', () => {
  let server
  beforeAll(async () => {
    server = Hapi.server()
    server.route(organisation)
    await server.initialize()
  })

  describe('Deactivate', () => {
    it('should deactivate an organisation if the organisation is in locked state', async () => {
      const organisationId = 9200000
      const { statusCode } = await server.inject({
        method: 'POST',
        url: `/organisation/${organisationId}/deactivate`,
        payload: {
          partyNoteType: 'DeactivateOrganisation',
          reason: 'Business Structure Changes'
        }
      })
      expect(statusCode).toBe(204)
    })
    it('should throw an error when deactivating an organisation if neither reason nor partyNoteType is provided', async () => {
      const organisationId = 100000000 // sfd-id-check: allow - organisation ID
      const { statusCode } = await server.inject({
        method: 'POST',
        url: `/organisation/${organisationId}/deactivate`,
        payload: {
          partyNoteType: 'DeactivateOrganisation',
          reason: '',
          note: ''
        }
      })
      expect(statusCode).toBe(400)
    })

    it('should accept a deactivate payload with a note and no reason', async () => {
      const organisationId = 100000000 // sfd-id-check: allow - organisation ID
      const { statusCode } = await server.inject({
        method: 'POST',
        url: `/organisation/${organisationId}/deactivate`,
        payload: {
          partyNoteType: 'DeactivateOrganisation',
          note: 'testing deactivation'
        }
      })
      // passes payload validation, then fails because the organisation is not locked
      expect(statusCode).toBe(500)
    })

    it('should throw an error when deactivating an organisation if organisationId is invalid', async () => {
      const organisationId = 'invalid-id'
      const { statusCode } = await server.inject({
        method: 'POST',
        url: `/organisation/${organisationId}/deactivate`,
        payload: {
          partyNoteType: 'DeactivateOrganisation',
          reason: 'a reason',
          note: ''
        }
      })
      expect(statusCode).toBe(403)
    })

    it('should throw an error when deactivating an organisation if the organisation is not in locked state', async () => {
      const organisationId = 100000000 // sfd-id-check: allow - organisation ID
      const { statusCode } = await server.inject({
        method: 'POST',
        url: `/organisation/${organisationId}/deactivate`,
        payload: {
          partyNoteType: 'DeactivateOrganisation',
          reason: 'Business Structure Changes'
        }
      })
      expect(statusCode).toBe(500)
    })
  })

  describe('Reactivate', () => {
    it('should reactivate an organisation if the organisation is locked and deactivated', async () => {
      // arrange
      const organisationId = 9200001

      // act
      const { statusCode } = await server.inject({
        method: 'POST',
        url: `/organisation/${organisationId}/reactivate`,
        payload: {
          partyNoteType: 'ReactivateOrganisation',
          reason: 'Business Structure Changes'
        }
      })
      const { result } = await server.inject({
        method: 'GET',
        url: `/organisation/${organisationId}`
      })

      // assert
      expect(statusCode).toBe(204)
      expect(result._data.deactivated).toBe(false)
      expect(result._data.locked).toBe(true)
    })

    it('should throw an error when reactivating an organisation that is not deactivated', async () => {
      // arrange
      const organisationId = 100000000 // sfd-id-check: allow - organisation ID

      // act
      const { statusCode } = await server.inject({
        method: 'POST',
        url: `/organisation/${organisationId}/reactivate`,
        payload: {
          partyNoteType: 'ReactivateOrganisation',
          note: 'testing reactivation'
        }
      })

      // assert
      expect(statusCode).toBe(500)
    })

    it('should throw an error when reactivating an organisation that does not exist', async () => {
      // arrange
      const organisationId = 999999999 // sfd-id-check: allow - organisation ID

      // act
      const { statusCode } = await server.inject({
        method: 'POST',
        url: `/organisation/${organisationId}/reactivate`,
        payload: {
          partyNoteType: 'ReactivateOrganisation',
          reason: 'Business Structure Changes'
        }
      })

      // assert
      expect(statusCode).toBe(500)
    })

    it('should throw an error when reactivating an organisation if neither reason nor note is provided', async () => {
      // arrange
      const organisationId = 100000000 // sfd-id-check: allow - organisation ID

      // act
      const { statusCode } = await server.inject({
        method: 'POST',
        url: `/organisation/${organisationId}/reactivate`,
        payload: {
          partyNoteType: 'ReactivateOrganisation',
          reason: '',
          note: ''
        }
      })

      // assert
      expect(statusCode).toBe(400)
    })

    it('should throw an error when reactivating an organisation with a different partyNoteType', async () => {
      // arrange
      const organisationId = 100000000 // sfd-id-check: allow - organisation ID

      // act
      const { statusCode } = await server.inject({
        method: 'POST',
        url: `/organisation/${organisationId}/reactivate`,
        payload: {
          partyNoteType: 'Generic',
          reason: 'Business Structure Changes',
          note: 'testing reactivation'
        }
      })

      // assert
      expect(statusCode).toBe(400)
    })
  })
})
