import {
  sfdPersonLookupPerformance,
  sfdBusinessLookupPerformance
} from '../../../src/factories/sfd-test-data/performance.js'

/*
 * Guards the invariant that every customer referenced by a performance-fixture org has a
 * matching person stub. A missing person stub makes retrievePerson throw and the org 404,
 * which is the FLS2-158 failure mode.
 */
describe('sfd performance fixture person coverage', () => {
  test('every customer person id has a matching person stub', () => {
    const persons = new Set(Object.keys(sfdPersonLookupPerformance).map(Number))

    const missing = []
    for (const [orgId, org] of Object.entries(sfdBusinessLookupPerformance)) {
      for (const customer of org.customers ?? []) {
        const personId =
          typeof customer === 'number' ? customer : customer.personId
        if (!persons.has(personId)) {
          missing.push({ orgId, personId })
        }
      }
    }

    expect(missing).toEqual([])
  })
})
