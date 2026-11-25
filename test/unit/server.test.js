import hapi from '@hapi/hapi'
import {
  validateKitsProxyConfig,
  checkInternalGateway,
  checkExternalGateway
} from '../../src/common/helpers/health/kits-proxy.js'

const mockHapiLoggerInfo = vi.fn()
const mockHapiLoggerError = vi.fn()

vi.mock('hapi-pino', async (importOriginal) => {
  const actual = await importOriginal()
  const mockedPlugin = {
    register: (server) => {
      server.decorate('server', 'logger', {
        info: mockHapiLoggerInfo,
        error: mockHapiLoggerError
      })
    },
    name: 'mock-hapi-pino'
  }

  return {
    ...actual,
    __esModule: true,
    default: mockedPlugin,
    ...mockedPlugin
  }
})

vi.mock('../../src/common/helpers/health/kits-proxy.js', () => ({
  validateKitsProxyConfig: vi.fn(),
  checkInternalGateway: vi.fn(),
  checkExternalGateway: vi.fn()
}))

describe('#startServer', () => {
  const PROCESS_ENV = process.env
  let hapiServerSpy = vi.fn()
  let config
  let startServerImport

  beforeAll(async () => {
    process.env = { ...PROCESS_ENV }
    process.env.PORT = '3098' // Set to obscure port to avoid conflicts

    // Import config after setting the environment variables
    const configImport = await import('../../src/config.js')
    config = configImport.config

    startServerImport = await import('../../src/server.js')
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  afterAll(() => {
    process.env = PROCESS_ENV
  })

  describe('When server starts', () => {
    let server

    afterAll(async () => {
      if (server) await server.stop({ timeout: 0 })
    })

    test('Should start up server on specified port', async () => {
      hapiServerSpy = vi.spyOn(hapi, 'server')
      server = await startServerImport.startServer()

      expect(hapiServerSpy).toHaveBeenCalledWith(
        expect.objectContaining({ port: 3098 })
      )
      expect(mockHapiLoggerInfo).toHaveBeenNthCalledWith(
        1,
        'Server started successfully'
      )
      expect(mockHapiLoggerInfo).toHaveBeenNthCalledWith(
        2,
        'Access mock on http://localhost:3098'
      )
    })

    test('Should skip KITS health checks when proxy is disabled', async () => {
      const originalGet = config.get.bind(config)

      vi.spyOn(config, 'get').mockImplementation((path) => {
        if (path === 'kitsProxy.enabled') {
          return false
        }

        return originalGet(path)
      })

      const server = {
        register: vi.fn(),
        ext: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        logger: {
          info: vi.fn()
        }
      }

      vi.spyOn(hapi, 'server').mockReturnValue(server)

      await startServerImport.startServer()

      expect(validateKitsProxyConfig).not.toHaveBeenCalled()
      expect(checkInternalGateway).not.toHaveBeenCalled()
      expect(checkExternalGateway).not.toHaveBeenCalled()

      expect(server.start).toHaveBeenCalledOnce()
    })

    test('Should run KITS health checks when proxy is enabled', async () => {
      const originalGet = config.get.bind(config)
      const email = 'healthcheck@example.test'

      vi.spyOn(config, 'get').mockImplementation((path) => {
        if (path === 'kitsProxy.enabled') {
          return true
        }

        if (path === 'kitsProxy.internal.healthCheckEmail') {
          return email
        }

        return originalGet(path)
      })

      const server = {
        register: vi.fn().mockResolvedValue(undefined),
        ext: vi.fn(),
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn(),
        logger: {
          info: vi.fn()
        }
      }

      vi.spyOn(hapi, 'server').mockReturnValue(server)

      checkInternalGateway.mockResolvedValue(undefined)
      checkExternalGateway.mockResolvedValue(undefined)

      await startServerImport.startServer()

      expect(validateKitsProxyConfig).toHaveBeenCalledOnce()

      expect(checkInternalGateway).toHaveBeenCalledWith(server, email)

      expect(checkExternalGateway).toHaveBeenCalledWith(server)

      expect(server.start).toHaveBeenCalledOnce()

      const startOrder = server.start.mock.invocationCallOrder[0]

      expect(validateKitsProxyConfig.mock.invocationCallOrder[0]).toBeLessThan(
        startOrder
      )

      expect(checkInternalGateway.mock.invocationCallOrder[0]).toBeLessThan(
        startOrder
      )

      expect(checkExternalGateway.mock.invocationCallOrder[0]).toBeLessThan(
        startOrder
      )
    })

    test('Should fail startup when KITS proxy configuration is invalid', async () => {
      const originalGet = config.get.bind(config)

      vi.spyOn(config, 'get').mockImplementation((path) => {
        if (path === 'kitsProxy.enabled') {
          return true
        }

        return originalGet(path)
      })

      const server = {
        register: vi.fn().mockResolvedValue(undefined),
        ext: vi.fn(),
        start: vi.fn(),
        stop: vi.fn().mockResolvedValue(undefined),
        logger: {
          info: vi.fn()
        }
      }

      vi.spyOn(hapi, 'server').mockReturnValue(server)

      validateKitsProxyConfig.mockImplementationOnce(() => {
        throw new Error(
          'Missing required KITS proxy configuration: KITS_INTERNAL_HEALTHCHECK_EMAIL'
        )
      })

      await expect(startServerImport.startServer()).rejects.toThrow(
        'Missing required KITS proxy configuration: KITS_INTERNAL_HEALTHCHECK_EMAIL'
      )

      expect(validateKitsProxyConfig).toHaveBeenCalledOnce()

      expect(checkInternalGateway).not.toHaveBeenCalled()
      expect(checkExternalGateway).not.toHaveBeenCalled()

      expect(server.start).not.toHaveBeenCalled()
      expect(server.stop).toHaveBeenCalledWith({ timeout: 0 })
    })

    test('Should fail startup when the internal KITS gateway is unavailable', async () => {
      const originalGet = config.get.bind(config)

      vi.spyOn(config, 'get').mockImplementation((path) => {
        if (path === 'kitsProxy.enabled') {
          return true
        }

        if (path === 'kitsProxy.internal.healthCheckEmail') {
          return 'healthcheck@example.test'
        }

        return originalGet(path)
      })

      const server = {
        register: vi.fn().mockResolvedValue(undefined),
        ext: vi.fn(),
        start: vi.fn(),
        stop: vi.fn().mockResolvedValue(undefined),
        logger: {
          info: vi.fn()
        }
      }

      vi.spyOn(hapi, 'server').mockReturnValue(server)

      checkInternalGateway.mockRejectedValue(
        new Error('Internal KITS gateway unavailable')
      )

      await expect(startServerImport.startServer()).rejects.toThrow(
        'Internal KITS gateway unavailable'
      )

      expect(validateKitsProxyConfig).toHaveBeenCalledOnce()
      expect(checkInternalGateway).toHaveBeenCalledOnce()
      expect(checkExternalGateway).not.toHaveBeenCalled()

      expect(server.start).not.toHaveBeenCalled()
      expect(server.stop).toHaveBeenCalledWith({ timeout: 0 })
    })

    test('Should fail startup when the external KITS gateway is unavailable', async () => {
      const originalGet = config.get.bind(config)

      vi.spyOn(config, 'get').mockImplementation((path) => {
        if (path === 'kitsProxy.enabled') {
          return true
        }

        if (path === 'kitsProxy.internal.healthCheckEmail') {
          return 'healthcheck@example.test'
        }

        return originalGet(path)
      })

      const server = {
        register: vi.fn().mockResolvedValue(undefined),
        ext: vi.fn(),
        start: vi.fn(),
        stop: vi.fn().mockResolvedValue(undefined),
        logger: {
          info: vi.fn()
        }
      }

      vi.spyOn(hapi, 'server').mockReturnValue(server)

      checkInternalGateway.mockResolvedValue(undefined)

      checkExternalGateway.mockRejectedValue(
        new Error('External KITS gateway unavailable')
      )

      await expect(startServerImport.startServer()).rejects.toThrow(
        'External KITS gateway unavailable'
      )

      expect(validateKitsProxyConfig).toHaveBeenCalledOnce()
      expect(checkInternalGateway).toHaveBeenCalledOnce()
      expect(checkExternalGateway).toHaveBeenCalledOnce()

      expect(server.start).not.toHaveBeenCalled()
      expect(server.stop).toHaveBeenCalledWith({ timeout: 0 })
    })
  })

  describe('When server start fails', () => {
    test('Should attempt to stop (teardown) the server', async () => {
      const register = vi.fn()
      const ext = vi.fn()
      const start = vi.fn(() => {
        throw new Error('Server failed to start')
      })
      const stop = vi.fn()
      const serverSpy = vi
        .spyOn(hapi, 'server')
        .mockReturnValue({ register, ext, start, stop })

      await expect(startServerImport.startServer()).rejects.toThrow(
        'Server failed to start'
      )

      expect(serverSpy).toHaveBeenCalled()
      expect(register).toHaveBeenCalled()
      expect(ext).toHaveBeenCalled()
      expect(start).toHaveBeenCalled()
      expect(stop).toHaveBeenCalledWith({ timeout: 0 })
    })
  })
})
