import Hapi from '@hapi/hapi'
import {
  internalUser,
  matchingPersonIds
} from '../../../src/routes/kits-v1/internal-user.js'

vi.mock('../../../src/factories/person/person.factory.js', () => ({
  allPeople: () => [
    { id: 1, email: 'shared@the-mock.net', emailValidated: true },
    { id: 2, email: 'shared@the-mock.net', emailValidated: true }
  ]
}))

const people = [
  { id: 1, email: 'one@example.com', emailValidated: true },
  { id: 2, email: 'two@example.com', emailValidated: true },
  { id: 3, email: 'TWO@example.com', emailValidated: true },
  { id: 4, email: null },
  { id: 5 },
  { id: 6, email: 'unvalidated@example.com', emailValidated: false }
]

describe('internal-user route - matchingPersonIds', () => {
  it('returns the ids of people with a matching email', () => {
    expect(matchingPersonIds(people, 'one@example.com')).toEqual([1])
  })

  it('matches case-insensitively, like the upstream', () => {
    expect(matchingPersonIds(people, 'ONE@EXAMPLE.COM')).toEqual([1])
  })

  it('returns every id when more than one person shares the email', () => {
    expect(matchingPersonIds(people, 'two@example.com')).toEqual([2, 3])
  })

  it('returns no ids when nobody matches, ignoring people without an email', () => {
    expect(matchingPersonIds(people, 'nobody@example.com')).toEqual([])
    expect(matchingPersonIds(people, '')).toEqual([])
  })

  it('ignores people whose email is not validated, like /person/{email}/validateEmail', () => {
    expect(matchingPersonIds(people, 'unvalidated@example.com')).toEqual([])
  })
})

describe('internal-user route - POST /authorisation/user with a duplicated email', () => {
  let server
  beforeAll(async () => {
    server = Hapi.server()
    server.route(internalUser)
    await server.initialize()
  })

  it('returns 422 when more than one person has the email, like the upstream documents', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/authorisation/user',
      payload: 'shared@the-mock.net'
    })

    expect(response.statusCode).toBe(422)
    expect(JSON.parse(response.payload)).toEqual({
      code: 422,
      message: 'There is more than one person with email.'
    })
  })
})
