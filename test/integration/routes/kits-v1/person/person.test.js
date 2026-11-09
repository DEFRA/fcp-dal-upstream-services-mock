import Hapi from '@hapi/hapi'
import { config } from '../../../../../src/config.js'
import { crnToPersonId } from '../../../../../src/factories/id-lookups.js'
import { person } from '../../../../../src/routes/kits-v1/person.js'
import { loadSchema } from '../../../../../src/utils/validatePayload.js'

describe('Person routes', () => {
  let server, schema
  beforeAll(async () => {
    server = Hapi.server()
    server.route(person)
    await Promise.all([
      server.initialize(),
      loadSchema('/routes/kits-v1/person-schema.oas.yml').then(
        (s) => (schema = s)
      )
    ])
  })

  describe('GET /person/{email}/validateEmail', () => {
    it('should report a known email as duplicated, conforming to the schema', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/person/skeleton@the-closet.net/validateEmail'
      })
      expect(statusCode).toBe(200)
      expect(result).toEqual({ _data: { emailDuplicated: true } })
      expect(result).toConformToSchema(
        schema.paths['/person/{email}/validateEmail'].get.responses['200']
          .content['application/json'].schema
      )
    })

    it('should report an unknown email as not duplicated', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/person/nobody-with-this-address@example.com/validateEmail'
      })
      expect(statusCode).toBe(200)
      expect(result).toEqual({ _data: { emailDuplicated: false } })
    })

    it('should be case-insensitive when matching emails', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/person/SKELETON@THE-CLOSET.NET/validateEmail'
      })
      expect(statusCode).toBe(200)
      expect(result).toEqual({ _data: { emailDuplicated: true } })
    })

    it('should URL-decode the email path parameter', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/person/${encodeURIComponent('skeleton@the-closet.net')}/validateEmail`
      })
      expect(statusCode).toBe(200)
      expect(result).toEqual({ _data: { emailDuplicated: true } })
    })

    it('should not error when static fixtures have a null email', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/person/3010085@example.com/validateEmail'
      })
      expect(statusCode).toBe(200)
      expect(result).toEqual({ _data: { emailDuplicated: false } })
    })

    it('should not report a duplicate when the matching person has not validated their email', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/person/unvalidated@the-closet.net/validateEmail'
      })
      expect(statusCode).toBe(200)
      expect(result).toEqual({ _data: { emailDuplicated: false } })
    })
  })

  describe('GET /person/{personId}/{email}/confirm', () => {
    it('should return 409 when the email is already verified', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/person/11111119/skeleton@the-closet.net/confirm'
      })
      expect(statusCode).toBe(409)
      expect(result.message).toBe('HTTP 409 Conflict')
      expect(result).toConformToSchema(
        schema.paths['/person/{personId}/{email}/confirm'].get.responses['409']
          .content['application/json'].schema
      )
    })

    it('should return 409 when the email is already verified, regardless of case', async () => {
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/person/11111119/SKELETON@the-closet.NET/confirm'
      })
      expect(statusCode).toBe(409)
    })

    it('should return 409 when the email is verified by another person, regardless of case', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/person/11111121/SKELETON@the-closet.net/confirm'
      })
      expect(statusCode).toBe(409)
      expect(result.message).toBe('HTTP 409 Conflict')
      expect(result).toConformToSchema(
        schema.paths['/person/{personId}/{email}/confirm'].get.responses['409']
          .content['application/json'].schema
      )
    })

    it('should not update the person record, and should not report the email as validated when the person has not validated their email', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/person/11111121/unvalidated@the-closet.net/confirm'
      })
      expect(statusCode).toBe(200)
      expect(result._data.validated).toBe(false)

      const { result: summaryResult } = await server.inject({
        method: 'GET',
        url: '/person/11111121/summary'
      })
      expect(summaryResult._data.emailValidated).toBe(false)
    })

    it('should return the party digital contact for the person, conforming to the schema', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/person/11111121/unvalidated@the-closet.net/confirm'
      })
      expect(statusCode).toBe(200)
      expect(result._data).toEqual({
        id: expect.any(Number),
        partyId: 11111121,
        mdmPartyContactId: null,
        digitalContactType: { id: 100301, type: 'Email Address' },
        digitalAddress: 'unvalidated@the-closet.net',
        validated: false
      })
      expect(result).toConformToSchema(
        schema.paths['/person/{personId}/{email}/confirm'].get.responses['200']
          .content['application/json'].schema
      )
    })

    it("should echo back the requested email, but report the person's existing email validation status", async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/person/11111119/someone-else@example.com/confirm'
      })
      expect(statusCode).toBe(200)
      expect(result._data.validated).toBe(true)
      expect(result._data.digitalAddress).toBe('someone-else@example.com')
    })

    it('should report the existing email as not validated when confirming a different email for an unvalidated person', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/person/11111121/someone-else@example.com/confirm'
      })
      expect(statusCode).toBe(200)
      expect(result._data.validated).toBe(false)
      expect(result._data.digitalAddress).toBe('someone-else@example.com')
    })

    it('should return 404 when the person does not have any email assigned', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/person/3010085/someone@example.com/confirm'
      })
      expect(statusCode).toBe(404)
      expect(result.message).toBe('Not Found')
    })

    it('should return 403 for an invalid personId', async () => {
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/person/not-a-number/someone@example.com/confirm'
      })
      expect(statusCode).toBe(403)
    })
  })

  describe('POST /verify-email/{digitalContactPartyId}', () => {
    const getDigitalContactPartyId = async (personId, email) => {
      const { result } = await server.inject({
        method: 'GET',
        url: `/person/${personId}/${email}/confirm`
      })
      return result._data.id
    }

    it('should return a 200 for a known digitalContactPartyId, conforming to the schema', async () => {
      const digitalContactPartyId = await getDigitalContactPartyId(
        11111121,
        'unvalidated@the-closet.net'
      )

      const { result, statusCode } = await server.inject({
        method: 'POST',
        url: `/verify-email/${digitalContactPartyId}`,
        headers: { 'content-type': 'text/plain' },
        payload: 'unvalidated@the-closet.net'
      })
      expect(statusCode).toBe(200)
      expect(result).toEqual({ _data: 'Success' })
      expect(result).toConformToSchema(
        schema.paths['/verify-email/{digitalContactPartyId}'].post.responses[
          '200'
        ].content['application/json'].schema
      )
    })

    it('should return 200 for a well-formed but unknown digitalContactPartyId', async () => {
      const { statusCode } = await server.inject({
        method: 'POST',
        url: '/verify-email/999999999', // sfd-id-check: allow - digital contact ID
        headers: { 'content-type': 'text/plain' },
        payload: 'unknown@example.com'
      })
      expect(statusCode).toBe(200)
    })

    it.each([
      ['no body', undefined],
      ['an empty body', '']
    ])(
      'should return 500 when the request has %s',
      async (_description, payload) => {
        const digitalContactPartyId = await getDigitalContactPartyId(
          11111121,
          'unvalidated@the-closet.net'
        )

        const { result, statusCode } = await server.inject({
          method: 'POST',
          url: `/verify-email/${digitalContactPartyId}`,
          headers: { 'content-type': 'text/plain' },
          payload
        })
        expect(statusCode).toBe(500)
        expect(result).toEqual({
          code: 500,
          message: 'HTTP 500 Internal Server Error'
        })
        expect(result).toConformToSchema(
          schema.paths['/verify-email/{digitalContactPartyId}'].post.responses[
            '500'
          ].content['application/json'].schema
        )
      }
    )

    it('should return 403 for an invalid digitalContactPartyId', async () => {
      const { statusCode } = await server.inject({
        method: 'POST',
        url: '/verify-email/not-a-number'
      })
      expect(statusCode).toBe(403)
    })
  })

  it('should GET a person conforming to the schema', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/person/11111111/summary'
    })
    expect(statusCode).toBe(200)
    expect(result).toConformToSchema(
      schema.paths['/person/{personId}/summary'].get.responses['200'].content[
        'application/json'
      ].schema
    )
  })

  it('should respond with a person conforming to schema when searches POST-ed', async () => {
    const { result, statusCode } = await server.inject({
      method: 'POST',
      url: '/person/search',
      payload: {
        searchFieldType: 'CUSTOMER_REFERENCE',
        primarySearchPhrase: '9111111100'
      }
    })
    expect(statusCode).toBe(200)
    expect(result).toConformToSchema(
      schema.paths['/person/search'].post.responses['200'].content[
        'application/json'
      ].schema
    )
  })

  it('should fetch the same person with ID or CRN', async () => {
    const id = 11111111
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: `/person/${id}/summary`
    })
    expect(statusCode).toBe(200)
    expect(result._data.id).toBe(id)
    const {
      firstName,
      lastName,
      address,
      personalIdentifiers,
      customerReferenceNumber,
      email,
      locked,
      deactivated
    } = result._data

    const res2 = await server.inject({
      headers: {
        'content-type': 'application/json'
      },
      method: 'POST',
      url: '/person/search',
      payload: {
        searchFieldType: 'CUSTOMER_REFERENCE',
        primarySearchPhrase: customerReferenceNumber
      }
    })
    expect(res2.statusCode).toBe(200)
    expect(res2.result._data.length).toBe(1)
    const samePerson = res2.result._data[0]
    expect(samePerson).toEqual({
      id,
      fullName: `${firstName} ${lastName}`,
      primaryAddress: address,
      personalIdentifiers: personalIdentifiers,
      nationalInsuranceNumber: null,
      customerReference: customerReferenceNumber,
      email: email,
      locked: locked,
      deactivated: deactivated
    })
  })

  test("should return data for about the specified user's associated organisations", async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/organisation/person/11111222/summary'
    })
    expect(statusCode).toBe(200)
    expect(result._data).toHaveLength(2)
    expect(result._data).toEqual(
      // snippets only, to indicate the 2 organisations this user belongs to
      expect.arrayContaining([
        expect.objectContaining({
          id: 111111111, // sfd-id-check: allow - organisation ID
          sbi: 811111111
        }),
        expect.objectContaining({
          id: 222222222, // sfd-id-check: allow - organisation ID
          sbi: 822222222
        })
      ])
    )
  })

  describe('POST /person/check/duplicates', () => {
    const checkDuplicates = (payload) =>
      server.inject({
        method: 'POST',
        url: '/person/check/duplicates',
        payload
      })

    const responseSchema = () =>
      schema.paths['/person/check/duplicates'].post.responses['200'].content[
        'application/json'
      ].schema

    // a person created here, as the static fixtures may be deactivated
    const dupe = {
      firstName: 'Dupe',
      lastName: 'Check',
      dateOfBirth: 1065270380449,
      landline: '01215 090627',
      mobile: null
    }
    let dupeCrn, dupeId

    beforeAll(async () => {
      const { result } = await server.inject({
        method: 'POST',
        url: '/person/create',
        payload: dupe
      })
      dupeCrn = result._data
      dupeId = Number(crnToPersonId[dupeCrn])
    })

    test('should return the matching person, conforming to the schema', async () => {
      const { result, statusCode } = await checkDuplicates(dupe)

      expect(statusCode).toBe(200)
      expect(result).toEqual({
        _data: {
          customerReferenceNumber: dupeCrn,
          firstName: 'Dupe',
          lastName: 'Check',
          landline: '01215 090627',
          mobile: null,
          dateOfBirth: 1065270380449,
          id: dupeId
        }
      })
      expect(result).toConformToSchema(responseSchema())
    })

    test('should match names case-insensitively and dateOfBirth on the same day', async () => {
      const { result } = await checkDuplicates({
        ...dupe,
        firstName: ' DUPE ',
        lastName: 'check',
        dateOfBirth: Date.UTC(2003, 9, 4) // a different time on the same day
      })

      expect(result._data.id).toBe(dupeId)
    })

    test('should not match a deactivated person', async () => {
      const details = {
        firstName: 'Soon',
        lastName: 'Deactivated',
        dateOfBirth: 946684800000,
        landline: '01632 960001',
        mobile: '07700 900001'
      }
      await server.inject({
        method: 'POST',
        url: '/person/create',
        payload: details
      })
      const before = await checkDuplicates(details)
      expect(before.result._data).toMatchObject(details)

      await server.inject({
        method: 'POST',
        url: `/person/${before.result._data.id}/deactivate`,
        payload: {
          partyNoteType: 'DeactivatePerson',
          reason: 'a reason',
          note: 'a note'
        }
      })
      const { result } = await checkDuplicates(details)

      expect(result).toEqual({ _data: null })
    })

    test.each([
      ['a date-time string', '2003-10-04T12:26:20.449Z'],
      [
        'a date-time string at a different time on the same day',
        '2003-10-04T00:00:00Z'
      ]
    ])('should match a dateOfBirth given as %s', async (_, dateOfBirth) => {
      const { result } = await checkDuplicates({ ...dupe, dateOfBirth })

      expect(result._data.id).toBe(dupeId)
    })

    test('should return dateOfBirth as epoch millis when matched with a date-time string', async () => {
      const { result } = await checkDuplicates({
        ...dupe,
        dateOfBirth: '2003-10-04T00:00:00Z'
      })

      expect(result._data.dateOfBirth).toBe(1065270380449)
    })

    describe('for a person with no dateOfBirth', () => {
      const noDob = {
        firstName: 'No',
        lastName: 'Birthday',
        dateOfBirth: null,
        landline: '01632 960002',
        mobile: null
      }
      let noDobId

      beforeAll(async () => {
        const { result } = await server.inject({
          method: 'POST',
          url: '/person/create',
          payload: noDob
        })
        noDobId = Number(crnToPersonId[result._data])
      })

      test('should match a null dateOfBirth', async () => {
        const { result } = await checkDuplicates(noDob)

        expect(result._data).toMatchObject({ id: noDobId, dateOfBirth: null })
      })

      test('should match a missing dateOfBirth', async () => {
        const { dateOfBirth, ...withoutDob } = noDob
        const { result } = await checkDuplicates(withoutDob)

        expect(result._data.id).toBe(noDobId)
      })

      test('should not match when a dateOfBirth is given', async () => {
        const { result } = await checkDuplicates({
          ...noDob,
          dateOfBirth: 1065270380449
        })

        expect(result).toEqual({ _data: null })
      })
    })

    test('should not match a person with a dateOfBirth when none is given', async () => {
      const { result } = await checkDuplicates({ ...dupe, dateOfBirth: null })

      expect(result).toEqual({ _data: null })
    })

    test('should treat a missing mobile as none', async () => {
      const { mobile, ...withoutMobile } = dupe
      const { result } = await checkDuplicates(withoutMobile)

      expect(result._data.id).toBe(dupeId)
    })

    test.each([
      ['a different landline', { landline: '01215 090628' }],
      ['a landline with different whitespace', { landline: '01215090627' }],
      ['a missing landline', { landline: undefined }],
      ['a mobile the person does not have', { mobile: '07700 900000' }]
    ])('should return null data for %s', async (_, overrides) => {
      const { result } = await checkDuplicates({ ...dupe, ...overrides })

      expect(result).toEqual({ _data: null })
    })

    test('should return null data when no match is found, conforming to the schema', async () => {
      const { result, statusCode } = await checkDuplicates({
        ...dupe,
        firstName: 'Other'
      })

      expect(statusCode).toBe(200)
      expect(result).toEqual({ _data: null })
      expect(result).toConformToSchema(responseSchema())
    })

    test('should not match the person against itself', async () => {
      const { result } = await checkDuplicates({ ...dupe, id: dupeId })

      expect(result).toEqual({ _data: null })
    })

    test('should return a 500 when no body is supplied', async () => {
      const { statusCode } = await checkDuplicates(undefined)

      expect(statusCode).toBe(500)
    })

    test.each([
      ['invalid JSON', '{"firstName": "Big",', 'application/json'],
      ['a JSON array', '[]', 'application/json'],
      ['a JSON string', '"Big Skeleton"', 'application/json'],
      ['plain text', 'Big Skeleton', 'text/plain'],
      ['binary data', 'Big Skeleton', 'application/octet-stream']
    ])(
      'should return a 400 when the payload is %s',
      async (_, payload, contentType) => {
        const { result, statusCode } = await server.inject({
          method: 'POST',
          url: '/person/check/duplicates',
          payload,
          headers: { 'content-type': contentType }
        })

        expect(statusCode).toBe(400)
        expect(result).toEqual({ code: 400, message: 'Unable to process JSON' })
      }
    )

    test.each([
      ['an empty object', {}],
      ['no dateOfBirth', { firstName: 'Dupe', lastName: 'Check' }],
      ['an invalid dateOfBirth', { ...dupe, dateOfBirth: 'not a date' }],
      ['an out of range dateOfBirth', { ...dupe, dateOfBirth: 1e20 }]
    ])('should return null data for %s', async (_, payload) => {
      const { result, statusCode } = await checkDuplicates(payload)

      expect(statusCode).toBe(200)
      expect(result).toEqual({ _data: null })
    })
  })

  describe('POST /person/{personId}/lock', () => {
    test('should lock a person', async () => {
      const personId = 11111111

      const lockRes = await server.inject({
        method: 'POST',
        url: `/person/${personId}/lock`,
        payload: {
          partyNoteType: 'LockPerson',
          reason: 'Testing lock behaviour'
        }
      })

      expect(lockRes.statusCode).toBe(204)

      const lockedPerson = await server.inject({
        method: 'GET',
        url: `/person/${personId}/summary`
      })

      expect(lockedPerson.statusCode).toBe(200)
      expect(lockedPerson.result._data.locked).toBe(true)
    })

    test('should throw an error when trying to lock a person who does not exist', async () => {
      const personId = 99999999

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/person/${personId}/lock`,
        payload: {
          partyNoteType: 'LockPerson',
          reason: 'Testing lock behaviour'
        }
      })

      expect(statusCode).toBe(404)
      expect(result).toEqual({
        statusCode: 404,
        error: 'Not Found',
        message: 'Person not found'
      })
    })
  })

  describe('POST /person/{personId}/unlock', () => {
    test('should unlock a person', async () => {
      const personId = 11111111

      const unlockRes = await server.inject({
        method: 'POST',
        url: `/person/${personId}/unlock`,
        payload: {
          partyNoteType: 'UnlockPerson',
          reason: 'Testing unlock behaviour'
        }
      })

      expect(unlockRes.statusCode).toBe(204)

      const unlockedPerson = await server.inject({
        method: 'GET',
        url: `/person/${personId}/summary`
      })

      expect(unlockedPerson.statusCode).toBe(200)
      expect(unlockedPerson.result._data.locked).toBe(false)
    })

    test('should throw an error when trying to unlock a person who does not exist', async () => {
      const personId = 99999999

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/person/${personId}/unlock`,
        payload: {
          partyNoteType: 'UnlockPerson',
          reason: 'Testing unlock behaviour'
        }
      })

      expect(statusCode).toBe(404)
      expect(result).toEqual({
        statusCode: 404,
        error: 'Not Found',
        message: 'Person not found'
      })
    })
  })

  describe('POST /person/{personId}/deactivate', () => {
    test('should deactivate a person', async () => {
      // arrange
      const personId = 11111120
      const before = await server.inject({
        method: 'GET',
        url: `/person/${personId}/summary`
      })
      expect(before.result._data.deactivated).toBe(false)

      // act
      const { statusCode } = await server.inject({
        method: 'POST',
        url: `/person/${personId}/deactivate`,
        payload: {
          partyNoteType: 'DeactivatePerson',
          reason: 'Customer deceased',
          note: 'Confirmed by next of kin'
        }
      })

      // assert
      expect(statusCode).toBe(204)
      const after = await server.inject({
        method: 'GET',
        url: `/person/${personId}/summary`
      })
      expect(after.result._data.deactivated).toBe(true)
    })

    test('should return 404 when the person does not exist', async () => {
      // arrange / act
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: '/person/99999999/deactivate',
        payload: {
          partyNoteType: 'DeactivatePerson',
          reason: 'a reason',
          note: 'a note'
        }
      })

      // assert
      expect(statusCode).toBe(404)
      expect(result.message).toBe('Person not found')
    })

    test.each([
      [
        'only a reason is given',
        { partyNoteType: 'DeactivatePerson', reason: 'a reason' }
      ],
      [
        'only a note is given',
        { partyNoteType: 'DeactivatePerson', note: 'a note' }
      ]
    ])('should return 204 when %s', async (_, payload) => {
      // arrange / act
      const { statusCode } = await server.inject({
        method: 'POST',
        url: '/person/11111141/deactivate',
        payload
      })

      // assert
      expect(statusCode).toBe(204)
    })

    test.each([
      ['reason', 100, 204],
      ['reason', 101, 500],
      ['note', 4000, 204],
      ['note', 4001, 500]
    ])(
      'should handle a %s of %i characters with %i',
      async (field, length, expected) => {
        // arrange
        const payload = {
          partyNoteType: 'DeactivatePerson',
          [field]: 'x'.repeat(length)
        }

        // act
        const { statusCode } = await server.inject({
          method: 'POST',
          url: '/person/11111141/deactivate',
          payload
        })

        // assert
        expect(statusCode).toBe(expected)
      }
    )

    test.each([
      [
        'neither reason nor note is given',
        { partyNoteType: 'DeactivatePerson' }
      ],
      [
        'reason and note are empty',
        { partyNoteType: 'DeactivatePerson', reason: '', note: '' }
      ],
      [
        'partyNoteType is wrong',
        { partyNoteType: 'LockPerson', reason: 'a reason', note: 'a note' }
      ]
    ])('should return 400 when %s', async (_, payload) => {
      // arrange / act
      const { statusCode } = await server.inject({
        method: 'POST',
        url: '/person/11111141/deactivate',
        payload
      })

      // assert
      expect(statusCode).toBe(400)
    })
  })

  describe('the external gateway', () => {
    test('should return data /person/{personId}/summary corresponding to crn for personIdOverride', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/person/${config.get('personIdOverride')}/summary`,
        headers: { crn: '9111111100' }
      })
      expect(statusCode).toBe(200)
      expect(result).toConformToSchema(
        schema.paths['/person/{personId}/summary'].get.responses['200'].content[
          'application/json'
        ].schema
      )
    })

    test('should return data /person/search', async () => {
      const { result, statusCode } = await server.inject({
        method: 'POST',
        url: '/person/search',
        payload: {
          primarySearchPhrase: '9111111100',
          searchFieldType: 'CUSTOMER_REFERENCE'
        }
      })
      expect(statusCode).toBe(200)
      expect(result._data).toHaveLength(1)
      expect(statusCode).toBe(200)
      expect(result).toConformToSchema(
        schema.paths['/person/search'].post.responses['200'].content[
          'application/json'
        ].schema
      )
    })
  })

  describe('with static person data overrides', () => {
    const staticPersonFixture = {
      // fake generated data
      dateOfBirth: 1065270380449,
      doNotContact: false,
      id: 11111119,
      // static overridden data
      customerReferenceNumber: '9111111900',
      firstName: 'Big',
      middleName: null,
      lastName: 'Skeleton',
      address: {
        address1: 'A dark dark cellar',
        address2: 'A dark dark staircase',
        address3: 'A dark dark house',
        street: 'A dark dark street',
        city: 'A dark dark town',
        dependentLocality: 'A dark dark hill'
      },
      email: 'skeleton@the-closet.net',
      emailValidated: true,
      confirmed: true,
      mobile: null,
      title: null,
      otherTitle: null
    }

    test('should return data /person/{personId}/summary', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/person/11111119/summary'
      })
      expect(response.statusCode).toBe(200)
      const json = JSON.parse(response.payload)
      expect(json._data).toEqual(expect.objectContaining(staticPersonFixture))
    })

    test('should return data /person/search', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/person/search',
        payload: {
          primarySearchPhrase: '9111111900',
          searchFieldType: 'CUSTOMER_REFERENCE'
        }
      })
      expect(response.statusCode).toBe(200)
      const json = JSON.parse(response.payload)
      expect(json._data).toHaveLength(1)
      expect(json._data[0]).toEqual(
        expect.objectContaining({
          customerReference: '9111111900',
          email: 'skeleton@the-closet.net',
          fullName: 'Big Skeleton',
          id: 11111119,
          nationalInsuranceNumber: null,
          primaryAddress: staticPersonFixture.address
        })
      )
    })
  })

  describe('person mutations', () => {
    test('should update person data', async () => {
      // get the current state
      const { result: personFixture } = await server.inject({
        method: 'GET',
        url: '/person/11111111/summary'
      })

      const payload = {
        id: 11111111,
        title: 'test-title',
        otherTitle: 'test-other-title',
        firstName: 'test-first-name',
        middleName: 'test-middle-name',
        lastName: 'test-last-name',
        dateOfBirth: -2,
        landline: '01234 567890',
        mobile: '07111 222333',
        email: 'test-email@test.com',
        doNotContact: !personFixture._data.doNotContact,
        emailValidated: !personFixture._data.emailValidated,
        address: {
          address1: 'test-line-1',
          address2: 'test-line-2',
          address3: 'test-line-3',
          address4: 'test-line-4',
          address5: 'test-line-5',
          addressTypeId: null,
          buildingName: 'test-building-name',
          buildingNumberRange: 'test-building-number-range',
          city: 'test-city',
          country: 'test-country',
          county: 'test-county',
          dependentLocality: 'test-dependent-locality',
          doubleDependentLocality: 'test-double-dependent-locality',
          flatName: 'test-flat-name',
          pafOrganisationName: 'test-paf-organisation-name',
          postalCode: 'TE5 5TT',
          street: 'test-street',
          uprn: 'test-uprn'
        },
        locked: !personFixture._data.locked,
        confirmed: !personFixture._data.confirmed,
        customerReferenceNumber: 'test-crn',
        personalIdentifiers: ['not', 'set'],
        deactivated: !personFixture._data.deactivated
      }
      // update the state
      const response = await server.inject({
        method: 'PUT',
        url: '/person/11111111',
        headers: {
          email: 'test@defra.gov.uk'
        },
        payload: {
          ...payload,
          address: { ...payload.address, extra: 'chuff' },
          more: 'jazz'
        }
      })
      expect(response.statusCode).toBe(204)
      expect(response.payload).toBe('')

      // get the new state
      const updated = await server.inject({
        method: 'GET',
        url: '/person/11111111/summary'
      })
      expect(updated.statusCode).toBe(200)
      expect(updated.result._data).toEqual({
        ...payload,
        dateOfBirth: -2,
        // data which should not be updated remains the same
        customerReferenceNumber: personFixture._data.customerReferenceNumber,
        // the email address changed, so the PartyDigitalContact must be re-verified
        emailValidated: false,
        confirmed: personFixture._data.confirmed,
        locked: personFixture._data.locked,
        deactivated: personFixture._data.deactivated,
        personalIdentifiers: personFixture._data.personalIdentifiers
      })
    })

    test('should fail if no data PUT /person/{personId}', async () => {
      const { result, statusCode } = await server.inject({
        method: 'PUT',
        url: '/person/11111111',
        headers: {
          email: 'test@defra.gov.uk'
        },
        payload: {}
      })

      expect(statusCode).toBe(422)
      expect(result).toEqual({
        statusCode: 422,
        error: 'Unprocessable Entity',
        message: 'validation error while processing input'
      })
    })

    test('should fail if dateOfBirth is in the future PUT /person/{personId}', async () => {
      const { result: current } = await server.inject({
        method: 'GET',
        url: '/person/11111111/summary'
      })

      const { result, statusCode } = await server.inject({
        method: 'PUT',
        url: '/person/11111111',
        headers: {
          email: 'test@defra.gov.uk'
        },
        payload: { ...current._data, dateOfBirth: Date.now() + 86400000 }
      })

      expect(statusCode).toBe(422)
      expect(result).toEqual({
        statusCode: 422,
        error: 'Unprocessable Entity',
        message: 'validation error while processing input'
      })
    })
    test('should invalidate emailValidated when the email address changes on PUT /person/{personId}', async () => {
      const { result: current } = await server.inject({
        method: 'GET',
        url: '/person/11111113/summary'
      })
      expect(current._data.email).not.toBe('changed@defra.gov.uk')

      const response = await server.inject({
        method: 'PUT',
        url: '/person/11111113',
        headers: { email: 'test@defra.gov.uk' },
        payload: { ...current._data, email: 'changed@defra.gov.uk' }
      })
      expect(response.statusCode).toBe(204)

      const { result: updated } = await server.inject({
        method: 'GET',
        url: '/person/11111113/summary'
      })
      expect(updated._data.email).toBe('changed@defra.gov.uk')
      expect(updated._data.emailValidated).toBe(false)
    })

    test('should leave emailValidated untouched on PUT /person/{personId} when the email address is unchanged', async () => {
      const { result: current } = await server.inject({
        method: 'GET',
        url: '/person/11111114/summary'
      })

      const response = await server.inject({
        method: 'PUT',
        url: '/person/11111114',
        headers: { email: 'test@defra.gov.uk' },
        payload: { ...current._data, doNotContact: !current._data.doNotContact }
      })
      expect(response.statusCode).toBe(204)

      const { result: updated } = await server.inject({
        method: 'GET',
        url: '/person/11111114/summary'
      })
      expect(updated._data.email).toBe(current._data.email)
      expect(updated._data.emailValidated).toBe(current._data.emailValidated)
    })

    test('should leave emailValidated untouched on PUT /person/{personId} when only the email casing changes', async () => {
      const { result: current } = await server.inject({
        method: 'GET',
        url: '/person/11111115/summary'
      })
      const recasedEmail =
        current._data.email[0].toUpperCase() +
        current._data.email.slice(1).toLowerCase()

      const response = await server.inject({
        method: 'PUT',
        url: '/person/11111115',
        headers: { email: 'test@defra.gov.uk' },
        payload: { ...current._data, email: recasedEmail }
      })
      expect(response.statusCode).toBe(204)

      const { result: updated } = await server.inject({
        method: 'GET',
        url: '/person/11111115/summary'
      })
      expect(updated._data.email).toBe(recasedEmail)
      expect(updated._data.emailValidated).toBe(current._data.emailValidated)
    })

    test.each([
      [1735689600, 1735689600, 'positive number'], // sfd-id-check: allow - Unix timestamp
      [-1735689600, -1735689600, 'negative number'], // sfd-id-check: allow - Unix timestamp
      ['1735689600', 1735689600, 'positive string'], // sfd-id-check: allow - Unix timestamp
      ['-1735689600', -1735689600, 'negative string'] // sfd-id-check: allow - Unix timestamp
    ])(
      'should store dateOfBirth as milliseconds without conversion on PUT (%s)',
      async (input, expected) => {
        // fetch current state so we send a complete valid payload
        const { result: current } = await server.inject({
          method: 'GET',
          url: '/person/11111111/summary'
        })

        const putResponse = await server.inject({
          method: 'PUT',
          url: '/person/11111111',
          headers: { email: 'test@defra.gov.uk' },
          payload: { ...current._data, dateOfBirth: input }
        })
        expect(putResponse.statusCode).toBe(204)

        const getResponse = await server.inject({
          method: 'GET',
          url: '/person/11111111/summary'
        })
        expect(getResponse.statusCode).toBe(200)
        expect(getResponse.result._data.dateOfBirth).toBe(expected)
      }
    )
  })

  describe('Create a new person', () => {
    const createPerson = (payload) =>
      server.inject({ method: 'POST', url: '/person/create', payload })

    const findByCrn = async (crn) => {
      const { result } = await server.inject({
        method: 'POST',
        url: '/person/search',
        payload: {
          searchFieldType: 'CUSTOMER_REFERENCE',
          primarySearchPhrase: crn
        }
      })
      return result._data[0]
    }

    test('should create a person and return the CRN, conforming to the schema', async () => {
      const { result, statusCode } = await createPerson({
        firstName: 'New',
        lastName: 'Person'
      })

      expect(statusCode).toBe(200)
      expect(result).toEqual({ _data: expect.stringMatching(/^\d{10}$/) })
      expect(result).toConformToSchema(
        schema.paths['/person/create'].post.responses['200'].content[
          'application/json'
        ].schema
      )
    })

    test('should make the created person retrievable by CRN and ID', async () => {
      const { result } = await createPerson({
        firstName: 'Findable',
        lastName: 'Person',
        email: 'findable.person@example.com'
      })

      const found = await findByCrn(result._data)
      expect(found).toEqual(
        expect.objectContaining({
          customerReference: result._data,
          fullName: 'Findable Person'
        })
      )

      const { result: summary, statusCode } = await server.inject({
        method: 'GET',
        url: `/person/${found.id}/summary`
      })
      expect(statusCode).toBe(200)
      expect(summary._data).toEqual(
        expect.objectContaining({
          id: found.id,
          customerReferenceNumber: result._data,
          firstName: 'Findable',
          lastName: 'Person',
          email: 'findable.person@example.com'
        })
      )
    })

    test('should allocate a new ID and CRN for each person', async () => {
      const first = await createPerson({
        firstName: 'First',
        lastName: 'Person'
      })
      const second = await createPerson({
        firstName: 'Second',
        lastName: 'Person'
      })

      expect(second.result._data).not.toBe(first.result._data)
      expect((await findByCrn(second.result._data)).id).not.toBe(
        (await findByCrn(first.result._data)).id
      )
    })

    test('should ignore id and customerReferenceNumber in the payload', async () => {
      const { result } = await createPerson({
        id: 11111111,
        customerReferenceNumber: '9111111100',
        firstName: 'Not',
        lastName: 'Overriding'
      })

      expect(result._data).not.toBe('9111111100')
      expect((await findByCrn(result._data)).id).not.toBe(11111111)

      // the existing person is untouched
      const existing = await findByCrn('9111111100')
      expect(existing.id).toBe(11111111)
      expect(existing.fullName).not.toBe('Not Overriding')
    })

    test('should coerce non-string names so name searches still work', async () => {
      const { result } = await createPerson({
        firstName: 'Numeric',
        lastName: 98765
      })

      const { result: searchResult, statusCode } = await server.inject({
        method: 'POST',
        url: '/person/search',
        payload: {
          searchFieldType: 'CUSTOMER_NAME',
          primarySearchPhrase: '98765'
        }
      })
      expect(statusCode).toBe(200)
      expect(searchResult._data).toEqual([
        expect.objectContaining({
          customerReference: result._data,
          fullName: 'Numeric 98765'
        })
      ])
    })

    test('should allow the created person to be locked', async () => {
      const { result } = await createPerson({
        firstName: 'Lockable',
        lastName: 'Person'
      })
      const { id } = await findByCrn(result._data)

      const lockRes = await server.inject({
        method: 'POST',
        url: `/person/${id}/lock`,
        payload: {
          partyNoteType: 'LockPerson',
          reason: 'Testing lock of a created person'
        }
      })
      expect(lockRes.statusCode).toBe(204)

      const { result: summary } = await server.inject({
        method: 'GET',
        url: `/person/${id}/summary`
      })
      expect(summary._data.locked).toBe(true)
    })

    test.each([
      ['firstName is missing', { lastName: 'Person' }],
      ['lastName is missing', { firstName: 'New' }],
      ['firstName is empty', { firstName: '', lastName: 'Person' }]
    ])('should return 422 when %s', async (_, payload) => {
      const { statusCode } = await createPerson(payload)

      expect(statusCode).toBe(422)
    })

    test.each([
      ['there is no body', undefined, 'source cannot be null'],
      ['the body is null', 'null', 'source cannot be null'],
      [
        'the body is a string',
        '"New Person"',
        'missing or invalid request body'
      ],
      ['the body is an array', '[]', 'missing or invalid request body']
    ])('should return 400 when %s', async (_, payload, message) => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: '/person/create',
        headers: { 'content-type': 'application/json' },
        payload
      })

      expect(statusCode).toBe(400)
      expect(result.message).toBe(message)
    })

    test('should return a new person as unlocked, active and with an unvalidated email', async () => {
      const { result } = await createPerson({
        firstName: 'Fresh',
        lastName: 'Person',
        locked: true,
        deactivated: true,
        emailValidated: true
      })
      const { id } = await findByCrn(result._data)

      const { result: summary } = await server.inject({
        method: 'GET',
        url: `/person/${id}/summary`
      })
      expect(summary._data).toEqual(
        expect.objectContaining({
          locked: false,
          deactivated: false,
          emailValidated: false
        })
      )
    })
  })
})
