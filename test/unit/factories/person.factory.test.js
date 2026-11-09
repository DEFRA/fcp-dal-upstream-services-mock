import {
  crnToPersonId,
  digitalContactPartyIdToPersonId,
  personIdToDigitalContactPartyId,
  personIdToOrgIds,
  staticPersonData
} from '../../../src/factories/id-lookups.js'
import {
  createPerson,
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
})
