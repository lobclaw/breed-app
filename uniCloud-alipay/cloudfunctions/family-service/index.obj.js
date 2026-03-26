/**
 * 家庭云对象
 * 管理家庭创建、成员管理、设置
 */
const { verifyAndGetFamily } = require('common/auth')

module.exports = {
  _before: async function() {
    const { uid, familyId, role } = await verifyAndGetFamily(this.getUniIdToken())
    this.uid = uid
    this.familyId = familyId
    this.role = role
  },

  _after: function(error, result) {
    if (error) {
      return { code: error.code || -1, message: error.message }
    }
    return { code: 0, ...result }
  },

  // TODO: 实现具体方法
}
