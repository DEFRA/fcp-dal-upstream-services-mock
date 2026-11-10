import { describe, it, beforeAll, beforeEach, afterAll, expect } from 'vitest'

describe('Authorisation create & update (Ticket #29)', () => {
  let mockServer
  const PROCESS_ENV = process.env

  beforeAll(async () => {
    process.env = { ...PROCESS_ENV }
    process.env.PORT = '0' // any free port, so it can't clash with other test files
    const { startServer } = await import('../../../../../src/server.js')
    mockServer = await startServer()
  })

  afterAll(async () => {
    process.env = PROCESS_ENV
    await mockServer?.stop({ timeout: 0 })
  })

  const createPayload = {
    personRoles: [
      {
        role: 'Agent',
        personId: 22222220
      }
    ],
    personPrivileges: [
      {
        personId: 22222220,
        privilegeNames: ['Amend - business', 'Submit - bps']
      }
    ]
  }

  it('POST should create an authorisation when the person is not already linked', async () => {
    // 22222220 exists but is only a customer of org 222222222 (sfd-id-check: allow)
    const { statusCode, payload } = await mockServer.inject({
      method: 'POST',
      url: '/extapi/SitiAgriApi/authorisation/organisation/111111111/authorisation', // sfd-id-check: allow - organisation ID
      headers: { authorization: 'Bearer token' },
      payload: createPayload
    })
    expect(statusCode).toBe(200)
    const body = JSON.parse(payload)
    expect(body).toEqual({ data: null, success: true, errorString: null })
  })

  it('POST should return 409 when the person is already authorised on the organisation', async () => {
    const { statusCode, payload } = await mockServer.inject({
      method: 'POST',
      url: '/extapi/SitiAgriApi/authorisation/organisation/111111111/authorisation', // sfd-id-check: allow - organisation ID
      headers: { authorization: 'Bearer token' },
      payload: {
        personRoles: [
          {
            role: 'Agent',
            personId: 11111111
          }
        ],
        personPrivileges: [
          {
            personId: 11111111,
            privilegeNames: ['Amend - business', 'Submit - bps']
          }
        ]
      }
    })
    expect(statusCode).toBe(409)
    const body = JSON.parse(payload)
    expect(body).toEqual({
      data: null,
      success: false,
      errorString: 'Relation already exists'
    })
  })

  const updatePayload = {
    personRoles: [
      {
        role: 'Agent',
        personId: 11111111
      }
    ],
    personPrivileges: [
      {
        personId: 11111111,
        privilegeNames: ['Amend - land', 'Submit - cs app']
      }
    ]
  }

  it('PUT should update an existing authorisation when called without email header', async () => {
    const { statusCode, payload } = await mockServer.inject({
      method: 'PUT',
      url: '/extapi/SitiAgriApi/authorisation/organisation/111111111/authorisation/person/11111111', // sfd-id-check: allow - organisation ID
      headers: { authorization: 'Bearer token' },
      payload: updatePayload
    })
    expect(statusCode).toBe(200)
    const body = JSON.parse(payload)
    expect(body).toEqual({ data: null, success: true, errorString: null })
  })

  it('PUT should succeed and be idempotent when the same payload is submitted again', async () => {
    // 22222222 is NOT initially linked to org 111111111 — guaranteed clean start (sfd-id-check: allow)
    const payload = {
      personRoles: [{ role: 'Agent', personId: 22222222 }],
      personPrivileges: [
        {
          personId: 22222222,
          privilegeNames: ['Amend - land', 'Submit - cs app']
        }
      ]
    }

    // Create the initial link via POST
    const create = await mockServer.inject({
      method: 'POST',
      url: '/extapi/SitiAgriApi/authorisation/organisation/111111111/authorisation', // sfd-id-check: allow - organisation ID
      headers: { authorization: 'Bearer token' },
      payload
    })
    expect(create.statusCode).toBe(200)

    // PUT with the same payload succeeds (idempotent)
    const first = await mockServer.inject({
      method: 'PUT',
      url: '/extapi/SitiAgriApi/authorisation/organisation/111111111/authorisation/person/22222222', // sfd-id-check: allow - organisation ID
      headers: { authorization: 'Bearer token' },
      payload
    })
    expect(first.statusCode).toBe(200)
    expect(JSON.parse(first.payload)).toEqual({
      data: null,
      success: true,
      errorString: null
    })

    // Second identical PUT also succeeds
    const second = await mockServer.inject({
      method: 'PUT',
      url: '/extapi/SitiAgriApi/authorisation/organisation/111111111/authorisation/person/22222222', // sfd-id-check: allow - organisation ID
      headers: { authorization: 'Bearer token' },
      payload
    })
    expect(second.statusCode).toBe(200)
    expect(JSON.parse(second.payload)).toEqual({
      data: null,
      success: true,
      errorString: null
    })
  })

  describe('path parameter validation', () => {
    const postTo = (orgId) =>
      mockServer.inject({
        method: 'POST',
        url: `/extapi/SitiAgriApi/authorisation/organisation/${orgId}/authorisation`,
        headers: { authorization: 'Bearer token' },
        payload: createPayload
      })

    it.each([
      '-1',
      '+1',
      '1.0',
      '1e3',
      'abc',
      '9'.repeat(21),
      '0000000000000000000001'
    ])(
      'POST should return the upstream 403 HTML when orgId is %s',
      async (orgId) => {
        const { statusCode, payload } = await postTo(encodeURIComponent(orgId))
        expect(statusCode).toBe(403)
        expect(payload).toContain('Request forbidden by administrative rules.')
      }
    )

    it.each(['0', '01', '9223372036854775807', '9'.repeat(20)])(
      'POST should accept orgId %s past validation error and return unknown organisation instead',
      async (orgId) => {
        const { statusCode, payload } = await postTo(orgId)
        expect(statusCode).toBe(404)
        expect(JSON.parse(payload).errorString).toBe('Organisation not found.')
      }
    )

    it('POST should ignore leading zeros in orgId', async () => {
      // as upstream, 0111111111 is org 111111111, on which 11111111 is already authorised (sfd-id-check: allow)
      const { statusCode, payload } = await mockServer.inject({
        method: 'POST',
        url: '/extapi/SitiAgriApi/authorisation/organisation/0111111111/authorisation', // sfd-id-check: allow - organisation ID
        headers: { authorization: 'Bearer token' },
        payload: {
          personRoles: [{ role: 'Agent', personId: 11111111 }],
          personPrivileges: [
            { personId: 11111111, privilegeNames: ['View - business'] }
          ]
        }
      })
      expect(statusCode).toBe(409)
      expect(JSON.parse(payload).errorString).toBe('Relation already exists')
    })

    it('POST and PUT should store a leading-zero orgId and string personId as one authorisation', async () => {
      const authorise = (method, url, privilegeNames) =>
        mockServer.inject({
          method,
          url: `/extapi/SitiAgriApi/authorisation/organisation/${url}`,
          headers: { authorization: 'Bearer token' },
          payload: {
            personRoles: [{ role: 'Agent', personId: '22222225' }],
            personPrivileges: [{ personId: '22222225', privilegeNames }]
          }
        })
      const leadingZeroOrgId = '0111111111' // sfd-id-check: allow - organisation ID
      expect(
        (
          await authorise('POST', `${leadingZeroOrgId}/authorisation`, [
            'View - business'
          ])
        ).statusCode
      ).toBe(200)
      expect(
        (
          await authorise('PUT', '00111111111/authorisation/person/22222225', [
            'Amend - business'
          ])
        ).statusCode
      ).toBe(200)

      const { payload } = await mockServer.inject({
        method: 'GET',
        url: '/extapi/authorisation/organisation/111111111' // sfd-id-check: allow - organisation ID
      })
      const rows = JSON.parse(payload)
        ._data.filter(({ id }) => id === 22222225)
        .map(({ role, privileges }) => ({ role, privileges }))
      expect(rows).toEqual([
        { role: 'Agent', privileges: ['Amend - business'] }
      ])
    })

    it('PUT should return the upstream 403 HTML when orgId is invalid', async () => {
      const { statusCode, payload } = await mockServer.inject({
        method: 'PUT',
        url: '/extapi/SitiAgriApi/authorisation/organisation/-1/authorisation/person/11111111',
        headers: { authorization: 'Bearer token' },
        payload: updatePayload
      })
      expect(statusCode).toBe(403)
      expect(payload).toContain('Request forbidden by administrative rules.')
    })

    it.each(['abc', 'null,null'])(
      'PUT should return the HTML 404 page when personId is %s',
      async (personId) => {
        const { statusCode, headers, payload } = await mockServer.inject({
          method: 'PUT',
          url: `/extapi/SitiAgriApi/authorisation/organisation/111111111/authorisation/person/${encodeURIComponent(personId)}`, // sfd-id-check: allow - person ID
          headers: { authorization: 'Bearer token' },
          payload: updatePayload
        })
        expect(statusCode).toBe(404)
        expect(headers['content-type']).toMatch(/^text\/html/)
        expect(payload).toContain('HTTP Status 404 – Not Found')
      }
    )

    /* sfd-id-check: allow - person ID */ it.each(['+11111111', '0011111111'])(
      'PUT should ignore leading zeros and plus sign in person id (personId %s)',
      async (personId) => {
        const { statusCode } = await mockServer.inject({
          method: 'PUT',
          url: `/extapi/SitiAgriApi/authorisation/organisation/111111111/authorisation/person/${encodeURIComponent(personId)}`, // sfd-id-check: allow - person ID
          headers: { authorization: 'Bearer token' },
          payload: updatePayload
        })
        expect(statusCode).toBe(200)
      }
    )

    it.each(['-1', '0'])(
      'PUT should return 404 when personId is %s',
      async (personId) => {
        const { statusCode } = await mockServer.inject({
          method: 'PUT',
          url: `/extapi/SitiAgriApi/authorisation/organisation/111111111/authorisation/person/${personId}`, // sfd-id-check: allow - person ID
          headers: { authorization: 'Bearer token' },
          payload: updatePayload
        })
        expect(statusCode).toBe(404)
      }
    )
  })

  describe('PUT 404s', () => {
    const put = (orgId, personId, payload) =>
      mockServer.inject({
        method: 'PUT',
        url: `/extapi/SitiAgriApi/authorisation/organisation/${orgId}/authorisation/person/${personId}`,
        headers: { authorization: 'Bearer token' },
        payload
      })

    it.each([
      [
        'personRoles',
        {
          ...updatePayload,
          personRoles: [{ role: 'Agent', personId: 999999999 }] // sfd-id-check: allow - person ID
        }
      ],
      [
        'personPrivileges',
        {
          ...updatePayload,
          personPrivileges: [
            { personId: 999999999, privilegeNames: ['Amend - land'] } // sfd-id-check: allow - person ID
          ]
        }
      ]
    ])(
      'should return 404 Person not found when the %s personId differs from the path',
      async (_, payload) => {
        const { statusCode, payload: body } = await put(
          111111111, // sfd-id-check: allow - organisation ID
          11111111,
          payload
        )
        expect(statusCode).toBe(404)
        expect(JSON.parse(body)).toEqual({
          data: null,
          success: false,
          errorString: 'Person not found.'
        })
      }
    )

    it('should return 404 Organisation not found when the org does not exist', async () => {
      const { statusCode, payload: body } = await put(
        0,
        11111111,
        updatePayload
      )
      expect(statusCode).toBe(404)
      expect(JSON.parse(body)).toEqual({
        data: null,
        success: false,
        errorString: 'Organisation not found.'
      })
    })
  })

  const upstreamError = {
    data: null,
    success: false,
    errorString: 'An error has occurred.'
  }

  describe('PUT links and unlinks', () => {
    // 22222223 exists but is only a customer of org 222222222 (sfd-id-check: allow)
    const url =
      '/extapi/SitiAgriApi/authorisation/organisation/111111111/authorisation/person/22222223' // sfd-id-check: allow - organisation ID
    const linkPayload = {
      personRoles: [{ role: 'Agent', personId: 22222223 }],
      personPrivileges: [
        { personId: 22222223, privilegeNames: ['Amend - land'] }
      ]
    }
    const put = (payload) =>
      mockServer.inject({
        method: 'PUT',
        url,
        headers: { authorization: 'Bearer token' },
        payload
      })
    const customerIds = async () => {
      const { payload } = await mockServer.inject({
        method: 'GET',
        url: '/extapi/authorisation/organisation/111111111', // sfd-id-check: allow - organisation ID
        headers: { email: 'test@defra.gov.uk' }
      })
      return JSON.parse(payload)._data.map(({ id }) => Number(id))
    }

    it('should link a person who is not yet authorised on the organisation', async () => {
      expect(await customerIds()).not.toContain(22222223)
      const { statusCode } = await put(linkPayload)
      expect(statusCode).toBe(200)
      expect(await customerIds()).toContain(22222223)
    })

    it('should return 400 and not unlink when the arrays are omitted', async () => {
      const { statusCode, payload } = await put({})
      expect(statusCode).toBe(400)
      expect(JSON.parse(payload)).toEqual(upstreamError)
      expect(await customerIds()).toContain(22222223)
    })

    it('should unlink when personRoles and personPrivileges are both empty', async () => {
      const { statusCode, payload } = await put({
        personRoles: [],
        personPrivileges: []
      })
      expect(statusCode).toBe(200)
      expect(JSON.parse(payload)).toEqual({
        data: null,
        success: true,
        errorString: null
      })
      expect(await customerIds()).not.toContain(22222223)
    })
  })

  describe('payload validation', () => {
    const inject = (method, url, payload) =>
      mockServer.inject({
        method,
        url: `/extapi/SitiAgriApi/authorisation/organisation/${url}`,
        headers: { authorization: 'Bearer token' },
        payload
      })
    const putUrl = '111111111/authorisation/person/11111111' // sfd-id-check: allow - organisation ID
    const postUrl = '111111111/authorisation' // sfd-id-check: allow - organisation ID

    it.each([
      ['PUT', putUrl, undefined],
      [
        'PUT',
        putUrl,
        { personRoles: [], personPrivileges: [{ privilegeNames: [] }] }
      ],
      [
        'PUT',
        putUrl,
        { personRoles: [{ role: 'Agent' }], personPrivileges: [] }
      ],
      ['POST', postUrl, undefined],
      ['POST', postUrl, {}],
      ['POST', postUrl, { personRoles: createPayload.personRoles }],
      [
        'POST',
        postUrl,
        { personRoles: [], personPrivileges: createPayload.personPrivileges }
      ],
      [
        'POST',
        postUrl,
        { ...createPayload, personPrivileges: [{ privilegeNames: [] }] }
      ]
    ])(
      '%s %s with payload %j should return 500',
      async (method, url, payload) => {
        const { statusCode, payload: body } = await inject(method, url, payload)
        expect(statusCode).toBe(500)
        expect(JSON.parse(body)).toEqual(upstreamError)
      }
    )

    it.each([[{}], [{ personRoles: [] }], [{ personPrivileges: [] }]])(
      'PUT with payload %j should return 400',
      async (payload) => {
        const { statusCode, payload: body } = await inject(
          'PUT',
          putUrl,
          payload
        )
        expect(statusCode).toBe(400)
        expect(JSON.parse(body)).toEqual(upstreamError)
      }
    )

    it('PUT should check the person exists before the payload', async () => {
      const { statusCode, payload } = await inject(
        'PUT',
        '111111111/authorisation/person/1', // sfd-id-check: allow - organisation ID
        {}
      )
      expect(statusCode).toBe(404)
      expect(JSON.parse(payload).errorString).toBe('Person not found.')
    })
  })

  describe('PUT with multiple entries', () => {
    const url =
      '/extapi/SitiAgriApi/authorisation/organisation/111111111/authorisation/person/11111111' // sfd-id-check: allow - organisation ID
    const put = (payload) =>
      mockServer.inject({
        method: 'PUT',
        url,
        headers: { authorization: 'Bearer token' },
        payload
      })
    const rows = async () => {
      const { payload } = await mockServer.inject({
        method: 'GET',
        url: '/extapi/authorisation/organisation/111111111' // sfd-id-check: allow - organisation ID
      })
      return JSON.parse(payload)
        ._data.filter(({ id }) => id === 11111111)
        .map(({ role, privileges }) => ({ role, privileges }))
    }

    it('should return 409 when personRoles repeats an entry', async () => {
      const { statusCode, payload } = await put({
        personRoles: [
          { role: 'Agent', personId: 11111111 },
          { role: 'Agent', personId: 11111111 }
        ],
        personPrivileges: []
      })
      expect(statusCode).toBe(409)
      expect(JSON.parse(payload)).toEqual({
        data: null,
        success: false,
        errorString: 'Relation already exists'
      })
    })

    it('should link the person once per role, each with the combined privileges', async () => {
      const { statusCode } = await put({
        personRoles: [
          { role: 'Agent', personId: 11111111 },
          { role: 'Helper', personId: 11111111 }
        ],
        personPrivileges: [
          { personId: 11111111, privilegeNames: ['Amend - land'] },
          {
            personId: 11111111,
            privilegeNames: ['Submit - bps', 'Amend - land']
          }
        ]
      })
      expect(statusCode).toBe(200)
      const privileges = [
        'Amend - land',
        'AMEND - LAND - SA',
        'Submit - bps',
        'SUBMIT - BPS - SA'
      ]
      // as upstream, each row lists the privileges once per role
      expect(await rows()).toEqual([
        { role: 'Agent', privileges: [...privileges, ...privileges] },
        { role: 'Helper', privileges: [...privileges, ...privileges] }
      ])
    })

    it('should replace the roles with those sent', async () => {
      const { statusCode } = await put({
        personRoles: [{ role: 'Agent', personId: 11111111 }],
        personPrivileges: [
          { personId: 11111111, privilegeNames: ['Submit - bps'] }
        ]
      })
      expect(statusCode).toBe(200)
      expect(await rows()).toEqual([
        { role: 'Agent', privileges: ['Submit - bps', 'SUBMIT - BPS - SA'] }
      ])
    })
  })

  describe('POST lookups and multiple entries', () => {
    const post = (orgId, payload) =>
      mockServer.inject({
        method: 'POST',
        url: `/extapi/SitiAgriApi/authorisation/organisation/${orgId}/authorisation`,
        headers: { authorization: 'Bearer token' },
        payload
      })
    const bodyForPerson = (personId, roles, privilegeNames) => ({
      personRoles: roles.map((role) => ({ role, personId })),
      personPrivileges: [{ personId, privilegeNames }]
    })

    it('should return 404 Person not found before checking the organisation', async () => {
      const { statusCode, payload } = await post(
        0,
        bodyForPerson(1, ['Agent'], [])
      )
      expect(statusCode).toBe(404)
      expect(JSON.parse(payload)).toEqual({
        data: null,
        success: false,
        errorString: 'Person not found.'
      })
    })

    it('should return 404 Organisation not found for a known person', async () => {
      const { statusCode, payload } = await post(
        0,
        bodyForPerson(22222224, ['Agent'], [])
      )
      expect(statusCode).toBe(404)
      expect(JSON.parse(payload)).toEqual({
        data: null,
        success: false,
        errorString: 'Organisation not found.'
      })
    })

    it('should return 409 when personRoles repeats an entry', async () => {
      const { statusCode } = await post(
        111111111, // sfd-id-check: allow - organisation ID
        bodyForPerson(22222224, ['Agent', 'Agent'], [])
      )
      expect(statusCode).toBe(409)
    })

    it('should link the person once per role, each with the combined privileges', async () => {
      const orgId = 111111111 // sfd-id-check: allow - organisation ID
      const { statusCode } = await post(orgId, {
        ...bodyForPerson(22222224, ['Agent', 'Helper'], ['Amend - land']),
        personPrivileges: [
          { personId: 22222224, privilegeNames: ['Amend - land'] },
          { personId: 22222224, privilegeNames: ['Submit - bps'] }
        ]
      })
      expect(statusCode).toBe(200)
      const { payload } = await mockServer.inject({
        method: 'GET',
        url: '/extapi/authorisation/organisation/111111111' // sfd-id-check: allow - organisation ID
      })
      const rows = JSON.parse(payload)
        ._data.filter(({ id }) => id === 22222224)
        .map(({ role, privileges }) => ({ role, privileges }))
      const privileges = [
        'Amend - land',
        'AMEND - LAND - SA',
        'Submit - bps',
        'SUBMIT - BPS - SA'
      ]
      // as upstream, each row lists the privileges once per role
      expect(rows).toEqual([
        { role: 'Agent', privileges: [...privileges, ...privileges] },
        { role: 'Helper', privileges: [...privileges, ...privileges] }
      ])
    })

    it.each([
      [
        'personRoles',
        {
          personRoles: [
            { role: 'Agent', personId: 22222224 },
            { role: 'Agent', personId: 1 }
          ],
          personPrivileges: []
        }
      ],
      [
        'personPrivileges',
        {
          personRoles: [{ role: 'Agent', personId: 22222224 }],
          personPrivileges: [{ personId: 1, privilegeNames: [] }]
        }
      ]
    ])(
      'should return 400 for a second person in %s, before looking anything up',
      async (_, payload) => {
        const { statusCode, payload: body } = await post(0, payload)
        expect(statusCode).toBe(400)
        expect(JSON.parse(body)).toEqual(upstreamError)
      }
    )
  })

  describe('unrecognised fields', () => {
    const urls = {
      POST: '/extapi/SitiAgriApi/authorisation/organisation/111111111/authorisation', // sfd-id-check: allow - organisation ID
      PUT: '/extapi/SitiAgriApi/authorisation/organisation/111111111/authorisation/person/11111111' // sfd-id-check: allow - organisation ID
    }
    const role = { role: 'Agent', personId: 11111111 }
    const privilege = { personId: 11111111, privilegeNames: ['Amend - land'] }

    it.each(
      ['POST', 'PUT'].flatMap((method) => [
        [
          method,
          'body',
          { personRoles: [role], personPrivileges: [privilege], x: 1 }
        ],
        [
          method,
          'personRoles',
          { personRoles: [{ ...role, x: 1 }], personPrivileges: [privilege] }
        ],
        [
          method,
          'personPrivileges',
          { personRoles: [role], personPrivileges: [{ ...privilege, x: 1 }] }
        ]
      ])
    )(
      '%s should return a plain-text 400 naming the field in %s',
      async (method, where, payload) => {
        const {
          statusCode,
          headers,
          payload: body
        } = await mockServer.inject({
          method,
          url: urls[method],
          headers: { authorization: 'Bearer token' },
          payload
        })
        expect(statusCode).toBe(400)
        expect(headers['content-type']).toMatch(/^text\/plain/)
        expect(body).toBe(`Unrecognized field "x" in ${where}`)
      }
    )
  })

  describe('privilege names', () => {
    const put = (privilegeNames) =>
      mockServer.inject({
        method: 'PUT',
        url: '/extapi/SitiAgriApi/authorisation/organisation/111111111/authorisation/person/11111111', // sfd-id-check: allow - organisation ID
        headers: { authorization: 'Bearer token' },
        payload: {
          personRoles: [{ role: 'Agent', personId: 11111111 }],
          personPrivileges: [{ personId: 11111111, privilegeNames }]
        }
      })
    const privileges = async () => {
      const { payload } = await mockServer.inject({
        method: 'GET',
        url: '/extapi/authorisation/organisation/111111111' // sfd-id-check: allow - organisation ID
      })
      return JSON.parse(payload)._data.find(({ id }) => id === 11111111)
        .privileges
    }

    it.each([
      [
        'adds the "- SA" counterpart of each scheme privilege',
        [
          'View - land',
          'NO ACCESS - BPS',
          'Submit - cs agree',
          'Amend - entitlement'
        ],
        [
          'View - land',
          'VIEW - LAND - SA',
          'NO ACCESS - BPS',
          'NO ACCESS - BPS - SA',
          'Submit - cs agree',
          'SUBMIT - CS AGREE - SA',
          'Amend - entitlement',
          'AMEND - ENTITLEMENT - SA'
        ]
      ],
      [
        'adds nothing for business and ELM privileges',
        [
          'View - business',
          'Full permission - business',
          'ELM_APPLICATION_SUBMIT'
        ],
        [
          'View - business',
          'Full permission - business',
          'ELM_APPLICATION_SUBMIT'
        ]
      ],
      [
        'keeps a "- SA" privilege on its own',
        ['AMEND - LAND - SA'],
        ['AMEND - LAND - SA']
      ],
      [
        'does not repeat a "- SA" privilege already sent',
        ['Amend - land', 'AMEND - LAND - SA'],
        ['Amend - land', 'AMEND - LAND - SA']
      ],
      [
        'matches names case-insensitively, storing upstream spelling',
        ['amend - LAND', 'VIEW - CS APP', 'amend - bps - sa'],
        [
          'Amend - land',
          'AMEND - LAND - SA',
          'View - cs app',
          'VIEW - CS APP - SA',
          'AMEND - BPS - SA'
        ]
      ]
    ])('should %s', async (_, sent, stored) => {
      const { statusCode } = await put(sent)
      expect(statusCode).toBe(200)
      expect(await privileges()).toEqual(stored)
    })

    it('should return 500 and change nothing for an unknown privilege', async () => {
      await put(['View - business'])
      const { statusCode, payload } = await put(['Not a privilege'])
      expect(statusCode).toBe(500)
      expect(JSON.parse(payload).errorString).toBe('An error has occurred.')
      expect(await privileges()).toEqual(['View - business'])
    })
  })

  describe('roles', () => {
    const authorise = (method, path, personId, roleEntry) =>
      mockServer.inject({
        method,
        url: `/extapi/SitiAgriApi/authorisation/organisation/111111111/${path}`, // sfd-id-check: allow - organisation ID
        headers: { authorization: 'Bearer token' },
        payload: {
          personRoles: [{ personId, ...roleEntry }],
          personPrivileges: [{ personId, privilegeNames: ['Amend - land'] }]
        }
      })
    const rows = async (personId) => {
      const { payload } = await mockServer.inject({
        method: 'GET',
        url: '/extapi/authorisation/organisation/111111111' // sfd-id-check: allow - organisation ID
      })
      return JSON.parse(payload)
        ._data.filter(({ id }) => id === personId)
        .map(({ role, privileges }) => ({ role, privileges }))
    }
    const missingRoles = [
      ['missing', {}],
      ['null', { role: null }],
      ['empty', { role: '' }]
    ]

    it.each(missingRoles)(
      'POST should return 500 and not link the person when the role is %s',
      async (_, roleEntry) => {
        // 22222226 exists but is only a customer of org 222222222 (sfd-id-check: allow)
        const { statusCode, payload } = await authorise(
          'POST',
          'authorisation',
          22222226,
          roleEntry
        )
        expect(statusCode).toBe(500)
        expect(JSON.parse(payload).errorString).toBe('An error has occurred.')
        expect(await rows(22222226)).toEqual([])
      }
    )

    it('POST should report a missing role before an existing link', async () => {
      const { statusCode } = await authorise(
        'POST',
        'authorisation',
        11111111,
        {}
      )
      expect(statusCode).toBe(500)
    })

    it.each(missingRoles)(
      'PUT should return 500 and keep the existing roles when the role is %s',
      async (_, roleEntry) => {
        const path = 'authorisation/person/22222227'
        await authorise('PUT', path, 22222227, { role: 'Agent' })
        const before = await rows(22222227)
        const { statusCode } = await authorise('PUT', path, 22222227, roleEntry)
        expect(statusCode).toBe(500)
        expect(await rows(22222227)).toEqual(before)
      }
    )

    it('should accept a role name it cannot check against upstream', async () => {
      const { statusCode } = await authorise(
        'POST',
        'authorisation',
        22222228,
        { role: 'Bogus' }
      )
      expect(statusCode).toBe(200)
      expect(await rows(22222228)).toEqual([
        { role: 'Bogus', privileges: ['Amend - land', 'AMEND - LAND - SA'] }
      ])
    })
  })

  describe('DELETE', () => {
    // 22222221 and 22222229 exist but are only customers of org 222222222 (sfd-id-check: allow)
    const url =
      '/extapi/SitiAgriApi/authorisation/organisation/111111111/authorisation' // sfd-id-check: allow - organisation ID
    const remove = (
      payload,
      orgId = 111111111 // sfd-id-check: allow - organisation ID
    ) =>
      mockServer.inject({
        method: 'DELETE',
        url: `/extapi/SitiAgriApi/authorisation/organisation/${orgId}/authorisation`,
        headers: { authorization: 'Bearer token' },
        payload
      })
    const put = (personId, roles, privilegeNames) =>
      mockServer.inject({
        method: 'PUT',
        url: `${url}/person/${personId}`,
        headers: { authorization: 'Bearer token' },
        payload: {
          personRoles: roles.map((role) => ({ role, personId })),
          personPrivileges: [{ personId, privilegeNames }]
        }
      })
    // the person's roles and privileges on org 111111111, from its customer rows (sfd-id-check: allow)
    const authorisation = async (personId) => {
      const { payload } = await mockServer.inject({
        method: 'GET',
        url: '/extapi/authorisation/organisation/111111111' // sfd-id-check: allow - organisation ID
      })
      const rows = JSON.parse(payload)._data.filter(({ id }) => id === personId)
      return {
        roles: rows.map(({ role }) => role),
        privileges: [...new Set(rows.flatMap(({ privileges }) => privileges))]
      }
    }
    const success = { data: null, success: true, errorString: null }
    const entityNotFound = {
      data: null,
      success: false,
      errorString: 'Entity not found.'
    }
    const unlinked = { roles: [], privileges: [] }
    const initial = {
      22222221: {
        roles: ['Agent', 'Business Partner'],
        privileges: ['Amend - land', 'AMEND - LAND - SA', 'View - business']
      },
      22222229: {
        roles: ['Agent'],
        privileges: ['View - business', 'Submit - bps', 'SUBMIT - BPS - SA']
      }
    }

    beforeEach(async () => {
      await put(
        22222221,
        ['Agent', 'Business Partner'],
        ['Amend - land', 'View - business']
      )
      await put(22222229, ['Agent'], ['View - business', 'Submit - bps'])
    })

    it('should remove a role, keeping the others and the privileges', async () => {
      const { statusCode, payload } = await remove({
        personRoles: [{ role: 'Business Partner', personId: 22222221 }],
        personPrivileges: []
      })
      expect(statusCode).toBe(200)
      expect(JSON.parse(payload)).toEqual(success)
      expect(await authorisation(22222221)).toEqual({
        ...initial[22222221],
        roles: ['Agent']
      })
    })

    it('should unlink the person when their last role is removed', async () => {
      const { statusCode } = await remove({
        personRoles: [
          { role: 'Agent', personId: 22222221 },
          { role: 'Business Partner', personId: 22222221 }
        ],
        personPrivileges: []
      })
      expect(statusCode).toBe(200)
      expect(await authorisation(22222221)).toEqual(unlinked)
    })

    it('should remove only the privileges when personRoles is empty', async () => {
      const { statusCode } = await remove({
        personRoles: [],
        personPrivileges: [
          { personId: 22222221, privilegeNames: ['Amend - land'] }
        ]
      })
      expect(statusCode).toBe(200)
      expect(await authorisation(22222221)).toEqual({
        roles: ['Agent', 'Business Partner'],
        privileges: ['View - business']
      })
    })

    it('should remove different roles and privileges for different people', async () => {
      const { statusCode } = await remove({
        personRoles: [
          { role: 'Agent', personId: 22222221 },
          { role: 'Agent', personId: 22222229 }
        ],
        personPrivileges: [
          { personId: 22222221, privilegeNames: ['View - business'] }
        ]
      })
      expect(statusCode).toBe(200)
      expect(await authorisation(22222221)).toEqual({
        roles: ['Business Partner'],
        privileges: ['Amend - land', 'AMEND - LAND - SA']
      })
      expect(await authorisation(22222229)).toEqual(unlinked)
    })

    it('should match a personId sent as a string', async () => {
      const { statusCode } = await remove({
        personRoles: [{ role: 'Business Partner', personId: '22222221' }],
        personPrivileges: [
          { personId: '22222221', privilegeNames: ['View - business'] }
        ]
      })
      expect(statusCode).toBe(200)
      expect(await authorisation(22222221)).toEqual({
        roles: ['Agent'],
        privileges: ['Amend - land', 'AMEND - LAND - SA']
      })
    })

    it.each([
      [
        'a privilege the person does not hold',
        [{ personId: 22222221, privilegeNames: ['View - land'] }]
      ],
      ['no privileges', []]
    ])(
      'should succeed and change nothing for %s',
      async (_, personPrivileges) => {
        const { statusCode, payload } = await remove({
          personRoles: [],
          personPrivileges
        })
        expect(statusCode).toBe(200)
        expect(JSON.parse(payload)).toEqual(success)
        expect(await authorisation(22222221)).toEqual(initial[22222221])
      }
    )

    it('should return 404 and change nothing for a role the person does not have', async () => {
      const { statusCode, payload } = await remove({
        personRoles: [{ role: 'Business Partner', personId: 22222229 }],
        personPrivileges: []
      })
      expect(statusCode).toBe(404)
      expect(JSON.parse(payload)).toEqual(entityNotFound)
      expect(await authorisation(22222229)).toEqual(initial[22222229])
    })

    it('should return 404 and change no one when any person lacks the role', async () => {
      const { statusCode, payload } = await remove({
        personRoles: [
          { role: 'Business Partner', personId: 22222221 },
          { role: 'Business Partner', personId: 22222229 }
        ],
        personPrivileges: [
          { personId: 22222221, privilegeNames: ['View - business'] }
        ]
      })
      expect(statusCode).toBe(404)
      expect(JSON.parse(payload)).toEqual(entityNotFound)
      expect(await authorisation(22222221)).toEqual(initial[22222221])
      expect(await authorisation(22222229)).toEqual(initial[22222229])
    })

    it('should return 404 for a person not linked to the organisation', async () => {
      await remove({
        personRoles: [{ role: 'Agent', personId: 22222229 }],
        personPrivileges: []
      })
      const { statusCode, payload } = await remove({
        personRoles: [{ role: 'Agent', personId: 22222229 }],
        personPrivileges: []
      })
      expect(statusCode).toBe(404)
      expect(JSON.parse(payload)).toEqual(entityNotFound)
    })

    it('should return 500 and change nothing for an unknown privilege', async () => {
      const { statusCode, payload } = await remove({
        personRoles: [],
        personPrivileges: [
          { personId: 22222221, privilegeNames: ['Not a privilege'] }
        ]
      })
      expect(statusCode).toBe(500)
      expect(JSON.parse(payload)).toEqual(upstreamError)
      expect(await authorisation(22222221)).toEqual(initial[22222221])
    })

    it('should return 400 when the arrays are omitted', async () => {
      const { statusCode, payload } = await remove({})
      expect(statusCode).toBe(400)
      expect(JSON.parse(payload)).toEqual(upstreamError)
      expect(await authorisation(22222221)).toEqual(initial[22222221])
    })

    it('should return 404 Person not found for an unknown person', async () => {
      const { statusCode, payload } = await remove({
        personRoles: [{ role: 'Agent', personId: 999999999 }], // sfd-id-check: allow - person ID
        personPrivileges: []
      })
      expect(statusCode).toBe(404)
      expect(JSON.parse(payload)).toEqual({
        data: null,
        success: false,
        errorString: 'Person not found.'
      })
    })

    it('should return 404 Organisation not found when the org does not exist', async () => {
      const { statusCode, payload } = await remove(
        {
          personRoles: [{ role: 'Agent', personId: 22222221 }],
          personPrivileges: []
        },
        0
      )
      expect(statusCode).toBe(404)
      expect(JSON.parse(payload)).toEqual({
        data: null,
        success: false,
        errorString: 'Organisation not found.'
      })
    })
  })
})
