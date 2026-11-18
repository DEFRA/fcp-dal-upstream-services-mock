import {
  crnToPersonId,
  digitalContactPartyIdToPersonId,
  personIdToDigitalContactPartyId,
  personIdToOrgIds,
  staticPersonData
} from '../../../src/factories/id-lookups.js'
import {
  createPerson,
  findDuplicatePerson,
  retrievePerson,
  searchPeople,
  updatePerson
} from '../../../src/factories/person/person.factory.js'

const createAndRetrievePerson = (payload) =>
  retrievePerson(crnToPersonId[createPerson(payload)])

describe('person.factory', () => {
  describe('createPerson', () => {
    it('returns the new CRN as a 10-digit string', () => {
      const crn = createPerson()

      expect(crn).toEqual(expect.stringMatching(/^\d{10}$/))
      // 9000000000+ is the range of CRNs that are valid for FCP testing.
      expect(Number(crn)).toBeGreaterThanOrEqual(9000000000)
    })

    it('allocates a person ID and CRN that do not collide with static lookup data', () => {
      const existingIds = Object.keys(staticPersonData)
      const existingCrns = Object.values(staticPersonData).map(({ crn }) => crn)

      const crn = createPerson()
      const personId = crnToPersonId[crn]

      expect(existingIds).not.toContain(personId)
      expect(existingCrns).not.toContain(crn)
      expect(staticPersonData).toHaveProperty(personId)
      expect(staticPersonData[personId].crn).toBe(crn)
    })

    it('allocates distinct IDs and CRNs for each person', () => {
      const first = createAndRetrievePerson()
      const second = createAndRetrievePerson()

      expect(second.id).not.toBe(first.id)
      expect(second.customerReferenceNumber).not.toBe(
        first.customerReferenceNumber
      )
    })

    it('keeps generated identifiers while applying the supplied person details', () => {
      const crn = createPerson({
        id: 1,
        customerReferenceNumber: '9000000001',
        firstName: 'New',
        lastName: 'Person'
      })
      const person = retrievePerson(crnToPersonId[crn])

      expect(person).toEqual(
        expect.objectContaining({
          firstName: 'New',
          lastName: 'Person',
          id: Number(crnToPersonId[crn]),
          customerReferenceNumber: crn
        })
      )
      expect(person.id).not.toBe(1)
      expect(person.customerReferenceNumber).not.toBe('9000000001')
    })

    it('coerces payload fields and ignores fields outside the update schema', () => {
      const person = createAndRetrievePerson({
        firstName: 'New',
        lastName: 123,
        privileges: ['Injected']
      })

      expect(person.lastName).toBe('123')
      expect(searchPeople('CUSTOMER_NAME', '123')).toContainEqual(person)
      expect(person.privileges).toEqual([])
    })

    it('does not generate random data for fields missing from the payload', () => {
      const person = createAndRetrievePerson({
        firstName: 'New',
        address: { city: 'Leeds' }
      })

      expect(person).toEqual(
        expect.objectContaining({
          firstName: 'New',
          lastName: null,
          email: null,
          doNotContact: false,
          address: expect.objectContaining({ city: 'Leeds', postalCode: null })
        })
      )
      expect(person).toEqual(
        expect.objectContaining({
          role: null,
          privileges: [],
          personalIdentifiers: []
        })
      )
    })

    it('gives the created address a null addressTypeId that the payload cannot set', () => {
      const person = createAndRetrievePerson({
        firstName: 'New',
        address: { city: 'Leeds', addressTypeId: 'injected' }
      })

      expect(person.address).toHaveProperty('addressTypeId', null)
    })

    it('starts every created person unlocked, active, confirmed and with an unvalidated email', () => {
      const people = Array.from({ length: 20 }, () => createAndRetrievePerson())

      people.forEach((person) => {
        expect(person).toEqual(
          expect.objectContaining({
            locked: false,
            deactivated: false,
            emailValidated: false,
            confirmed: true
          })
        )
      })
    })

    it('does not let the payload set the account flags', () => {
      const person = createAndRetrievePerson({
        firstName: 'New',
        lastName: 'Person',
        locked: true,
        deactivated: true,
        emailValidated: true,
        confirmed: false
      })

      expect(person).toEqual(
        expect.objectContaining({
          locked: false,
          deactivated: false,
          emailValidated: false,
          confirmed: true
        })
      )
    })

    it('indexes the created person for retrieval, CRN searches, and organisation links', () => {
      const crn = createPerson()
      const personId = crnToPersonId[crn]
      const person = retrievePerson(personId)

      expect(person.customerReferenceNumber).toBe(crn)
      expect(searchPeople('CUSTOMER_REFERENCE', crn)).toEqual([person])
      expect(personIdToOrgIds[personId]).toEqual([])
    })

    it('registers a digital contact party for a person created with an email', () => {
      const person = createAndRetrievePerson({
        email: 'new.person@example.com'
      })
      const digitalContactPartyId = personIdToDigitalContactPartyId[person.id]

      expect(digitalContactPartyId).toEqual(expect.any(Number))
      expect(digitalContactPartyIdToPersonId[digitalContactPartyId]).toBe(
        `${person.id}`
      )
    })

    it('does not register a digital contact party for a person created without an email', () => {
      const person = createAndRetrievePerson({ email: null })

      expect(personIdToDigitalContactPartyId[person.id]).toBeUndefined()
    })
  })

  describe('updatePerson', () => {
    it('registers a digital contact party when an email is added', () => {
      const person = createAndRetrievePerson()

      updatePerson(person.id, { email: 'added@example.com' })

      const digitalContactPartyId = personIdToDigitalContactPartyId[person.id]
      expect(digitalContactPartyId).toEqual(expect.any(Number))
      expect(digitalContactPartyIdToPersonId[digitalContactPartyId]).toBe(
        `${person.id}`
      )
    })

    it('keeps the same digital contact party when the email changes', () => {
      const person = createAndRetrievePerson({ email: 'before@example.com' })
      const digitalContactPartyId = personIdToDigitalContactPartyId[person.id]

      updatePerson(person.id, { email: 'after@example.com' })

      expect(personIdToDigitalContactPartyId[person.id]).toBe(
        digitalContactPartyId
      )
    })

    it('does not register a digital contact party when the email is cleared', () => {
      const person = createAndRetrievePerson()

      updatePerson(person.id, { email: null })

      expect(personIdToDigitalContactPartyId[person.id]).toBeUndefined()
    })
  })

  describe('findDuplicatePerson', () => {
    const day = 24 * 60 * 60 * 1000

    // The DoB edge case people in id-lookups.js, with the calendar day each dateOfBirth represents
    describe.each([
      [9000010, 'midsummer, midnight UTC', '2000-06-30'],
      [9000011, 'midsummer, midnight UTC', '1950-06-01'],
      [9000012, 'midwinter, midnight UTC', '2000-01-01'],
      [9000013, 'midwinter, midnight UTC', '1950-12-31'],
      [9000014, 'midsummer, stored at GMT+1', '2001-06-01'],
      [9000015, 'midsummer, stored at GMT+3', '1940-06-30'],
      [9000016, 'midsummer, stored at GMT-1', '2001-06-01'],
      [9000017, 'midsummer, stored at GMT-3', '1940-06-30'],
      [9000018, 'midwinter, stored at GMT+3', '2001-01-01'],
      [9000019, 'midwinter before the epoch, stored at GMT+1', '1969-12-31'],
      [9000020, 'midwinter, stored at GMT-3', '2001-01-01'],
      [9000021, 'midwinter before the epoch, stored at GMT-1', '1969-12-31']
    ])('person %s (%s)', (personId, _, calendarDay) => {
      const person = retrievePerson(personId)
      const details = {
        firstName: person.firstName,
        lastName: person.lastName,
        mobile: person.mobile,
        landline: person.landline
      }
      const midnightUtc = Date.parse(`${calendarDay}T00:00:00Z`)

      it.each([
        ['the stored timestamp', person.dateOfBirth],
        ['midnight UTC on the day as epoch millis', midnightUtc],
        ['the day as a date string', calendarDay],
        [
          'midnight UTC on the day as a date-time string',
          `${calendarDay}T00:00:00.000Z`
        ],
        [
          'midday UTC on the day, less a millisecond',
          midnightUtc + day / 2 - 1
        ],
        ['midday UTC the day before', midnightUtc - day / 2],
        ['midnight in GMT+3 on the day', `${calendarDay}T00:00:00+03:00`],
        ['midnight in GMT-3 on the day', `${calendarDay}T00:00:00-03:00`]
      ])('matches a dateOfBirth given as %s', (__, dateOfBirth) => {
        expect(findDuplicatePerson({ ...details, dateOfBirth })?.id).toBe(
          person.id
        )
      })

      it.each([
        ['midnight UTC the day before', midnightUtc - day],
        ['midnight UTC the day after', midnightUtc + day],
        [
          'the day before as a date string',
          new Date(midnightUtc - day).toISOString().slice(0, 10)
        ],
        ['midday UTC on the day', midnightUtc + day / 2],
        [
          'midday UTC the day before, less a millisecond',
          midnightUtc - day / 2 - 1
        ]
      ])('does not match a dateOfBirth given as %s', (__, dateOfBirth) => {
        expect(findDuplicatePerson({ ...details, dateOfBirth })?.id).not.toBe(
          person.id
        )
      })

      it('does not match the person against themselves', () => {
        expect(
          findDuplicatePerson({
            ...details,
            id: person.id,
            dateOfBirth: person.dateOfBirth
          })?.id
        ).not.toBe(person.id)
      })

      it('does not match when no dateOfBirth is given', () => {
        expect(findDuplicatePerson(details)?.id).not.toBe(person.id)
      })
    })

    it.each([
      ['an unparseable string', 'not a date'],
      ['an empty string', ''],
      ['NaN', Number.NaN],
      ['a boolean', true],
      ['an object', {}]
    ])('matches nobody when dateOfBirth is %s', (_, dateOfBirth) => {
      const person = retrievePerson(9000010)
      expect(
        findDuplicatePerson({
          firstName: person.firstName,
          lastName: person.lastName,
          mobile: person.mobile,
          landline: person.landline,
          dateOfBirth
        })
      ).toBeUndefined()
    })
  })
})
