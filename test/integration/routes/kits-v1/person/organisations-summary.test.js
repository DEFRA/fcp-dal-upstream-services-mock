import Hapi from '@hapi/hapi'
import { emulateUpstreamErrors } from '../../../../../src/common/helpers/fail-action.js'
import { person } from '../../../../../src/routes/kits-v1/person.js'

// expected responses are what upstream (KITS upgrade) returned for the same kinds of request
describe('GET /organisation/person/{personId}/summary', () => {
  // linked to 5 organisations, with these sbis (from the sfd test data)
  const personId = '3011014'
  const sbis = [860900001, 860900002, 860900003, 860900004, 860900005]
  // not in the mock data
  const unknownPersonId = '99999999'
  // linked to 2 organisations with different names
  const namedPersonId = '11111222'
  let server

  const summary = (query, id = personId) =>
    server.inject({
      method: 'GET',
      url: `/organisation/person/${id}/summary${query}`
    })

  const names = (payload) =>
    JSON.parse(payload)._data.map(({ name }) => name.toLowerCase())

  beforeAll(async () => {
    server = Hapi.server()
    server.route(person)
    server.ext('onPreResponse', emulateUpstreamErrors)
    await server.initialize()
  })

  it('should return the first page of 20 by default', async () => {
    // arrange / act
    const { statusCode, payload } = await summary('?search=')

    // assert
    expect(statusCode).toBe(200)
    const { _data, _page } = JSON.parse(payload)
    expect(_data).toHaveLength(5)
    expect(_page).toEqual({
      number: 1,
      size: 20,
      totalPages: 1,
      numberOfElements: 5,
      totalElements: 5
    })
  })

  it('should return the requested page', async () => {
    // arrange / act
    const { statusCode, payload } = await summary(
      '?search=&page-size=2&page=3&sort-by=sbi'
    )

    // assert
    expect(statusCode).toBe(200)
    const { _data, _page } = JSON.parse(payload)
    expect(_data.map(({ sbi }) => sbi)).toEqual([sbis[4]])
    expect(_page).toEqual({
      number: 3,
      size: 2,
      totalPages: 3,
      numberOfElements: 1,
      totalElements: 5
    })
  })

  it.each([
    ['', 'asc'],
    ['&order=', 'asc'],
    ['&order=asc', 'asc'],
    ['&order=desc', 'desc'],
    ['&order=ASC', 'desc'],
    ['&order=bogus', 'desc'],
    ['&sort-by=name&order=desc', 'desc'],
    ['&sort-by=', 'asc']
  ])('should sort by name ignoring case for %j', async (query, order) => {
    // arrange
    const { payload: unsorted } = await summary('?search=', namedPersonId)
    const sorted = names(unsorted).sort()

    // act
    const { statusCode, payload } = await summary(
      `?search=${query}`,
      namedPersonId
    )

    // assert
    expect(statusCode).toBe(200)
    expect(names(payload)).toEqual(order === 'asc' ? sorted : sorted.reverse())
  })

  it.each([
    ['&sort-by=sbi', sbis],
    ['&sort-by=sbi&order=desc', sbis.toReversed()]
  ])('should sort by sbi for %j', async (query, expected) => {
    // arrange / act
    const { statusCode, payload } = await summary(`?search=${query}`)

    // assert
    expect(statusCode).toBe(200)
    expect(JSON.parse(payload)._data.map(({ sbi }) => sbi)).toEqual(expected)
  })

  it.each([
    ['part of an sbi', `${sbis[2]}`.slice(2), 1],
    ['part of the name, in another case', 'CLEAN CON', 5],
    ['the person id', personId, 0],
    ['padding around a word', ' clean ', 0]
  ])('should search for %s', async (_, search, expected) => {
    // arrange / act
    const { statusCode, payload } = await summary(
      `?search=${encodeURIComponent(search)}`
    )

    // assert
    expect(statusCode).toBe(200)
    expect(JSON.parse(payload)._page.totalElements).toBe(expected)
  })

  it('should return an empty page past the end when nothing matches', async () => {
    // arrange / act
    const { statusCode, payload } = await summary('?search=zzzz&page=2')

    // assert
    expect(statusCode).toBe(200)
    expect(JSON.parse(payload)).toEqual({
      _data: [],
      _page: {
        number: 2,
        size: 20,
        totalPages: 0,
        numberOfElements: 0,
        totalElements: 0
      }
    })
  })

  it.each([
    ['search is missing', '', personId],
    ['search is missing, before page-size', '?page-size=0', personId],
    ['the person does not exist', '?search=', unknownPersonId],
    [
      'the person does not exist, before page-size',
      '?search=&page-size=0',
      unknownPersonId
    ]
  ])('should return a 500 when %s', async (_, query, id) => {
    // arrange / act
    const { statusCode, payload } = await summary(query, id)

    // assert
    expect(statusCode).toBe(500)
    expect(JSON.parse(payload)).toEqual({
      code: 500,
      message: 'HTTP 500 Internal Server Error'
    })
  })

  it.each([
    ['page is 0', '?search=&page=0'],
    ['page is past the last page', '?search=&page-size=2&page=4']
  ])('should return a logged 500 when %s', async (_, query) => {
    // arrange / act
    const { statusCode, payload } = await summary(query)

    // assert
    expect(statusCode).toBe(500)
    expect(JSON.parse(payload).message).toMatch(
      /^There was an error processing your request\. It has been logged/
    )
  })

  it.each([
    ['?search=&page-size=0'],
    ['?search=&page-size=-1'],
    ['?search=&page-size=0&page=0']
  ])('should return a text 400 for %j', async (query) => {
    // arrange / act
    const { statusCode, headers, payload } = await summary(query)

    // assert
    expect(statusCode).toBe(400)
    expect(headers['content-type']).toMatch(/^text\/plain/)
    expect(payload).toBe('Size must be greater than 0')
  })

  it.each([
    ['?search=&sort-by=bogus'],
    ['?search=&sort-by=NAME'],
    ['?sort-by=bogus'],
    ['?search=&page-size=0&sort-by=bogus']
  ])('should return a json 400 for %j', async (query) => {
    // arrange / act
    const { statusCode, payload } = await summary(query, unknownPersonId)

    // assert
    expect(statusCode).toBe(400)
    expect(JSON.parse(payload)).toEqual({
      code: 400,
      message: 'HTTP 400 Bad Request'
    })
  })

  it.each([
    ['?search=&page-size=abc'],
    ['?search=&page-size=1.5'],
    [`?search=&page-size=${2 ** 31}`],
    ['?search=&page=abc'],
    ['?search=&page-size=abc&sort-by=bogus']
  ])('should return a 404 for %j', async (query) => {
    // arrange / act
    const { statusCode, payload } = await summary(query)

    // assert
    expect(statusCode).toBe(404)
    expect(JSON.parse(payload)).toEqual({
      code: 404,
      message: 'HTTP 404 Not Found'
    })
  })

  it.each([['abc'], ['-1']])(
    'should return the waf 403 for personId %s',
    async (id) => {
      // arrange / act
      const { statusCode, headers } = await summary('?search=', id)

      // assert
      expect(statusCode).toBe(403)
      expect(headers['content-type']).toMatch(/^text\/html/)
    }
  )
})
