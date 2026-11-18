const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const config = require('./config')
const { getRemainingDays, todayForTimezoneOffset } = require('./date')
const { REMINDER_TYPE, reminderKey, reminderKeyFromRecord, collectCandidates } = require('./logic')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const command = db.command

function truncateThing(value, maxLength = 20) {
  return Array.from(String(value || '')).slice(0, maxLength).join('')
}

function formatExpireTime(expireDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expireDate)
  if (!match) throw new Error(`过期日期无法转换为 time16: ${expireDate}`)
  return `${match[1]}年${match[2]}月${match[3]}日 23:59`
}

function buildLocation(fridgeName, storageArea) {
  const location = storageArea ? `${fridgeName}-${storageArea}` : fridgeName
  return truncateThing(location || '我的冰箱')
}

function buildMessageData(food, fridgeName, days) {
  if (!food || !food.name) throw new Error('食物名称为空')
  if (!Number.isInteger(days) || days < 0 || days > 2) throw new Error(`剩余天数不属于 near_expiry: ${days}`)
  const keys = config.dataKeys
  return {
    [keys.foodName]: { value: truncateThing(food.name) },
    [keys.remainingDays]: { value: String(days) },
    [keys.expireTime]: { value: formatExpireTime(food.expire_date) },
    [keys.location]: { value: buildLocation(fridgeName, food.storage_area) },
    [keys.note]: { value: days === 0 ? '请今天处理' : '请尽快食用' }
  }
}

async function fetchAll(collection, where = {}) {
  const rows = []
  const pageSize = 100
  while (true) {
    const { data } = await db.collection(collection).where(where).skip(rows.length).limit(pageSize).get()
    rows.push(...data)
    if (data.length < pageSize) return rows
  }
}

function validTimezoneOffset(user) {
  const offset = Number(user.timezone_offset_minutes)
  return Number.isFinite(offset) && offset >= -840 && offset <= 840 ? offset : null
}

function reminderDocumentId(recipientOpenid, foodId, localDate) {
  const value = reminderKey(recipientOpenid, foodId, localDate, REMINDER_TYPE)
  return `rr_${crypto.createHash('sha256').update(value).digest('hex').slice(0, 29)}`
}

async function createReminderClaim(recipientOpenid, foodId, localDate) {
  const id = reminderDocumentId(recipientOpenid, foodId, localDate)
  try {
    await db.collection('reminders').add({ data: {
      _id: id,
      recipient_openid: recipientOpenid,
      openid: recipientOpenid,
      food_id: foodId,
      reminder_type: REMINDER_TYPE,
      local_date: localDate,
      scheduled_date: localDate,
      sent: false,
      status: 'claimed',
      claimed_at: new Date(),
      created_at: db.serverDate()
    } })
    return id
  } catch (error) {
    try {
      const existing = await db.collection('reminders').doc(id).get()
      if (existing.data) return ''
    } catch (lookupError) {
      console.error('[提醒去重占位检查失败]', { errMsg: lookupError.errMsg || lookupError.message, food_id: foodId, openid: recipientOpenid })
    }
    throw error
  }
}

function selectedFridgesByUser(fridgeMembers) {
  const result = new Map()
  for (const row of fridgeMembers) {
    if (!result.has(row.user_openid)) result.set(row.user_openid, new Set())
    result.get(row.user_openid).add(row.fridge_id)
  }
  return result
}

exports.main = async () => {
  if (!config.templateId) {
    console.error('[配置错误] 模板 ID 未配置')
    throw new Error('模板 ID 未配置：请填写 cloudfunctions/sendExpiryReminders/config.js')
  }

  const fallbackToday = todayForTimezoneOffset(-480)
  const users = await fetchAll('users', { notification_enabled: true })
  const results = []
  console.log('[开始检查]', { fallbackDate: fallbackToday, subscribedUsers: users.length })
  if (!users.length) {
    console.log('[未找到待提醒食材] 当前没有已授权且等待发送的用户')
    return { fallbackDate: fallbackToday, checkedUsers: 0, results }
  }

  const recipientDates = new Map()
  for (const user of users) {
    if (!user.openid) continue
    const savedOffset = validTimezoneOffset(user)
    const timezoneOffsetMinutes = savedOffset === null ? -480 : savedOffset
    recipientDates.set(user.openid, {
      localDate: todayForTimezoneOffset(timezoneOffsetMinutes),
      timezoneOffsetMinutes,
      usedFallback: savedOffset === null
    })
  }
  const localDates = Array.from(new Set(Array.from(recipientDates.values()).map(item => item.localDate)))
  if (!localDates.length) {
    users.forEach(user => {
      console.error('[目标用户 openid 缺失]', { userId: user._id })
      results.push({ userId: user._id, sent: false, reason: 'openid_missing' })
    })
    return { fallbackDate: fallbackToday, checkedUsers: users.length, results }
  }

  const [memberships, fridgeMembers, fridges, foods, reminderRows] = await Promise.all([
    fetchAll('household_members'),
    fetchAll('fridge_members'),
    fetchAll('fridges'),
    fetchAll('foods'),
    fetchAll('reminders', { sent: true, scheduled_date: command.in(localDates) })
  ])
  const sentKeys = new Set(reminderRows.map(reminderKeyFromRecord))
  const membershipByUser = new Map(memberships.map(row => [row.user_openid, row]))
  const selectedByUser = selectedFridgesByUser(fridgeMembers)
  const fridgeById = new Map(fridges.map(fridge => [fridge._id, fridge]))

  console.log('[批量数据加载完成]', {
    memberships: memberships.length,
    fridgeMembers: fridgeMembers.length,
    fridges: fridges.length,
    foods: foods.length,
    reminderRows: reminderRows.length
  })

  for (const user of users) {
    if (!user.openid) {
      console.error('[目标用户 openid 缺失]', { userId: user._id })
      results.push({ userId: user._id, sent: false, reason: 'openid_missing' })
      continue
    }

    const dateContext = recipientDates.get(user.openid)
    if (dateContext.usedFallback) {
      console.warn('[用户时区缺失] 暂按 Asia/Shanghai 兼容，请让用户重新打开小程序或订阅', {
        userId: user._id,
        openid: user.openid
      })
    }
    const membership = membershipByUser.get(user.openid)
    let candidates
    try {
      candidates = collectCandidates({
        foods,
        fridgeById,
        recipientOpenid: user.openid,
        householdId: membership ? membership.household_id : '',
        selectedFridgeIds: selectedByUser.get(user.openid) || new Set(),
        today: dateContext.localDate,
        onInvalidFood: (food, error) => console.error('[模板字段构造失败]', {
          errMsg: error.message,
          food_id: food._id,
          openid: user.openid
        })
      })
    } catch (error) {
      console.error('[模板字段构造失败]', { errMsg: error.message, openid: user.openid })
      results.push({ openid: user.openid, sent: false, reason: 'invalid_food_date', errMsg: error.message })
      continue
    }

    let candidate = null
    for (const item of candidates) {
      const key = reminderKey(user.openid, item.food._id, dateContext.localDate, REMINDER_TYPE)
      if (sentKeys.has(key)) {
        console.log('[重复提醒已跳过]', {
          food_id: item.food._id,
          openid: user.openid,
          local_date: dateContext.localDate
        })
      } else {
        candidate = item
        break
      }
    }

    if (!candidate) {
      console.log('[未找到待提醒食材]', {
        openid: user.openid,
        localDate: dateContext.localDate,
        timezoneOffsetMinutes: dateContext.timezoneOffsetMinutes
      })
      continue
    }

    let data
    try {
      data = buildMessageData(candidate.food, candidate.fridge.name, candidate.remainingDays)
    } catch (error) {
      console.error('[模板字段构造失败]', {
        errMsg: error.message,
        food_id: candidate.food._id,
        openid: user.openid
      })
      results.push({ openid: user.openid, foodId: candidate.food._id, sent: false, reason: 'invalid_template_data' })
      continue
    }

    let claimId
    try {
      claimId = await createReminderClaim(user.openid, candidate.food._id, dateContext.localDate)
      if (!claimId) {
        console.log('[重复提醒已跳过]', {
          food_id: candidate.food._id,
          openid: user.openid,
          local_date: dateContext.localDate
        })
        continue
      }
    } catch (error) {
      console.error('[提醒去重占位失败]', {
        errCode: error.errCode,
        errMsg: error.errMsg || error.message,
        food_id: candidate.food._id,
        openid: user.openid
      })
      results.push({ openid: user.openid, foodId: candidate.food._id, sent: false, reason: 'dedupe_claim_failed' })
      continue
    }

    let sendResult
    try {
      sendResult = await cloud.openapi.subscribeMessage.send({
        touser: user.openid,
        page: `pages/food-detail/food-detail?id=${candidate.food._id}`,
        lang: 'zh_CN',
        miniprogramState: config.miniprogramState,
        templateId: config.templateId,
        data
      })
    } catch (error) {
      try { await db.collection('reminders').doc(claimId).remove() } catch (cleanupError) {
        console.error('[提醒去重占位清理失败]', { reminderId: claimId, errMsg: cleanupError.errMsg || cleanupError.message })
      }
      console.error('[订阅消息发送失败]', {
        errCode: error.errCode,
        errMsg: error.errMsg || error.message,
        food_id: candidate.food._id,
        openid: user.openid
      })
      results.push({
        openid: user.openid,
        foodId: candidate.food._id,
        localDate: dateContext.localDate,
        sent: false,
        errCode: error.errCode,
        errMsg: error.errMsg || error.message
      })
      continue
    }

    try {
      await db.collection('reminders').doc(claimId).update({ data: { sent: true, status: 'sent', sent_at: db.serverDate() } })
    } catch (error) {
      // 确定性文档 ID 会继续阻止重复发送；不因发送后的记录更新失败删除去重记录。
      console.error('[提醒发送成功但记录更新失败]', {
        reminderId: claimId,
        errMsg: error.errMsg || error.message,
        food_id: candidate.food._id,
        openid: user.openid
      })
    }
    try {
      await db.collection('users').doc(user._id).update({ data: {
        notification_enabled: false,
        updated_at: db.serverDate()
      } })
    } catch (error) {
      console.error('[提醒发送成功但订阅状态关闭失败]', {
        errMsg: error.errMsg || error.message,
        openid: user.openid
      })
    }
    console.log('[订阅消息发送成功]', {
      errCode: sendResult.errCode,
      errMsg: sendResult.errMsg,
      food_id: candidate.food._id,
      openid: user.openid,
      local_date: dateContext.localDate
    })
    results.push({ openid: user.openid, foodId: candidate.food._id, localDate: dateContext.localDate, sent: true })
  }

  console.log('[检查完成]', { fallbackDate: fallbackToday, checkedUsers: users.length, results })
  return { fallbackDate: fallbackToday, checkedUsers: users.length, results }
}

exports._test = {
  getRemainingDays,
  todayForTimezoneOffset,
  truncateThing,
  formatExpireTime,
  buildLocation,
  buildMessageData,
  validTimezoneOffset,
  reminderDocumentId
}
