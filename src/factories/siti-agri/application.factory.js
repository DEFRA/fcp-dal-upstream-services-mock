import {
  fakeId,
  fakeIds,
  faker,
  nullOrFake,
  safeSeed,
  toTitleCase,
  transformDate
} from '../common.js'
import { orgIdLookup } from '../id-lookups.js'

const applications = {}

// the most common statuses, codes, transitions, etc. usually align with this table
const statusMappings = [
  {
    weight: 2,
    value: {
      status: 'IN PROGRESS',
      code: '000001',
      portal: 'APPCRE',
      transition: 'CREATION'
    }
  },
  {
    weight: 1,
    value: {
      status: 'DRAFT',
      code: 'IDRAFT',
      portal: 'SUBMIT',
      transition: 'CREATE DRAFT APPLICATION'
    }
  },
  {
    weight: 35,
    value: {
      status: 'APPROVED',
      code: 'APPROV',
      portal: 'APPROV',
      transition: 'APPROVE'
    }
  },
  {
    weight: 2,
    value: {
      status: 'SUBMITTED',
      code: '000010',
      portal: 'CHEAPP',
      transition: 'SUBMIT'
    }
  },
  {
    weight: 28,
    value: {
      status: 'AGREEMENT LIVE',
      code: 'AGRLIV',
      portal: 'AGRLIV',
      transition: 'SET AGREEMENT LIVE'
    }
  },
  {
    weight: 51,
    value: {
      status: 'PAID',
      code: '000090',
      portal: 'PAYPRO',
      transition: 'TO PAID'
    }
  },
  {
    weight: 39,
    value: {
      status: 'DELETED',
      code: '000002',
      portal: 'DELETE',
      transition: 'DELETE'
    }
  },
  {
    weight: 25,
    value: {
      status: 'REJECTED',
      code: '000031',
      portal: 'REJECT',
      transition: 'REJECT'
    }
  },
  {
    weight: 7,
    value: {
      status: 'WITHDRAWN',
      code: 'WTHDRW',
      portal: 'WTHDRW',
      transition: 'WITHDRAW'
    }
  }
]
const intermediateTransitions = [
  { weight: 50, value: 'UPDATE' },
  { weight: 8, value: 'READY FOR SIGN OFF' },
  { weight: 8, value: 'RE-VERIFICATION' },
  { weight: 8, value: 'CHECK VERIFICATION' },
  { weight: 7, value: 'CLAIM CHECK' },
  { weight: 7, value: 'VERIFICATION ONLY' },
  { weight: 2, value: 'READY TO PAY' },
  { weight: 2, value: 'EVIDENCE VALIDATION' },
  { weight: 1, value: 'AGREEMENT SENT OUT' },
  { weight: 1, value: 'AGREE IN PRINCIPLE' },
  { weight: 1, value: 'DATA ALIGNMENT DRAFT CONTRACT' }
]

const createHistory = (overrides = {}) => ({
  dt_transition: transformDate(faker.date.recent({ refDate: '2023-01-01' })),
  check_status: faker.helpers.weightedArrayElement([
    { weight: 14, value: 'PASSED' },
    { weight: 1, value: 'NOT PASSED' }
  ]),
  transition_id: fakeId(),
  transition_name: faker.helpers.weightedArrayElement(intermediateTransitions),
  ...overrides
})
const createIntermediateHistory = (count = 1, overrides = {}) =>
  Array.from(
    { length: faker.number.int({ min: count * 2, max: count * 12 }) },
    () => createHistory(overrides)
  )
const createHistoryFromTransition = (transition, _overrides = {}) => {
  const history = [
    ...faker.helpers.weightedArrayElement([
      {
        weight: 1,
        value: () =>
          transition === 'CREATION'
            ? [] // allow for a single CREATION history
            : [createHistory({ transition_name: 'CREATE DRAFT APPLICATION' })]
      },
      { weight: 8, value: () => createIntermediateHistory() }, // mostly small history
      {
        weight: 3, // sometimes large history
        value: () => [
          ...createIntermediateHistory(100),
          createHistory({ transition_name: 'CREATE DRAFT APPLICATION' })
        ]
      }
    ])()
  ]

  return history.length
    ? [
        // always include the latest transition, i.e. current status
        createHistory({ transition_name: transition }),
        ...history,
        // CREATION is usually the oldest/last transition in history
        createHistory({ transition_name: 'CREATION' })
      ]
    : [createHistory({ transition_name: 'CREATION' })]
}

const createApplication = (sbi, overrides = {}) => {
  const year = faker.date.recent({ refDate: '2023-01-01' }).getFullYear()
  const { status, code, portal, transition } =
    faker.helpers.weightedArrayElement(statusMappings)
  const transition_id = overrides?.transition_id || fakeId()

  return {
    sbi,
    subject_id: fakeId(),
    year,
    application_name: nullOrFake(
      () => faker.lorem.words({ min: 2, max: 10 }).toUpperCase(),
      0.1
    ),
    module_code: nullOrFake(
      () =>
        `${faker.lorem.words({ min: 2, max: 3 }).toUpperCase().replaceAll(' ', '_')}_${year}`,
      0.1
    ),
    scheme: nullOrFake(
      () => faker.lorem.words({ min: 3, max: 6 }).toUpperCase(),
      0.1
    ),
    application_id: fakeId(),
    status_code_p: nullOrFake(() => 'STADOM', 0.1), // always seems to be 'STADOM'
    status_code_s: nullOrFake(() => code, 0.1),
    status,
    submission_date: nullOrFake(() =>
      transformDate(faker.date.recent({ refDate: '2023-01-01' }))
    ),
    portal_status_p: nullOrFake(() => 'DOMPRS', 0.1), // always seems to be 'DOMPRS'
    // portal_status_s is often `null`, otherwise follows normal pattern from mappings
    portal_status_s: nullOrFake(() => portal, 0.2),
    // sometimes duplicates portal_status_s
    portal_status: nullOrFake(() => toTitleCase(status), 0.5),
    fg_active: nullOrFake(() => 'Yes', 0.1), // always seems to be 'Yes'
    transition_id,
    transition_name: transition,
    // can sometimes refer to multiple agreements
    agreement_ref: nullOrFake(
      () =>
        nullOrFake(() => `${fakeId()}`, 0.2) ??
        fakeIds(faker.number.int({ min: 3, max: 10 })).join(', '),
      0.3
    ),
    ...overrides,
    application_history:
      // priority to provided history, then current transition, then fake history
      overrides?.application_history?.length
        ? [
            createHistory({
              transition_id,
              transition_name: transition,
              ...overrides.application_history.shift()
            }),
            ...(overrides.application_history?.map((history) =>
              createHistory(history)
            ) || [])
          ]
        : createHistoryFromTransition(transition)
  }
}

export const createApplications = (orgId, sbi) => {
  safeSeed(orgId)
  const applicationsData =
    orgIdLookup[orgId]?.applications?.map((application) =>
      createApplication(sbi, application)
    ) ||
    Array.from({ length: faker.helpers.arrayElement([0, 5, 60, 350]) }, () =>
      createApplication(sbi)
    )
  applications[sbi] = applicationsData
  return applicationsData
}

export const retrieveApplications = (sbi, orgId) => {
  const cachedApplications = applications[sbi]
  if (cachedApplications) {
    return cachedApplications
  }

  return createApplications(orgId, sbi)
}
