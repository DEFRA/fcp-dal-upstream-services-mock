import {
  fakeIds,
  faker,
  nullOrFake,
  safeSeed,
  transformDate
} from '../common.js'
import { orgIdLookup } from '../id-lookups.js'

const agreementsStore = {}

const createPaymentSchedule = (attributes = {}) => {
  return {
    option_code: faker.string.alpha({ length: 3 }).toUpperCase(),
    option_description: faker.lorem.sentence({ min: 3, max: 8 }),
    commitment_group_start_date: transformDate(faker.date.past({ years: 10 })),
    commitment_group_end_date: transformDate(faker.date.future({ years: 5 })),
    year: faker.date.anytime().getFullYear(),
    sheet_name: faker.string.alpha({ length: 6 }).toUpperCase(),
    parcel_name: faker.string.numeric({ length: 4 }),
    action_area: faker.number.int({ min: 1000, max: 50000 }),
    action_mtl: nullOrFake(() => faker.number.int({ min: 1, max: 100 })),
    action_units: nullOrFake(() =>
      faker.number.float({ min: 1, max: 100, fractionDigits: 2 })
    ),
    parcel_total_area: faker.number.int({ min: 1000, max: 50000 }),
    payment_schedule_start_date: transformDate(faker.date.past({ years: 10 })), // replicate kits date format
    payment_schedule_end_date: transformDate(faker.date.future({ years: 5 })), // replicate kits date format
    ...attributes
  }
}

const createAgreementMock = (sbi, attributes = {}) => ({
  sbi: `${sbi}`,
  contract_id: faker.string.numeric({ length: 6 }),
  agreement_name: faker.helpers.arrayElement([
    'CS AGREEMENT',
    'HLS AGREEMENT',
    'ELS AGREEMENT',
    'BPS AGREEMENT'
  ]),
  status: faker.helpers.arrayElement([
    'SIGNED',
    'ACTIVE',
    'EXPIRED',
    'WITHDRAWN'
  ]),
  contract_type: faker.helpers.arrayElement([
    'Countryside Stewardship (MT)',
    'Higher Level Stewardship',
    'Entry Level Stewardship',
    'Basic Payment Scheme'
  ]),
  scheme_year: faker.date.anytime().getFullYear(),
  start_date: transformDate(faker.date.past({ years: 10 })),
  end_date: transformDate(faker.date.future({ years: 5 })),

  payment_schedules: [],
  ...attributes
})

export const retrieveOrganisationAgreements = (sbi, orgId) => {
  if (agreementsStore[sbi]) {
    return agreementsStore[sbi]
  }

  safeSeed(sbi)

  const fakeAgreements = fakeIds(faker.number.int({ min: 0, max: 3 })).map(
    (id) => {
      const paymentSchedules = fakeIds(faker.number.int({ min: 0, max: 3 }))
      return {
        contract_id: `${id}`,
        payment_schedules: paymentSchedules
      }
    }
  )

  const agreements = orgIdLookup[orgId].agreements || fakeAgreements

  const agreementsResponse = agreements.map((agreement) => {
    const paymentSchedules = agreement.payment_schedules
      ? agreement.payment_schedules.map(() => createPaymentSchedule())
      : Array.from(
          { length: faker.number.int({ min: 0, max: 3 }) },
          createPaymentSchedule
        )

    return createAgreementMock(sbi, {
      ...agreement,
      payment_schedules: paymentSchedules
    })
  })

  agreementsStore[sbi] = agreementsResponse
  return agreementsResponse
}
