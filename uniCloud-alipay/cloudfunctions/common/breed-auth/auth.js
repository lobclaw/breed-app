/**
 * 公共认证模块
 * 云对象 _before 拦截器中调用，注入 familyId
 * V1 限制：假设单家庭模式（一个用户只属于一个家庭）
 */

const db = uniCloud.database()

/**
 * 验证用户身份并返回 familyId 和角色
 * @param {string} token - uni-id token
 * @returns {{ uid: string, familyId: string, role: string }}
 */
async function verifyAndGetFamily(token) {
  if (!token) {
    throw createAuthError('TOKEN_MISSING', '请先登录')
  }

  // 验证 uni-id token
  const payload = await uniCloud.request({
    function: 'uni-id-co',
    data: { method: 'checkToken', token }
  }).catch(() => null)

  // uni-id checkToken 返回 { uid, token, tokenExpired, ... }
  // 如果 token 无效或过期，payload 里 uid 不存在
  let uid
  if (payload && payload.result && payload.result.uid) {
    uid = payload.result.uid
  } else {
    // 备用方案：直接用 uniCloud.auth() 验证
    try {
      const auth = uniCloud.auth()
      const info = await auth.getUserInfo()
      uid = info.uid
    } catch (e) {
      throw createAuthError('TOKEN_INVALID', '登录已过期，请重新登录')
    }
  }

  if (!uid) {
    throw createAuthError('TOKEN_INVALID', '登录已过期，请重新登录')
  }

  // 查询用户所属家庭（单家庭模式：取第一个 active 的）
  const { data: families } = await db.collection('families')
    .where({
      'members.user_id': uid,
      'members.status': 'active'
    })
    .limit(1)
    .get()

  if (!families || families.length === 0) {
    // 用户未加入任何家庭 —— 允许某些操作（如 createFamily）
    return { uid, familyId: null, role: null }
  }

  const family = families[0]
  const member = family.members.find(m => m.user_id === uid && m.status === 'active')
  const role = member ? member.role : null

  return { uid, familyId: family._id, role }
}

/**
 * 检查权限：仅 creator 和 admin 可执行
 * @param {string} role
 */
function requireAdmin(role) {
  if (role !== 'creator' && role !== 'admin') {
    throw createAuthError('PERMISSION_DENIED', '权限不足，仅管理员可执行此操作')
  }
}

/**
 * 检查权限：必须已加入家庭
 * @param {string|null} familyId
 */
function requireFamily(familyId) {
  if (!familyId) {
    throw createAuthError('NO_FAMILY', '请先创建或加入家庭')
  }
}

/**
 * 创建认证错误
 */
function createAuthError(code, message) {
  const err = new Error(message)
  err.code = code
  return err
}

module.exports = {
  verifyAndGetFamily,
  requireAdmin,
  requireFamily,
  createAuthError,
}
