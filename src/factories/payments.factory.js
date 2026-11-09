import { addMoney } from '../utils/common.js'
import { fakeId, faker, safeSeed } from './common.js'
import { frnToPaymentOverrides } from './id-lookups.js'

const createLineItem = (overrides = {}) => ({
  parmAgreementNumber:
    faker.string.alpha({ length: 1, casing: 'upper' }) +
    faker.string.numeric({ length: 7, allowLeadingZeros: true }),
  parmClaimRefNumber: `${fakeId()}`,
  parmScheme: faker.string.numeric({ length: { min: 3, max: 6 } }),
  parmDescription: faker.lorem.sentences(1),
  parmMarketingYear: faker.date.recent({ days: 400 }).getFullYear().toString(),
  parmAmount: faker.number.float({ min: 0, max: 10_000, fractionDigits: 2 }),
  ...overrides
})

export const createPayment = ({ parmLineItems, ...overrides } = {}) => {
  parmLineItems = Array.from(
    parmLineItems ?? { length: faker.number.int({ min: 1, max: 5 }) },
    (itemOverrides) => createLineItem(itemOverrides)
  )

  return {
    parmPaymentReference: `PY${faker.string.numeric({ length: 7, allowLeadingZeros: true })}`,
    parmDate: faker.date.past({ years: 5 }).toISOString().substring(0, 19),
    parmAmount: parmLineItems.reduce(
      (sum, item) => addMoney(sum, item.parmAmount),
      0
    ),
    parmCurrency: 'GBP',
    parmLineItems,
    ...overrides
  }
}

const responseContentsCache = {}

export const retrievePayments = (frn) => {
  // check the cache for previously generated contents
  const cachedResponseContents = responseContentsCache[frn]
  if (cachedResponseContents) {
    return cachedResponseContents
  }

  // check the FRN exists and grab any static overrides
  const overrides = frnToPaymentOverrides[frn]
  if (overrides === undefined) {
    return null
  }

  // generate response contents and payments data
  safeSeed(frn)
  const paymentResponseContent = {
    Result: true,
    parmSupplierInfo: {
      parmHoldCodes: generateHoldCodes(),
      parmAccountLast4: `****${faker.string.numeric({ length: 4, allowLeadingZeros: true })}`,
      parmSortCode: `${faker.string.numeric({ length: 6, allowLeadingZeros: true })}`
    },
    parmPayments: Array.from(
      overrides.parmPayments ?? {
        length: faker.number.int({ min: 0, max: 50 })
      },
      (paymentOverrides) => createPayment(paymentOverrides)
    ),
    ...overrides
  }
  responseContentsCache[frn] = paymentResponseContent

  return paymentResponseContent
}

const generateHoldCodes = () => {
  const onHoldCodes = [
    'AUTOVERIFY',
    'BACSREJECT',
    'BANKVERIFY',
    'BPS_SRE',
    'BPSMAN18',
    'BRIDGING',
    'BRIDGING16',
    'BRIDGING17',
    'BRIDGING18',
    'COMMONS',
    'CR_SRE',
    'CSBRIDG17',
    'CSBRIDG18',
    'CSBRIDGING',
    'CSCAPMAN',
    'CSFSP',
    'CSFSP17',
    'CSTREAS17',
    'CSTREAS18',
    'CUSTBANK',
    'CUSTELIG',
    'DAXADDRESS',
    'DAXINSOLV',
    'DAXPROBTE',
    'DEACTIVATE',
    'DR_LEGAL',
    'ENT_SURR',
    'ESBRIDGING',
    'ESFSP',
    'ESTREASURY',
    'FDMR_SRE',
    'FINANCE',
    'FRAUD',
    'FRNEX_BANK',
    'FRNEX_CURR',
    'FRNEX_D2P',
    'FRNEX_DEBT',
    'FRNEX_E2P',
    'FRNEX_POT1',
    'GREY_LINES',
    'INACTIVE',
    'INCP',
    'INSOLV',
    'INTERIM',
    'LOW VALUE',
    'MULTI',
    'NE_AUDIT',
    'NOBANK',
    'NONRPAPROC',
    'OREGONDEBT',
    'OVER',
    'PENALTY',
    'PREVWO',
    'PROBATE',
    'RETRO',
    'RLE01',
    'SCOT_LOAN',
    'SCOTTISHXB',
    'SEPBUSCHK',
    'SHAREDPARC',
    'TYPN',
    'WRONG_CURR',
    'XBORDER',
    'ZCREATE'
  ]
  const notOnHoldCode = ['NTHLD']

  return faker.datatype.boolean({ probability: 0.25 })
    ? faker.helpers.arrayElements(
        onHoldCodes,
        faker.number.int({ min: 1, max: 5 })
      )
    : notOnHoldCode
}
