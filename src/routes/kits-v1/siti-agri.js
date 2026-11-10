import Boom from '@hapi/boom'
import { createLogger } from '../../common/helpers/logging/logger.js'
import { sbiToOrgId } from '../../factories/id-lookups.js'
import { retrieveOrganisationAgreements } from '../../factories/siti-agri/agreement.factory.js'
import { retrieveApplications } from '../../factories/siti-agri/application.factory.js'
import {
  retrieveCPHs,
  retrieveLandUseBySBIAndSheetAndParcel
} from '../../factories/siti-agri/cph.factory.js'
import { checkId } from '../../utils/shared-datatypes.js'

const logger = createLogger('siti-agri.route')
const responseWrapper = { errorString: null, success: true }

const defaultResponse = (request) => {
  const sbi = checkId(request, 'sbi')
  const orgId = sbiToOrgId[sbi]

  if (!orgId) {
    throw Boom.forbidden(`organisation with SBI: ${sbi} not found`, request) // YES, 404 is a 403!!
  }

  return { orgId, sbi }
}

export const sitiagri = [
  {
    method: 'GET',
    path: '/SitiAgriApi/cv/appByBusiness/sbi/{sbi}/list',
    handler: async (request, h) => {
      const { orgId, sbi } = defaultResponse(request)

      return h.response({
        ...responseWrapper,
        data: retrieveApplications(sbi, orgId)
      })
    }
  },
  {
    method: 'GET',
    path: '/SitiAgriApi/cv/agreementsByBusiness/sbi/{sbi}/list',
    handler: async (request, h) => {
      const { orgId, sbi } = defaultResponse(request)

      return h.response({
        ...responseWrapper,
        data: retrieveOrganisationAgreements(sbi, orgId)
      })
    }
  },
  {
    method: 'GET',
    path: '/SitiAgriApi/cv/cphByBusiness/sbi/{sbi}/list',
    handler: async (request, h) => {
      const { orgId, sbi } = defaultResponse(request)

      // specifically handle uniquely odd `pointInTime` format requirements and error response
      if (
        !/^(\d{4}-\d{2}-\d{2}[ +]\d{2}:\d{2}:\d{2}|)$/.test(
          request.query.pointInTime ?? ''
        )
      ) {
        logger.warn(
          'pointInTime value must be empty, omitted, or match pattern: "YYYY-MM-DD hh:mm:ss"',
          request
        )
        return h
          .response(
            `<!doctype html><html lang="en"><head><title>HTTP Status 404 – Not Found</title></head>
            <body><h1>HTTP Status 404 – Not Found</h1></body></html>`
          )
          .code(404)
      }

      return h.response({ ...responseWrapper, data: retrieveCPHs(sbi, orgId) })
    }
  },
  {
    method: 'GET',
    path: '/SitiAgriApi/cv/landUseByBusinessParcel/sheet/{sheetId}/parcel/{parcelId}/sbi/{sbi}/list',
    handler: async (request, h) => {
      const { orgId, sbi } = defaultResponse(request)
      const { sheetId, parcelId } = request?.params ?? {}
      const { pointInTime } = request?.query ?? {}

      // specifically handle uniquely odd `pointInTime` format requirements and error response
      if (
        !/^(\d{4}-\d{2}-\d{2}[ +]\d{2}:\d{2}:\d{2}|)$/.test(pointInTime ?? '')
      ) {
        logger.warn(
          'pointInTime value must be empty, omitted, or match pattern: "YYYY-MM-DD hh:mm:ss"',
          request
        )
        return h
          .response(
            `<!doctype html><html lang="en"><head><title>HTTP Status 404 – Not Found</title></head>
                  <body><h1>HTTP Status 404 – Not Found</h1></body></html>`
          )
          .code(404)
      }

      return h.response({
        ...responseWrapper,
        data: retrieveLandUseBySBIAndSheetAndParcel(
          sbi,
          sheetId,
          parcelId,
          orgId
        )
      })
    }
  }
]
