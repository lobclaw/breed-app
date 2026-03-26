/**
 * 犬只档案云对象
 * 负责犬只 CRUD、状态派生、disposition 变更
 */
const { verifyAndGetFamily } = require('common/auth')

module.exports = {
  _before: async function() {
    // 认证 + 注入 familyId
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
