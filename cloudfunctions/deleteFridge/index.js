const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async event => {
  const { OPENID: openid } = cloud.getWXContext()
  const fridgeId = String(event.fridgeId || '')
  if (!openid || !fridgeId) throw new Error('请求参数不完整')

  const fridgeResult = await db.collection('fridges').where({ _id: fridgeId }).limit(1).get()
  if (!fridgeResult.data.length) throw new Error('冰箱不存在或无权操作')
  const fridge = fridgeResult.data[0]
  const creatorOpenid = fridge.created_by || fridge._openid
  if (creatorOpenid !== openid) throw new Error('只有冰箱创建者可以删除冰箱')
  const foodQuery = { fridge_id: fridgeId }
  const { total: foodCount } = await db.collection('foods').where(foodQuery).count()
  if (foodCount > 0 && !event.confirmCascade) {
    return { deleted: false, requiresConfirmation: true, foodCount }
  }

  // 云端按批次删除，避免小程序端批量删除上限造成孤儿数据。
  let removedFoods = 0
  while (true) {
    const batch = await db.collection('foods').where(foodQuery).limit(100).get()
    if (!batch.data.length) break
    await Promise.all(batch.data.map(food => db.collection('foods').doc(food._id).remove()))
    removedFoods += batch.data.length
  }
  const memberRows = await db.collection('fridge_members').where({ fridge_id: fridgeId }).limit(100).get()
  await Promise.all(memberRows.data.map(row => db.collection('fridge_members').doc(row._id).remove()))
  await db.collection('fridges').doc(fridgeId).remove()
  return { deleted: true, removedFoods }
}
