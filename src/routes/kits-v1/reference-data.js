// NOTE: reference data is pretty static and limited,
// so no need for the same level of fakery as the other routes,
// instead we can just return the same hard coded response as upstream.

export const referenceData = [
  {
    method: 'GET',
    path: '/reference/business-types',
    handler: async (_, h) => {
      return h.response({
        _data: [
          {
            id: 101402,
            type: 'Agency/Agent'
          },
          {
            id: 101404,
            type: 'Farmer'
          },
          {
            id: 101410,
            type: 'Commons or Graziers Association'
          },
          {
            id: 101413,
            type: 'Education Provider/Training'
          },
          {
            id: 101414,
            type: 'Trader only organisation'
          },
          {
            id: 101417,
            type: 'Forestry/Woodland Owner'
          },
          {
            id: 101418,
            type: 'Central/Local Government'
          },
          {
            id: 101419,
            type: 'Horticultural business'
          },
          {
            id: 101421,
            type: 'Intervention/Private Storage'
          },
          {
            id: 101422,
            type: 'Land Manager'
          },
          {
            id: 101423,
            type: 'Leader Group'
          },
          {
            id: 101426,
            type: 'Official Receiver/Administrator'
          },
          {
            id: 101437,
            type: 'Rural Community/Voluntary/Third sector organisation'
          },
          {
            id: 101439,
            type: 'Tourism'
          },
          {
            id: 101443,
            type: 'Not Specified'
          },
          {
            id: 101444,
            type: 'Meat Industry'
          },
          {
            id: 101445,
            type: 'Hobby livestock keeper'
          },
          {
            id: 101446,
            type: 'Professional livestock keeper'
          }
        ]
      })
    }
  },
  {
    method: 'GET',
    path: '/reference/legalstatus',
    handler: async (_, h) => {
      return h.response({
        _data: [
          {
            id: 102101,
            type: 'Charitable Incorporated Organisation (CIO)'
          },
          {
            id: 102102,
            type: 'Community Interest Company (CIC)'
          },
          {
            id: 102103,
            type: 'Government (Central)'
          },
          {
            id: 102104,
            type: 'Government (Local)'
          },
          {
            id: 102105,
            type: 'Limited Liability Partnership (LLP)'
          },
          {
            id: 102106,
            type: 'Limited Partnership (LP)'
          },
          {
            id: 102107,
            type: 'Non-UK Company'
          },
          {
            id: 102108,
            type: 'Partnership'
          },
          {
            id: 102109,
            type: 'Private Limited Company (Ltd)'
          },
          {
            id: 102110,
            type: 'Public Limited Company (PLC)'
          },
          {
            id: 102111,
            type: 'Sole Proprietorship'
          },
          {
            id: 102112,
            type: 'The Crown'
          },
          {
            id: 102113,
            type: 'Charitable Trust'
          },
          {
            id: 102114,
            type: 'Unlimited Company (Ultd)'
          }
        ]
      })
    }
  },
  {
    method: 'GET',
    path: '/reference/titles',
    handler: async (_, h) => {
      return h.response({
        _data: [
          'Miss',
          'Mr',
          'Mrs',
          'Ms',
          'Dame',
          'Dr',
          'Lady',
          'Lord',
          'Rev',
          'Sir'
        ]
      })
    }
  }
]
