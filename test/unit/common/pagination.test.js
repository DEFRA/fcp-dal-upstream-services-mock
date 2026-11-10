import { paginate } from '../../../src/factories/common.js'

describe('paginate', () => {
  const items = [1, 2, 3, 4, 5]

  test('returns the requested page slice and zero-indexed metadata', () => {
    expect(paginate(items, 2, 2)).toEqual({
      data: [3, 4],
      page: {
        number: 1,
        size: 2,
        totalPages: 3,
        numberOfElements: 2,
        totalElements: 5
      }
    })
  })

  test('returns the first page', () => {
    expect(paginate(items, 0, 2)).toEqual({
      data: [1, 2],
      page: {
        number: 0,
        size: 2,
        totalPages: 3,
        numberOfElements: 2,
        totalElements: 5
      }
    })
  })

  test('returns a partial last page', () => {
    expect(paginate(items, 4, 2)).toEqual({
      data: [5],
      page: {
        number: 2,
        size: 2,
        totalPages: 3,
        numberOfElements: 1,
        totalElements: 5
      }
    })
  })

  test('returns an empty page past the end while keeping the total', () => {
    expect(paginate(items, 10, 2)).toEqual({
      data: [],
      page: {
        number: 5,
        size: 2,
        totalPages: 3,
        numberOfElements: 0,
        totalElements: 5
      }
    })
  })

  test('returns everything as a single page when no limit is given', () => {
    expect(paginate(items)).toEqual({
      data: items,
      page: {
        number: 0,
        size: 5,
        totalPages: 1,
        numberOfElements: 5,
        totalElements: 5
      }
    })
  })

  test('handles an empty result set', () => {
    expect(paginate([], 0, 20)).toEqual({
      data: [],
      page: {
        number: 0,
        size: 20,
        totalPages: 0,
        numberOfElements: 0,
        totalElements: 0
      }
    })
  })

  test('ignores non-positive offset and limit', () => {
    expect(paginate(items, -3, 0)).toEqual({
      data: items,
      page: {
        number: 0,
        size: 5,
        totalPages: 1,
        numberOfElements: 5,
        totalElements: 5
      }
    })
  })
})
