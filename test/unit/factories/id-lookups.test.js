import {
  crnToPersonId,
  orgIdLookup,
  sbiToOrgId,
  staticPersonData
} from '../../../src/factories/id-lookups.js'
import {
  sfdBusinessLookup,
  sfdPersonLookup
} from '../../../src/factories/sfd-test-data/index.js'

const MIN_CRN = 9000000000
const SFD_MIN_CRN = 9500000000
const SFD_MAX_CRN = 9699999999
const SFD_MIN_SBI = 850000000
const SFD_MAX_SBI = 869999999

describe('id-lookups', () => {
  describe('staticPersonData', () => {
    const crns = Object.entries(staticPersonData).map(([personId, { crn }]) => [
      personId,
      crn
    ])
    const sfdCrns = crns.filter(([personId]) => personId in sfdPersonLookup)
    const dalCrns = crns.filter(([personId]) => !(personId in sfdPersonLookup))

    // 9000000000+ is the range of CRNs that are valid for FCP testing.
    it.each(crns)(
      'person %s has a 10-digit CRN of at least 9000000000',
      (_personId, crn) => {
        expect(crn).toEqual(expect.stringMatching(/^\d{10}$/))
        expect(Number(crn)).toBeGreaterThanOrEqual(MIN_CRN)
      }
    )

    it.each(sfdCrns)(
      'SFD person %s has a CRN in the SFD range',
      (_personId, crn) => {
        expect(Number(crn)).toBeGreaterThanOrEqual(SFD_MIN_CRN)
        expect(Number(crn)).toBeLessThanOrEqual(SFD_MAX_CRN)
      }
    )

    it.each(dalCrns)(
      'non-SFD person %s has a CRN outside the SFD range',
      (_personId, crn) => {
        expect(Number(crn) >= SFD_MIN_CRN && Number(crn) <= SFD_MAX_CRN).toBe(
          false
        )
      }
    )

    it('has no duplicate CRNs', () => {
      // a duplicate would silently overwrite an earlier person in crnToPersonId
      expect(Object.keys(crnToPersonId)).toHaveLength(crns.length)
    })
  })

  describe('orgIdLookup', () => {
    const sbis = Object.entries(orgIdLookup).map(([orgId, { sbi }]) => [
      orgId,
      sbi
    ])
    const sfdSbis = sbis.filter(([orgId]) => orgId in sfdBusinessLookup)
    const dalSbis = sbis.filter(([orgId]) => !(orgId in sfdBusinessLookup))

    it.each(sbis)(
      'org %s has a 9-digit SBI in the 8xxxxxxxx range',
      (_orgId, sbi) => {
        expect(String(sbi)).toEqual(expect.stringMatching(/^8\d{8}$/))
      }
    )

    it.each(sfdSbis)(
      'SFD org %s has an SBI in the SFD range',
      (_orgId, sbi) => {
        expect(sbi).toBeGreaterThanOrEqual(SFD_MIN_SBI)
        expect(sbi).toBeLessThanOrEqual(SFD_MAX_SBI)
      }
    )

    it.each(dalSbis)(
      'non-SFD org %s has an SBI outside the SFD range',
      (_orgId, sbi) => {
        expect(sbi >= SFD_MIN_SBI && sbi <= SFD_MAX_SBI).toBe(false)
      }
    )

    it('has no duplicate SBIs', () => {
      // a duplicate would silently overwrite an earlier org in sbiToOrgId
      expect(Object.keys(sbiToOrgId)).toHaveLength(sbis.length)
    })
  })
})
