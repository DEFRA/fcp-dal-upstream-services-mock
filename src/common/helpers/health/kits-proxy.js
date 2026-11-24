import { config } from '../../../config.js'

export const validateKitsProxyConfig = () => {
  const required = {
    'kitsProxy.internal.gatewayUrl': 'KITS_INTERNAL_GATEWAY_URL',
    'kitsProxy.internal.connectionCert': 'KITS_INTERNAL_CONNECTION_CERT',
    'kitsProxy.internal.connectionKey': 'KITS_INTERNAL_CONNECTION_KEY',
    'kitsProxy.internal.healthCheckEmail': 'KITS_INTERNAL_HEALTHCHECK_EMAIL',
    'kitsProxy.external.gatewayUrl': 'KITS_EXTERNAL_GATEWAY_URL',
    'kitsProxy.external.connectionCert': 'KITS_EXTERNAL_CONNECTION_CERT',
    'kitsProxy.external.connectionKey': 'KITS_EXTERNAL_CONNECTION_KEY'
  }

  const missing = Object.entries(required)
    .filter(([path]) => !config.get(path)?.trim())
    .map(([, envName]) => envName)

  if (missing.length > 0) {
    throw new Error(
      `Missing required KITS proxy configuration: ${missing.join(', ')}`
    )
  }

  for (const type of ['internal', 'external']) {
    const value = config.get(`kitsProxy.${type}.gatewayUrl`)

    try {
      const url = new URL(value)

      if (url.protocol !== 'https:') {
        throw new Error('Expected HTTPS')
      }
    } catch {
      throw new Error(
        `Invalid KITS ${type} gateway URL: expected a valid HTTPS URL`
      )
    }
  }

  if (config.get('kitsProxy.gatewayTimeoutMs') <= 0) {
    throw new Error('KITS_GATEWAY_TIMEOUT_MS must be greater than zero')
  }
}

export const checkInternalGateway = async (server, email) => {
  const response = await server.inject({
    method: 'GET',
    url: '/proxy/internal/extapi/reference/legalstatus',
    headers: { email }
  })

  if (response.statusCode !== 200) {
    throw new Error(
      `Internal KITS gateway health check failed: HTTP ${response.statusCode}`
    )
  }
}

export const checkExternalGateway = async (server) => {
  const response = await server.inject({
    method: 'GET',
    url: '/proxy/external/extapi/reference/legalstatus'
  })

  if (![200, 403].includes(response.statusCode)) {
    throw new Error(
      `External KITS gateway health check failed: HTTP ${response.statusCode}`
    )
  }
}
