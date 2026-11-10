import fs from 'node:fs'
import { faker } from './common.js'
import { orgIdLookup } from './id-lookups.js'

const validGeometries = JSON.parse(
  // Generated using scripts/generate_geometries.sh
  fs.readFileSync(new URL('./valid-geometries.json', import.meta.url))
)
export const getLandParcels = (
  orgId,
  parcelOverrides = Array.from({
    length: faker.number.int({ min: 0, max: 10 })
  })
) => {
  if (orgIdLookup[orgId]?.land !== undefined) {
    return orgIdLookup[orgId]?.land?.parcels || []
  }

  const fakeLandParcels = parcelOverrides.map(
    ({ properties, ...rest } = {}) => {
      return {
        id: faker.number.int({ min: 1000000, max: 9999999 }),
        properties: {
          area: faker.number.float({ min: 0, max: 1000000 }),
          pendingDigitisation: faker.datatype.boolean(0.1),
          sheetId: faker.string.alpha({ length: 6 }).toUpperCase(),
          parcelId: faker.string.numeric({ length: 4 }),
          ...properties
        },
        uses: Array.from({ length: faker.number.int({ min: 0, max: 10 }) }).map(
          () => ({
            lu_code: faker.string.alpha({ length: 5 }).toUpperCase()
          })
        ),
        geometry: faker.helpers.arrayElement(validGeometries),
        covers: Array.from({
          length: faker.number.int({ min: 0, max: 10 })
        }).map(() => ({
          id: faker.number.int({ min: 1000000, max: 9999999 }),
          properties: {
            area: faker.number.float({ min: 0, max: 1000000 }),
            code: faker.string.numeric({ length: 3 }),
            name: faker.lorem.word(),
            isBpsEligible: faker.datatype.boolean(0.1)
          },
          type: 'Feature',
          geometry: faker.helpers.arrayElement(validGeometries)
        })),
        ...rest
      }
    }
  )

  return fakeLandParcels
}

export const getLandCovers = (
  orgId,
  coverOverrides = Array.from({ length: faker.number.int({ min: 0, max: 10 }) })
) => {
  if (orgIdLookup[orgId]?.land?.covers !== undefined) {
    return orgIdLookup[orgId]?.land?.covers
  }

  const fakeLandCovers = coverOverrides.map((coverOverride = {}) => ({
    id: faker.number.int({ min: 1000000, max: 9999999 }),
    properties: {
      area: faker.number.float({ min: 0, max: 1000000 }),
      code: faker.string.numeric({ length: 3 }),
      name: faker.lorem.word(),
      isBpsEligible: faker.datatype.boolean(0.1)
    },
    type: 'Feature',
    geometry: faker.helpers.arrayElement(validGeometries),
    ...coverOverride
  }))

  return fakeLandCovers
}
