// Wiring notes:
// - defra-id.data.json (frontend) sets organisationId/sbi in auth tokens.
// - sfdPersonLookup + sfdBusinessLookup provide DAL mock ids.
// - sfdPersonLookup and sfdBusinessLookup merge edge-case + performance data here.
import { sfdBusinessLookupCore } from './business.js'
import { sfdPersonLookup as sfdPersonLookupEdgeCase } from './personal.js'
import {
  sfdPersonLookupPerformance,
  sfdBusinessLookupPerformance
} from './performance.js'
export const sfdPersonLookup = {
  ...sfdPersonLookupEdgeCase,
  ...sfdPersonLookupPerformance
}

// customers may be raw person-id numbers or { personId }; id-lookups.js handles both shapes.
export const sfdBusinessLookup = {
  ...sfdBusinessLookupCore,
  ...sfdBusinessLookupPerformance
}
