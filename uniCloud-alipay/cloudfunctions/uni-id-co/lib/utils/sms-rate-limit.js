const {
  dbCmd,
  userCollection,
  verifyCollection,
  SMS_SCENE
} = require('../../common/constants')
const {
  ERROR
} = require('../../common/error')
const {
  isMatchUserApp
} = require('../../common/utils')

const MINUTE = 60000
const SMS_RATE_LIMIT = {
  mobile: {
    windowMs: 5 * MINUTE,
    max: 1
  },
  deviceShort: {
    windowMs: 10 * MINUTE,
    max: 3
  },
  deviceHour: {
    windowMs: 60 * MINUTE,
    max: 8
  },
  ipShort: {
    windowMs: 10 * MINUTE,
    max: 5
  },
  ipHour: {
    windowMs: 60 * MINUTE,
    max: 15
  },
  switchCooldown: {
    windowMs: 30 * MINUTE,
    deviceMax: 3,
    ipMax: 5
  }
}

const RATE_LIMIT_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed',
  BLOCKED: 'blocked'
}

function getClientIdentity () {
  const clientInfo = this.getUniversalClientInfo()
  return {
    ip: clientInfo.clientIP,
    deviceUUID: clientInfo.deviceId || clientInfo.deviceUUID || clientInfo.device_uuid || ''
  }
}

function getReservationId ({
  mobile,
  scene,
  now
}) {
  const bucket = Math.floor(now / SMS_RATE_LIMIT.mobile.windowMs)
  return 'sms_send_' + scene + '_' + mobile + '_' + bucket
}

async function countRecentVerifyCodes (condition) {
  const res = await verifyCollection.where(condition).count()
  return res.total || 0
}

async function getRecentVerifyCodes (condition, limit = 30) {
  const res = await verifyCollection
    .where(condition)
    .field({
      mobile: true,
      scene: true,
      created_date: true
    })
    .orderBy('created_date', 'desc')
    .limit(limit)
    .get()
  return res.data || []
}

function countDistinctMobile (records) {
  const mobileMap = {}
  let count = 0
  for (let i = 0; i < records.length; i++) {
    const mobile = records[i].mobile
    if (!mobile || mobileMap[mobile]) {
      continue
    }
    mobileMap[mobile] = true
    count++
  }
  return count
}

function throwRateLimitError () {
  throw {
    errCode: ERROR.SMS_SEND_TOO_FREQUENT
  }
}

async function assertCountLimit ({
  scene,
  field,
  value,
  windowMs,
  max,
  now,
  includeCurrent = false
}) {
  if (!value) return
  const condition = {
    scene,
    [field]: value,
    rate_limit_only: true,
    rate_limit_status: dbCmd.neq(RATE_LIMIT_STATUS.FAILED),
    created_date: dbCmd.gte(now - windowMs)
  }
  const total = await countRecentVerifyCodes(condition)
  if (includeCurrent ? total > max : total >= max) {
    throwRateLimitError()
  }
}

async function assertSwitchLimit ({
  scene,
  field,
  value,
  windowMs,
  max,
  now,
  includeCurrent = false
}) {
  if (!value) return
  const condition = {
    scene,
    [field]: value,
    rate_limit_only: true,
    rate_limit_status: dbCmd.neq(RATE_LIMIT_STATUS.FAILED),
    created_date: dbCmd.gte(now - windowMs)
  }
  const records = await getRecentVerifyCodes(condition, max + 10)
  const total = countDistinctMobile(records)
  if (includeCurrent ? total > max : total >= max) {
    throwRateLimitError()
  }
}

async function assertSmsSendRateLimit ({
  mobile,
  scene,
  includeCurrent = false
} = {}) {
  const now = Date.now()
  const {
    ip,
    deviceUUID
  } = getClientIdentity.call(this)

  await assertCountLimit({
    scene,
    field: 'mobile',
    value: mobile,
    windowMs: SMS_RATE_LIMIT.mobile.windowMs,
    max: SMS_RATE_LIMIT.mobile.max,
    now,
    includeCurrent
  })
  await assertCountLimit({
    scene,
    field: 'device_uuid',
    value: deviceUUID,
    windowMs: SMS_RATE_LIMIT.deviceShort.windowMs,
    max: SMS_RATE_LIMIT.deviceShort.max,
    now,
    includeCurrent
  })
  await assertCountLimit({
    scene,
    field: 'device_uuid',
    value: deviceUUID,
    windowMs: SMS_RATE_LIMIT.deviceHour.windowMs,
    max: SMS_RATE_LIMIT.deviceHour.max,
    now,
    includeCurrent
  })
  await assertCountLimit({
    scene,
    field: 'ip',
    value: ip,
    windowMs: SMS_RATE_LIMIT.ipShort.windowMs,
    max: SMS_RATE_LIMIT.ipShort.max,
    now,
    includeCurrent
  })
  await assertCountLimit({
    scene,
    field: 'ip',
    value: ip,
    windowMs: SMS_RATE_LIMIT.ipHour.windowMs,
    max: SMS_RATE_LIMIT.ipHour.max,
    now,
    includeCurrent
  })
  await assertSwitchLimit({
    scene,
    field: 'device_uuid',
    value: deviceUUID,
    windowMs: SMS_RATE_LIMIT.switchCooldown.windowMs,
    max: SMS_RATE_LIMIT.switchCooldown.deviceMax,
    now,
    includeCurrent
  })
  await assertSwitchLimit({
    scene,
    field: 'ip',
    value: ip,
    windowMs: SMS_RATE_LIMIT.switchCooldown.windowMs,
    max: SMS_RATE_LIMIT.switchCooldown.ipMax,
    now,
    includeCurrent
  })
}

async function createSmsSendReservation ({
  mobile,
  scene
} = {}) {
  const now = Date.now()
  const {
    ip,
    deviceUUID
  } = getClientIdentity.call(this)
  const reservationId = getReservationId({
    mobile,
    scene,
    now
  })
  try {
    await verifyCollection.add({
      _id: reservationId,
      mobile,
      scene,
      code: '',
      state: 2,
      ip,
      device_uuid: deviceUUID,
      rate_limit_only: true,
      rate_limit_status: RATE_LIMIT_STATUS.PENDING,
      created_date: now,
      expired_date: now + SMS_RATE_LIMIT.mobile.windowMs
    })
  } catch (error) {
    const message = String(error && (error.errMsg || error.message || error.code || error.errCode) || '')
    if (message.indexOf('duplicate') > -1 || message.indexOf('E11000') > -1 || message.indexOf('-11000') > -1) {
      const updateRes = await verifyCollection.where({
        _id: reservationId,
        rate_limit_status: RATE_LIMIT_STATUS.FAILED
      }).update({
        ip,
        device_uuid: deviceUUID,
        rate_limit_status: RATE_LIMIT_STATUS.PENDING,
        rate_limit_reason: '',
        created_date: now,
        updated_date: now,
        expired_date: now + SMS_RATE_LIMIT.mobile.windowMs
      })
      if (updateRes.updated === 1) {
        return {
          id: reservationId
        }
      }
      throwRateLimitError()
    }
    throw error
  }
  return {
    id: reservationId
  }
}

async function updateSmsSendReservation ({
  reservation,
  status,
  reason
} = {}) {
  if (!reservation || !reservation.id) return
  const data = {
    rate_limit_status: status,
    updated_date: Date.now()
  }
  if (reason) {
    data.rate_limit_reason = reason
  }
  try {
    await verifyCollection.doc(reservation.id).update(data)
  } catch (error) {
    console.warn('[sms-rate-limit] update reservation failed', error)
  }
}

async function isResetPasswordMobileAvailable ({
  mobile
} = {}) {
  const clientInfo = this.getUniversalClientInfo()
  const res = await userCollection.where({
    mobile,
    mobile_confirmed: 1
  }).get()
  const users = res.data || []
  for (let i = 0; i < users.length; i++) {
    if (isMatchUserApp(users[i].dcloud_appid, [clientInfo.appId])) {
      return true
    }
  }
  return false
}

async function shouldSendSmsCode ({
  mobile,
  scene
} = {}) {
  if (scene !== SMS_SCENE.RESET_PWD_BY_SMS) {
    return true
  }
  const available = await isResetPasswordMobileAvailable.call(this, {
    mobile
  })
  if (available) {
    return true
  }
  return false
}

module.exports = {
  SMS_RATE_LIMIT,
  RATE_LIMIT_STATUS,
  assertSmsSendRateLimit,
  createSmsSendReservation,
  updateSmsSendReservation,
  shouldSendSmsCode
}
