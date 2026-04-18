export default {
  debug: false, // 本地云函数调试时避免启动阶段额外 check-function 探测
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
