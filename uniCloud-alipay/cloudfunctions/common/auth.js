/**
 * 公共认证模块
 * 云对象 _before 拦截器中调用，注入 familyId
 * V1 限制：假设单家庭模式（一个用户只属于一个家庭）
 */

const db = uniCloud.database()

/**
 * 验证用户身份并返回 familyId
 * @param {string} token - uni-id token
 * @returns {{ uid: string, familyId: string, role: string }}
 */
async function verifyAndGetFamily(token) {
  // TODO: 实现 uni-id token 验证 + 查询用户所属家庭
  throw new Error('Not implemented')
}

module.exports = {
  verifyAndGetFamily,
}
