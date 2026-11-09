const addressUpdateSchema = {
  address1: { type: 'string', default: null },
  address2: { type: 'string', default: null },
  address3: { type: 'string', default: null },
  address4: { type: 'string', default: null },
  address5: { type: 'string', default: null },
  pafOrganisationName: { type: 'string', default: null },
  flatName: { type: 'string', default: null },
  buildingNumberRange: { type: 'string', default: null },
  buildingName: { type: 'string', default: null },
  street: { type: 'string', default: null },
  city: { type: 'string', default: null },
  county: { type: 'string', default: null },
  postalCode: { type: 'string', default: null },
  country: { type: 'string', default: null },
  uprn: { type: 'string', default: null },
  dependentLocality: { type: 'string', default: null },
  doubleDependentLocality: { type: 'string', default: null }
}

export const personUpdateSchema = {
  title: { type: 'string', default: null },
  otherTitle: { type: 'string', default: null },
  firstName: { type: 'string', default: null },
  middleName: { type: 'string', default: null },
  lastName: { type: 'string', default: null },
  dateOfBirth: { type: 'number', default: null },
  landline: { type: 'string', default: null },
  mobile: { type: 'string', default: null },
  email: { type: 'string', default: null },
  doNotContact: { type: 'boolean', default: false },
  address: addressUpdateSchema
}
