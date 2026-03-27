export default {
  debug: true, // 开发阶段开启调试
  isAdmin: false,
  loginTypes: [
    'username', // 用户名 + 密码登录（开发阶段）
  ],
  agreements: {
    serviceUrl: '',
    privacyUrl: '',
    scope: ['register', 'login']
  },
  appid: {},
  passwordStrength: 'weak', // 个人工具，弱密码即可
  setPasswordAfterLogin: false
}
