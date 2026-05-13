import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../..')

function source(path: string) {
  return readFileSync(resolve(root, path), 'utf8')
}

describe('password recovery source contract', () => {
  it('登录页忘记密码应直接进入找回页并让用户重新输入手机号', () => {
    const content = source('src/uni_modules/uni-id-pages/pages/login/login-withoutpwd.vue')
    const methodStart = content.indexOf('toRetrievePwd()')
    const methodEnd = content.indexOf('togglePasswordVisible()', methodStart)
    const method = content.slice(methodStart, methodEnd)

    expect(content).toContain('忘记密码')
    expect(method).toContain("url: '/uni_modules/uni-id-pages/pages/retrieve/retrieve'")
    expect(method).not.toContain('请输入手机号')
    expect(method).not.toContain('请输入正确的手机号')
    expect(method).not.toContain('phoneNumber')
  })

  it('找回密码页应使用两步流程、uni 图形验证码短信组件，并自动登录', () => {
    const content = source('src/uni_modules/uni-id-pages/pages/retrieve/retrieve.vue')

    expect(content).toContain("step: 'verify'")
    expect(content).toContain("type=\"reset-pwd-by-sms\"")
    expect(content).toContain('uni-id-pages-agreements scope="login"')
    expect(content).toContain("this.step = 'password'")
    expect(content).toContain('canGoNext()')
    expect(content).toContain("'uni-btn--inactive': !canGoNext")
    expect(content).toContain('>下一步</button>')
    expect(content).toContain("{{ submitting ? '登录中...' : '完成' }}")
    expect(content).toContain('uniIdCo.resetPwdBySms')
    expect(content).toContain('uniIdCo.login')
    expect(content).toContain('this.loginSuccess(e)')
    expect(content).toContain('密码已重置，请重新登录')
  })

  it('密码规则应统一为 8-20 位且至少两类字符', () => {
    const frontPassword = source('src/uni_modules/uni-id-pages/common/password.js')
    const cloudValidator = source('uniCloud-alipay/cloudfunctions/uni-id-co/common/validator.js')
    const clientConfig = source('src/uni_modules/uni-id-pages/config.js')
    const cloudConfig = source('uniCloud-alipay/cloudfunctions/common/uni-config-center/uni-id/config.json')

    expect(frontPassword).toContain('PASSWORD_TIP')
    expect(frontPassword).toContain('{8,20}')
    expect(cloudValidator).toContain('{8,20}')
    expect(frontPassword).toContain('密码需要8-20位，至少包含字母、数字、符号的任意两种')
    expect(clientConfig).toContain("passwordStrength: 'medium'")
    expect(cloudConfig).toContain('"passwordStrength": "medium"')
  })
})

describe('sms login source contract', () => {
  it('验证码登录应先弹图形验证码并在通过后发送短信', () => {
    const content = source('src/uni_modules/uni-id-pages/pages/login/login-withoutpwd.vue')

    expect(content).toContain('ref="smsCaptchaPopup"')
    expect(content).toContain('scene="send-sms-code"')
    expect(content).toContain('@confirm="sendSmsCodeAfterCaptcha"')
    expect(content).toContain("this.$refs.agreements.popup(this.toSmsPage)")
    expect(content).toContain('this.$refs.smsCaptchaPopup.open()')
    expect(content).toContain('uniIdCo.sendSmsCode')
    expect(content).toContain("scene: 'login-by-sms'")
    expect(content).toContain("const sentAt = Date.now()")
    expect(content).toContain("uni.setStorageSync(SMS_SENT_AT_STORAGE_PREFIX + this.phone, String(sentAt))")
    expect(content).toContain("url: '/uni_modules/uni-id-pages/pages/login/login-smscode?phoneNumber=' + this.phone + '&sentAt=' + sentAt")
  })

  it('短信验证码页应只保留 6 位固定格输入、300 秒倒计时和手动测试码', () => {
    const content = source('src/uni_modules/uni-id-pages/pages/login/login-smscode.vue')

    expect(content).not.toContain('uni-id-pages-sms-form')
    expect(content).toContain('class="otp-box"')
    expect(content).toContain('maxlength="6"')
    expect(content).toContain('height: 56px')
    expect(content).toContain('flex: 1')
    expect(content).toContain('const RESEND_SECONDS = 300')
    expect(content).toContain("title: '请输入短信验证码'")
    expect(content).toContain("return this.loggingIn ? '登录中...' : '登录'")
    expect(content).toContain("return this.remainingSeconds + ' 秒后重新发送'")
    expect(content).toContain("uni.showToast({")
    expect(content).toContain("title: '测试模式，请输入 123456'")
    expect(content).toContain('getInitialSentAt(routeSentAt)')
    expect(content).toContain('uni.getStorageSync(this.getStorageKey())')
    expect(content).toContain('uni.setStorageSync(this.getStorageKey(), String(sentAt))')
    expect(content).not.toContain('this.code = "123456"')
    expect(content).not.toContain("this.code = '123456'")
  })

  it('登录短信验证码有效期应与前端 5 分钟倒计时一致', () => {
    const cloudConfig = source('uniCloud-alipay/cloudfunctions/common/uni-config-center/uni-id/config.json')
    const sendSmsCode = source('uniCloud-alipay/cloudfunctions/uni-id-co/module/verify/send-sms-code.js')

    expect(cloudConfig).toContain('"login-by-sms"')
    expect(cloudConfig).toContain('"codeExpiresIn": 300')
    expect(sendSmsCode).toContain('expiresIn: sceneConfig.codeExpiresIn || smsConfig.codeExpiresIn || 300')
  })
})
