/**
 * 健康管理云对象
 * 管理疫苗、驱虫、疾病记录、用药任务
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
