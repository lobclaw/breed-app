const {
  sendSmsCode
} = require('../../lib/utils/sms')
const {
  verifyCaptcha
} = require('../../lib/utils/captcha')
const {
  SMS_SCENE
} = require('../../common/constants')
const {
  ERROR
} = require('../../common/error')
const {
  assertSmsSendRateLimit,
  createSmsSendReservation,
  RATE_LIMIT_STATUS,
  releaseSmsSendReservation,
  updateSmsSendReservation,
  shouldSendSmsCode
} = require('../../lib/utils/sms-rate-limit')

/**
 * 发送短信验证码
 * @tutorial https://uniapp.dcloud.net.cn/uniCloud/uni-id-pages.html#send-sms-code
 * @param {Object} params
 * @param {String} params.mobile    手机号
 * @param {String} params.captcha   图形验证码
 * @param {String} params.scene     短信验证码使用场景
 * @returns
 */
module.exports = async function (params = {}) {
  const schema = {
    mobile: 'mobile',
    captcha: 'string',
    scene: 'string'
  }
  this.middleware.validate(params, schema)
  const {
    mobile,
    captcha,
    scene
  } = params
  if (!(Object.values(SMS_SCENE).includes(scene))) {
    throw {
      errCode: ERROR.INVALID_PARAM
    }
  }
  await verifyCaptcha.call(this, {
    scene: 'send-sms-code',
    captcha
  })
  const reservation = await createSmsSendReservation.call(this, {
    mobile,
    scene
  })

  try {
    await assertSmsSendRateLimit.call(this, {
      mobile,
      scene,
      includeCurrent: true
    })
    const shouldSend = await shouldSendSmsCode.call(this, {
      mobile,
      scene
    })
    if (!shouldSend) {
      await updateSmsSendReservation.call(this, {
        reservation,
        status: RATE_LIMIT_STATUS.SENT,
        reason: 'reset_pwd_mobile_not_found'
      })
      return {
        errCode: 0
      }
    }

    // -- 测试代码
    const smsConfig = (this.config.service && this.config.service.sms) || {}
    const sceneConfig = (smsConfig.scene && smsConfig.scene[scene]) || {}
    const {
      templateId
    } = sceneConfig
    if (!templateId || !templateId.replace(/[^0-9a-zA-Z]/g, '')) {
      await require('../../lib/utils/verify-code')
        .setMobileVerifyCode.call(this, {
          mobile: params.mobile,
          code: '123456',
          expiresIn: sceneConfig.codeExpiresIn || smsConfig.codeExpiresIn || 300,
          scene
        })
      await updateSmsSendReservation.call(this, {
        reservation,
        status: RATE_LIMIT_STATUS.SENT,
        reason: 'test_mode'
      })
      return {
        errCode: 'uni-id-invalid-sms-template-id',
        errMsg: `未找到scene=${scene},的短信模版templateId。\n已启动测试模式，直接使用：123456作为短信验证码即可。\n如果是正式项目，请在路径：/common/uni-config-center/uni-id/config.json中service->sms中配置密钥等信息\n更多详情：https://uniapp.dcloud.io/uniCloud/uni-id.html#config`
      }
    }
    // -- 测试代码

    const result = await sendSmsCode.call(this, {
      mobile,
      scene
    })
    await updateSmsSendReservation.call(this, {
      reservation,
      status: RATE_LIMIT_STATUS.SENT
    })
    return result
  } catch (error) {
    const errCode = error && (error.errCode || error.code)
    const status = errCode === ERROR.SMS_SEND_TOO_FREQUENT ? RATE_LIMIT_STATUS.BLOCKED : RATE_LIMIT_STATUS.FAILED
    try {
      await updateSmsSendReservation.call(this, {
        reservation,
        status,
        reason: errCode || 'send_sms_failed',
        throwOnError: status === RATE_LIMIT_STATUS.FAILED
      })
    } catch (reservationError) {
      if (status === RATE_LIMIT_STATUS.FAILED) {
        try {
          await releaseSmsSendReservation.call(this, {
            reservation
          })
        } catch (releaseError) {
          console.warn('[sms-rate-limit] release failed reservation failed', releaseError)
        }
      } else {
        console.warn('[sms-rate-limit] update reservation failed', reservationError)
      }
    }
    throw error
  }
}
