export default {
  debug: false, // 本地云函数调试时避免启动阶段额外 check-function 探测
  isAdmin: false,
  loginTypes: [
    'univerify', // App 本机号码一键登录
    'smsCode', // 手机号验证码登录（未使用过的手机号会自动创建账号）
    'username', // 手机号 + 密码登录（已设置密码用户备用）
  ],
  agreements: {
    serviceUrl: '/uni_modules/uni-id-pages/pages/common/legal?type=service',
    privacyUrl: '/uni_modules/uni-id-pages/pages/common/legal?type=privacy',
    scope: ['register', 'login']
  },
  appid: {},
  passwordStrength: 'medium', // 8-20 位，字母/数字/符号任意两种
  setPasswordAfterLogin: false
}
