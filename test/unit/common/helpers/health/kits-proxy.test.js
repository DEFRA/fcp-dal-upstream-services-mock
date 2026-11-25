import { config } from '../../../../../src/config.js'
import {
  validateKitsProxyConfig,
  checkInternalGateway,
  checkExternalGateway
} from '../../../../../src/common/helpers/health/kits-proxy.js'

describe('validateKitsProxyConfig', () => {
  const validConfig = {
    'kitsProxy.internal.gatewayUrl': 'https://internal.example.test',
    'kitsProxy.internal.connectionCert': 'test-cert',
    'kitsProxy.internal.connectionKey': 'test-key',
    'kitsProxy.internal.healthCheckEmail': 'healthcheck@example.test',
    'kitsProxy.external.gatewayUrl': 'https://external.example.test',
    'kitsProxy.external.connectionCert': 'test-cert',
    'kitsProxy.external.connectionKey': 'test-key',
    'kitsProxy.gatewayTimeoutMs': 30000
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should pass when all required configuration is present', () => {
    vi.spyOn(config, 'get').mockImplementation((path) => validConfig[path])

    expect(() => validateKitsProxyConfig()).not.toThrow()
  })

  test('should fail when the health check email is missing', () => {
    vi.spyOn(config, 'get').mockImplementation((path) => {
      if (path === 'kitsProxy.internal.healthCheckEmail') {
        return null
      }

      return validConfig[path]
    })

    expect(() => validateKitsProxyConfig()).toThrow(
      'Missing required KITS proxy configuration: KITS_INTERNAL_HEALTHCHECK_EMAIL'
    )
  })

  test('should fail when a gateway URL is not HTTPS', () => {
    vi.spyOn(config, 'get').mockImplementation((path) => {
      if (path === 'kitsProxy.internal.gatewayUrl') {
        return 'http://internal.example.test'
      }

      return validConfig[path]
    })

    expect(() => validateKitsProxyConfig()).toThrow(
      'Invalid KITS internal gateway URL'
    )
  })

  test('should fail when the gateway timeout is invalid', () => {
    vi.spyOn(config, 'get').mockImplementation((path) => {
      if (path === 'kitsProxy.gatewayTimeoutMs') {
        return 0
      }

      return validConfig[path]
    })

    expect(() => validateKitsProxyConfig()).toThrow(
      'KITS_GATEWAY_TIMEOUT_MS must be greater than zero'
    )
  })
})

describe('checkInternalGateway', () => {
  const email = 'healthcheck@example.test'

  test('should pass when the gateway returns 200', async () => {
    const server = {
      inject: vi.fn().mockResolvedValue({
        statusCode: 200
      })
    }

    await expect(checkInternalGateway(server, email)).resolves.toBeUndefined()

    expect(server.inject).toHaveBeenCalledWith({
      method: 'GET',
      url: '/proxy/internal/extapi/reference/legalstatus',
      headers: {
        email
      }
    })
  })

  test('should fail when the gateway returns a non-200 response', async () => {
    const server = {
      inject: vi.fn().mockResolvedValue({
        statusCode: 503
      })
    }

    await expect(checkInternalGateway(server, email)).rejects.toThrow(
      'Internal KITS gateway health check failed: HTTP 503'
    )
  })

  test('should fail when the request throws an error', async () => {
    const server = {
      inject: vi.fn().mockRejectedValue(new Error('Connection refused'))
    }

    await expect(checkInternalGateway(server, email)).rejects.toThrow(
      'Connection refused'
    )
  })
})

describe('checkExternalGateway', () => {
  test.each([200, 403])(
    'should pass when the gateway returns %i',
    async (statusCode) => {
      const server = {
        inject: vi.fn().mockResolvedValue({
          statusCode
        })
      }

      await expect(checkExternalGateway(server)).resolves.toBeUndefined()

      expect(server.inject).toHaveBeenCalledWith({
        method: 'GET',
        url: '/proxy/external/extapi/reference/legalstatus'
      })
    }
  )

  test('should fail when the gateway returns an unexpected status', async () => {
    const server = {
      inject: vi.fn().mockResolvedValue({
        statusCode: 503
      })
    }

    await expect(checkExternalGateway(server)).rejects.toThrow(
      'External KITS gateway health check failed: HTTP 503'
    )
  })

  test('should fail when the request throws an error', async () => {
    const server = {
      inject: vi.fn().mockRejectedValue(new Error('Connection refused'))
    }

    await expect(checkExternalGateway(server)).rejects.toThrow(
      'Connection refused'
    )
  })
})
