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
