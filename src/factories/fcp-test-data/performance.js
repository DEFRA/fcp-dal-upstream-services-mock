/**
 * Person stubs for FCP performance-testing. Same shape as entries in personal.js
 * (person ID to PersonStub); merged into fcpPersonLookup in fcp-test-data/index.js.
 */
export const fcpPersonLookupPerformance = {
  5282345: { crn: '9100010101' }
}

/**
 * Org lookups for FCP performance testing. Same shape as in business.js
 * (orgId -> { sbi, customers }); merged into fcpBusinessLookup in fcp-test-data/index.js.
 */
export const fcpBusinessLookupPerformance = {
  5900001: { sbi: 810100101, customers: [5282345] },
  5900002: { sbi: 810100102, customers: [5282345] },
  5900003: { sbi: 810100103, customers: [5282345] }
}
