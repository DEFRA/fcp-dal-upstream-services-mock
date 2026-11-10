import Hapi from '@hapi/hapi'
import { personIdToDigitalContactPartyId } from '../../../../../src/factories/id-lookups.js'
import { emulateUpstreamErrors } from '../../../../../src/common/helpers/fail-action.js'
import { retrievePerson } from '../../../../../src/factories/person/person.factory.js'
import { emailValidation } from '../../../../../src/routes/kits-v1/email-validation.js'

const saveUrl = '/external-auth/email-validation'
const validateUrl = '/external-auth/email-validation/validate-email'

const notFoundBody = {
  servlet: 'jersey',
  message: 'Not Found',
  url: validateUrl,
  status: '404'
}

const validPayload = (overrides = {}) => ({
  customerReference: '9111111100',
  partyDigitalContactId: 123456,
  email: `${overrides.customerReference ?? '9111111100'}@example.com`,
  linkSentDate: new Date().toISOString(),
  ...overrides
})

let server

beforeAll(async () => {
  server = Hapi.server()
  server.route(emailValidation)
  server.ext('onPreResponse', emulateUpstreamErrors)
  await server.initialize()
})

afterAll(async () => {
  await server.stop()
})

describe('POST /external-auth/email-validation', () => {
  it('returns 200 when saving a new record', async () => {
    const { statusCode } = await server.inject({
      method: 'POST',
      url: saveUrl,
      payload: validPayload({ customerReference: '9222222201' })
    })
    expect(statusCode).toBe(200)
  })

  it('returns 200 when no customer exists for the customerReference', async () => {
    const { statusCode } = await server.inject({
      method: 'POST',
      url: saveUrl,
      payload: validPayload({ customerReference: '9898989800' })
    })
    expect(statusCode).toBe(200)
  })

  it('returns 200 when no digital contact exists for the partyDigitalContactId', async () => {
    const { statusCode } = await server.inject({
      method: 'POST',
      url: saveUrl,
      payload: validPayload({
        customerReference: '9818181800',
        partyDigitalContactId: 999999999 // sfd-id-check: allow - digital contact ID
      })
    })
    expect(statusCode).toBe(200)
  })

  it('returns 200 when the email does not match that of the partyDigitalContactId', async () => {
    // person 11111222 owns this digital contact, with a different email address
    const partyDigitalContactId = personIdToDigitalContactPartyId['11111222']
    expect(retrievePerson('11111222').email).not.toBe('mismatched@example.com')

    const { statusCode } = await server.inject({
      method: 'POST',
      url: saveUrl,
      payload: validPayload({
        customerReference: '9111122200',
        partyDigitalContactId,
        email: 'mismatched@example.com'
      })
    })
    expect(statusCode).toBe(200)
  })

  it('returns 200 when replacing an existing record for the same CRN', async () => {
    const payload = validPayload({ customerReference: '9333333300' })
    await server.inject({ method: 'POST', url: saveUrl, payload })

    const { statusCode } = await server.inject({
      method: 'POST',
      url: saveUrl,
      payload: { ...payload, email: 'someone-else@example.com' }
    })
    expect(statusCode).toBe(200)
  })

  it('returns 500 with a jersey error body when customerReference is missing', async () => {
    const { customerReference, ...payload } = validPayload({
      email: 'no-crn@example.com'
    })

    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: saveUrl,
      payload
    })
    expect(statusCode).toBe(500)
    expect(result).toEqual({
      servlet: 'jersey',
      message: 'Internal Server Error',
      url: saveUrl,
      status: '500'
    })
  })

  it.each(['partyDigitalContactId', 'email'])(
    'returns 500 with an unhandled error body when %s is missing',
    async (field) => {
      const { [field]: _omitted, ...payload } = validPayload({
        customerReference: '9616161600'
      })

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: saveUrl,
        payload
      })
      expect(statusCode).toBe(500)
      expect(result).toEqual({
        code: 500,
        message: expect.stringMatching(
          /^There was an error processing your request\. It has been logged \(ID [0-9a-f]{16}\)\.$/
        )
      })
    }
  )

  it('returns 200 when linkSentDate is missing', async () => {
    const { linkSentDate, ...payload } = validPayload({
      customerReference: '9717171700'
    })

    const { statusCode } = await server.inject({
      method: 'POST',
      url: saveUrl,
      payload
    })
    expect(statusCode).toBe(200)
  })

  it('returns 200 when the email is already saved for a different CRN', async () => {
    const payload = validPayload({
      customerReference: '9444444400',
      email: 'taken@example.com'
    })
    await server.inject({ method: 'POST', url: saveUrl, payload })

    const { statusCode } = await server.inject({
      method: 'POST',
      url: saveUrl,
      payload: { ...payload, customerReference: '9555555500' }
    })
    expect(statusCode).toBe(200)
  })
})

describe('POST /external-auth/email-validation/validate-email', () => {
  it('returns 404 when no record matches the partyDigitalContactId and email', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: validateUrl,
      payload: validPayload({ customerReference: '9666666600' })
    })
    expect(statusCode).toBe(404)
    expect(result).toEqual(notFoundBody)
  })

  it('returns 404 when the partyDigitalContactId does not match the saved record', async () => {
    const payload = validPayload({ customerReference: '9414141400' })
    await server.inject({ method: 'POST', url: saveUrl, payload })

    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: validateUrl,
      payload: { ...payload, partyDigitalContactId: 654321 }
    })
    expect(statusCode).toBe(404)
    expect(result).toEqual(notFoundBody)
  })

  it('ignores customerReference when matching, validating the saved record', async () => {
    // person 11111131 owns the record; the request names a different CRN
    const payload = validPayload({ customerReference: '9111113100' })
    await server.inject({ method: 'POST', url: saveUrl, payload })

    const { statusCode } = await server.inject({
      method: 'POST',
      url: validateUrl,
      payload: { ...payload, customerReference: '9515151500' }
    })
    expect(statusCode).toBe(200)

    const second = await server.inject({
      method: 'POST',
      url: validateUrl,
      payload
    })
    expect(second.statusCode).toBe(404)
  })

  it('returns 200 when the record matches and the link has not expired', async () => {
    const payload = validPayload({ customerReference: '9777777700' })
    await server.inject({ method: 'POST', url: saveUrl, payload })

    const { statusCode } = await server.inject({
      method: 'POST',
      url: validateUrl,
      payload
    })
    expect(statusCode).toBe(200)
  })

  it('marks the person email as validated when validation record has not expired', async () => {
    // person 11111121 has a static emailValidated: false
    const payload = validPayload({ customerReference: '9111112100' })
    await server.inject({ method: 'POST', url: saveUrl, payload })
    expect(retrievePerson('11111121').emailValidated).toBe(false)

    const { statusCode } = await server.inject({
      method: 'POST',
      url: validateUrl,
      payload
    })
    expect(statusCode).toBe(200)
    expect(retrievePerson('11111121').emailValidated).toBe(true)
  })

  it('updates the person email address to the validated email when it differs', async () => {
    const payload = validPayload({
      customerReference: '9111112200',
      email: 'new-address@example.com'
    })
    await server.inject({ method: 'POST', url: saveUrl, payload })
    expect(retrievePerson('11111122').email).not.toBe('new-address@example.com')

    const { statusCode } = await server.inject({
      method: 'POST',
      url: validateUrl,
      payload
    })
    expect(statusCode).toBe(200)
    expect(retrievePerson('11111122').email).toBe('new-address@example.com')
    expect(retrievePerson('11111122').emailValidated).toBe(true)
  })

  it('deletes the record once validated, so it cannot be validated again', async () => {
    const payload = validPayload({ customerReference: '9010101000' })
    await server.inject({ method: 'POST', url: saveUrl, payload })

    const first = await server.inject({
      method: 'POST',
      url: validateUrl,
      payload
    })
    expect(first.statusCode).toBe(200)

    const second = await server.inject({
      method: 'POST',
      url: validateUrl,
      payload
    })
    expect(second.statusCode).toBe(404)
  })

  it('returns 401 when the link has expired', async () => {
    const payload = validPayload({
      customerReference: '9888888800',
      linkSentDate: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    })
    await server.inject({ method: 'POST', url: saveUrl, payload })

    const { statusCode } = await server.inject({
      method: 'POST',
      url: validateUrl,
      payload
    })
    expect(statusCode).toBe(401)
  })

  it('returns 404 when the email does not match the saved record', async () => {
    const payload = validPayload({ customerReference: '9999999900' })
    await server.inject({ method: 'POST', url: saveUrl, payload })

    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: validateUrl,
      payload: { ...payload, email: 'wrong@example.com' }
    })
    expect(statusCode).toBe(404)
    expect(result).toEqual(notFoundBody)
  })
})
