const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  const { OPENID: openid } = cloud.getWXContext()
  if (!openid) throw new Error('无法获取微信用户身份')

  const users = db.collection('users')
  const existing = await users.where({ openid }).limit(1).get()
  const now = db.serverDate()
  if (existing.data.length) {
    await users.doc(existing.data[0]._id).update({ data: { updated_at: now, last_login_at: now } })
  } else {
    await users.add({
      data: {
        _openid: openid,
        openid,
        notification_enabled: false,
        created_at: now,
        updated_at: now,
        last_login_at: now
      }
    })
  }
  return { openid }
}
