import { faker, safeSeed } from '../common.js'

// The external-user function names the upstream recognises - mirrors AuthorisationData in
// src/routes/kits-v1/permissions-schema.oas.yml (a unit test keeps the two in sync).
export const KNOWN_FUNCTIONS = [
  'addOrRemoveOrTransferLand',
  'addRoleOrPrivilege',
  'amendApplication',
  'amendBankAccountDetails',
  'amendBusinessDetails',
  'amendControlledBusinessInfo',
  'amendELMApplications',
  'amendEntitlements',
  'amendLegallyResponsiblePeople',
  'amendNewYoungFarmerProcess',
  'applyForBPS',
  'closeBusiness',
  'confirmBusiness',
  'deleteBusiness',
  'modifyRoleOrPrivilege',
  'removeRoleOrPrivilege',
  'submitApplication',
  'submitELMApplications',
  'updateLandUse',
  'viewApplication',
  'viewBusinessBankAccount',
  'viewBusinessDetails',
  'viewCPH',
  'viewCSAgreements',
  'viewCSApplications',
  'viewCSClaims',
  'viewCountrysideStewardship',
  'viewELMApplications',
  'viewEntitlements',
  'viewLand',
  'viewLegallyResponsiblePeople'
]

export const KNOWN_INTERNAL_FUNCTIONS = [
  '3RD PARTY ADVISOR SUPPORT -SA',
  'addOrRemoveOrTransferLand',
  'addRoleOrPrivilege',
  'amendApplication',
  'amendBankAccountDetails',
  'amendBusinessDetails',
  'amendControlledBusinessInfo',
  'amendELMApplications',
  'amendEntitlements',
  'amendLegallyResponsiblePeople',
  'amendNewYoungFarmerProcess',
  'applyForBPS',
  'BANKDETAILSONLINECHANGE',
  'caseManagement',
  'closeBusiness',
  'confirmBusiness',
  'createBusinessNote',
  'createCustomerNote',
  'createInternalUserAccount',
  'createNewBusiness',
  'createNewCustomer',
  'createNewIdentity',
  'deleteBusiness',
  'deleteIdentity',
  'EA ADVISOR SUPPORT -SA',
  'FC ADVISOR SUPPORT -SA',
  'HE ADVISOR SUPPORT -SA',
  'modifyRoleOrPrivilege',
  'NE ADVISOR SUPPORT -SA',
  'removeRoleOrPrivilege',
  'resetAnyPassword',
  'search',
  'submitApplication',
  'submitELMApplications',
  'unlockInternalUserAccount',
  'updateLandUse',
  'upload_Alert',
  'viewApplication',
  'viewBusinessBankAccount',
  'viewBusinessDetails',
  'viewBusinessNotes',
  'viewCountrysideStewardship',
  'viewCPH',
  'viewCSAgreements',
  'viewCSApplications',
  'viewCSClaims',
  'viewCustomerNotes',
  'viewELMApplications',
  'viewEntitlements',
  'viewInternalUserLandingPage',
  'viewLand',
  'viewLegallyResponsiblePeople'
]

const knownFunctions = new Set(KNOWN_FUNCTIONS)
const knownInternalFunctions = new Set(KNOWN_INTERNAL_FUNCTIONS)

const authorisationByFunction = (functionSet, seed, functions) => {
  return functions.reduce((data, functionName) => {
    // The upstream echoes unrecognised function names back with a false.
    if (!functionSet.has(functionName)) {
      data[functionName] = false
      return data
    }
    // Seed per user+function so a function's flag is stable regardless of what else is requested.
    safeSeed([seed, functionName])
    data[functionName] = faker.datatype.boolean()
    return data
  }, {})
}

export const retrieveAuthorisationByFunction = (orgId, functions) =>
  authorisationByFunction(knownFunctions, orgId, functions)

export const retrieveInternalAuthorisationByFunction = (email, functions) =>
  authorisationByFunction(knownInternalFunctions, email, functions)
