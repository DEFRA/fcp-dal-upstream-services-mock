import { execSync } from 'node:child_process'
import { readFile, rm } from 'node:fs/promises'
import { request, Server } from 'node:https'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

describe('mTLS setup', () => {
  const PROCESS_ENV = process.env
  const testDir = dirname(fileURLToPath(import.meta.url))
  const projectRoot = join(testDir, '../..')
  const mtlsDir = join(projectRoot, 'scripts', 'mtls')
  let ca, hapi
  const options = {
    hostname: 'localhost',
    port: 3443,
    path: '/health',
    rejectUnauthorized: true
  }

  const readAsset = async (asset) => {
    const value = await readFile(join(mtlsDir, asset), 'utf8')
    return Buffer.from(value).toString('base64')
  }

  // Helper function to make HTTPS requests using only node internals (promisified)
  const makeRequest = (options) =>
    new Promise((resolve, reject) => {
      const req = request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) })
        })
      })

      req.on('error', (err) => {
        reject(err)
      })

      req.end()
    })

  beforeAll(async () => {
    // const result = // Uncomment for debugging
    execSync('bash scripts/setup-mtls.sh', { cwd: projectRoot })
    // console.log(result.toString()) // Uncomment for debugging

    ca = await readFile(join(mtlsDir, 'ca.crt'), 'utf8')
    options.ca = ca

    process.env = { ...PROCESS_ENV }
    process.env.NODE_ENV = 'production'
    process.env.LOG_LEVEL = 'fatal' // change to enable mock server logging during tests
    process.env.PORT = '3443' // Set to obscure port to avoid conflicts
    process.env.TLS_KEY = await readAsset('server.key')
    process.env.TLS_CERT = await readAsset('server.crt')
    process.env.TLS_CA = Buffer.from(ca).toString('base64')

    hapi = (await import('../../src/index.js')).hapi
  })

  afterAll(async () => {
    await hapi.stop()
    process.env = PROCESS_ENV
    await rm(mtlsDir, { recursive: true, force: true })
  })

  it('should start HTTPS server with mTLS enabled', async () => {
    expect(hapi.listener).toBeInstanceOf(Server)
    expect(hapi.listener).toEqual(
      expect.objectContaining({ rejectUnauthorized: true, requestCert: true })
    )
  })

  it('should reject connections without client certificate', async () => {
    await expect(makeRequest(options)).rejects.toThrow(/certificate required/)
  })

  it('should accept connections with valid client certificate', async () => {
    const key = await readFile(join(mtlsDir, 'client.key'), 'utf8')
    const cert = await readFile(join(mtlsDir, 'client.crt'), 'utf8')

    expect(await makeRequest({ ...options, key, cert })).toEqual({
      statusCode: 200,
      body: { message: 'success' }
    })
  })
})
