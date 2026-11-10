import { getTraceId } from '@defra/hapi-tracing'
import { ecsFormat } from '@elastic/ecs-pino-format'
import { config } from '../../../config.js'

const logConfig = config.get('log')
const serviceName = config.get('serviceName')
const serviceVersion = config.get('serviceVersion')

const customTransform = {
  formatters: {
    log(object) {
      if (!object?.payload) return object

      return { ...object, url: { query: JSON.stringify(object.payload) } }
    }
  }
}
const ecsTransform = ecsFormat({
  serviceVersion,
  serviceName
})

const formatters = {
  ecs: {
    ...ecsTransform,
    formatters: {
      log(object, ...rest) {
        return ecsTransform.formatters.log(
          customTransform.formatters.log(object),
          ...rest
        )
      }
    }
  },
  'pino-pretty': {
    ...customTransform,
    ...{ transport: { target: 'pino-pretty' } }
  }
}

export const loggerOptions = {
  enabled: logConfig.isEnabled,
  ignorePaths: ['/health'],
  level: logConfig.level,
  logPayload: true,
  ...formatters[logConfig.format],
  nesting: true,
  mixin() {
    const mixinValues = {}
    const traceId = getTraceId()
    if (traceId) {
      mixinValues.trace = { id: traceId }
    }
    return mixinValues
  }
}
