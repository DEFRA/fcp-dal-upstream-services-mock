import Hapi from '@hapi/hapi'
import inert from '@hapi/inert'

import {
  emulateUpstreamErrors,
  failAction
} from './common/helpers/fail-action.js'
import { createLogger } from './common/helpers/logging/logger.js'
import { requestLogger } from './common/helpers/logging/request-logger.js'
import { pulse } from './common/helpers/pulse.js'
import { requestTracing } from './common/helpers/request-tracing.js'
import { config } from './config.js'
import { router as hitachiRouter } from './routes/hitachi/payments.js'
import { router as kitsRouter } from './plugins/kits-v1-router.js'
import { router as kitsProxyRouter } from './routes/proxy/kits-proxy.router.js'
import { health } from './plugins/health.js'
import { schemata } from './plugins/schemata.js'

const logger = createLogger()
export const startServer = async (listener) => {
  let server

  try {
    server = Hapi.server({
      listener,
      host: config.get('host'),
      port: config.get('port'),
      routes: {
        validate: {
          options: { abortEarly: false },
          failAction
        },
        security: {
          hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: false
          },
          xss: 'enabled',
          noSniff: true,
          xframe: true
        }
      },
      router: { stripTrailingSlash: true }
    })

    // Hapi Plugins:
    // requestLogger  - automatically logs incoming requests
    // requestTracing - trace header logging and propagation
    // pulse          - provides shutdown handlers
    // inert          - serves static files
    // schemata       - serves swagger 2.0 schema files
    // router         - routes used in the app
    await server.register([
      requestLogger,
      requestTracing,
      pulse,
      inert,
      health,
      schemata
    ])
    await server.register(hitachiRouter, { routes: { prefix: '/api' } })
    await server.register(kitsRouter, { routes: { prefix: '/extapi' } })
    if (config.get('kitsProxy.enabled')) {
      await server.register(kitsProxyRouter, { routes: { prefix: '/proxy' } })
    }

    // emulate upstream error responses
    server.ext('onPreResponse', emulateUpstreamErrors)

    await server.start()

    server.logger.info('Server started successfully')
    const scheme =
      config.get('tls.key') && config.get('tls.cert') ? 'https' : 'http'
    server.logger.info(
      `Access mock on ${scheme}://localhost:${config.get('port')}`
    )

    server.ext('onRequest', (request, h) => {
      // log the domain of the email that was passed in the `email` header
      if (request?.headers?.email) {
        request.logger = request.logger.child({
          tenant: { id: request?.headers?.email?.split('@')[1] }
        })
      }

      return h.continue
    })

    return server
  } catch (error) {
    logger.info('Server failed to start :(')
    logger.error(error)
    if (server) {
      await server.stop({ timeout: 0 })
    }
  }

  return server
}
