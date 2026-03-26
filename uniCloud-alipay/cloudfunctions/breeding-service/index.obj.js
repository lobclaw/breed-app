/**
 * 繁育流程云对象
 * 管理繁育周期生命周期、8种记录类型、窝管理
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
