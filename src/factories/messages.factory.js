import { fakeId, faker, nullOrFake, safeSeed } from './common.js'
import { orgIdLookup, personIdToOrgIds } from './id-lookups.js'

const businessPersonMessages = {}
const maxYearsInPast = 4

const createMessageMock = (orgId, personId, overrides = {}) => {
  const archivedAt = nullOrFake(
    () =>
      Number.parseInt(faker.date.past(maxYearsInPast).getTime() / 1000) * 1000
  )

  const readAt = nullOrFake(
    () =>
      Number.parseInt(faker.date.past(maxYearsInPast).getTime() / 1000) * 1000
  )

  const message = {
    id: fakeId(),
    personId,
    organisationId: orgId,
    messageId: fakeId(),
    readAt,
    archivedAt,
    archive: archivedAt === null ? null : !!archivedAt,
    createdAt: faker.date
      .past(readAt ? { refDate: readAt } : undefined)
      .getTime(),
    title: faker.lorem.sentence({ min: 3, max: 10 }),
    body: `<p>${faker.lorem.sentence()}</p>`,
    category: 'OrganisationLevel',
    bespokeNotificationId: null,
    ...overrides
  }
  return message
}

const generateMessagesPayload = (orgId, personId, overrides = null) => {
  const notifications = Array.from(
    overrides ?? new Array(faker.number.int({ min: 0, max: 10 })),
    (messageOverrides) => createMessageMock(orgId, personId, messageOverrides)
  )

  const readCount = notifications.filter((n) => n.readAt).length

  return {
    notifications,
    resultCount: notifications.length,
    readCount,
    unreadCount: notifications.length - readCount
  }
}

const emptyMessagesPayload = {
  notifications: [],
  resultCount: 0,
  readCount: 0,
  unreadCount: 0
}

export const retrieveMessages = (orgId, personId, page = 1) => {
  // Ensures totalPages is stable for the same orgId/personId
  ;[orgId, personId] = safeSeed([orgId, personId])
  page = Number.parseInt(page) || 1

  const totalPages = faker.number.int({ min: 1, max: 3 })

  // check person exists and org is related to the person
  // Very strangely the upstream returns a successful response if they don't exist
  const orgIds = personIdToOrgIds[personId]
  if (!orgIds?.includes(orgId) || page > totalPages) {
    return emptyMessagesPayload
  }

  // each page holds different messages, so cache them per page
  const cacheKey = `${orgId}-${personId}-${page}`
  const messages = businessPersonMessages[cacheKey]
  if (messages) {
    return messages
  }

  const { sbi, ...overrides } = orgIdLookup[orgId] ?? {}
  const staticMessages = overrides.customers?.find(
    (c) => personId === (typeof c === 'number' ? c : c?.personId)
  )?.messages

  // static messages are the complete list, so they only fill the first page
  if (staticMessages && page > 1) {
    return emptyMessagesPayload
  }

  // page 1 continues from the seed above (keeping existing data stable); later pages
  // re-seed so they generate their own messages
  if (page > 1) {
    safeSeed([orgId, personId, page])
  }

  const messagesPayload = generateMessagesPayload(
    orgId,
    personId,
    staticMessages
  )
  businessPersonMessages[cacheKey] = messagesPayload
  return messagesPayload
}
