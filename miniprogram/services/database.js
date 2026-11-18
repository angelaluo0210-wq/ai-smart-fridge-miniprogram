const { calculateExpireDate } = require('../utils/date')
const { isActiveFood } = require('../utils/foodLifecycle')
const householdService = require('./household')
const { personalOwnerWhere } = require('../utils/personalData')

function db() {
  return wx.cloud.database()
}

function ownerWhere(openid, extra = {}) {
  return personalOwnerWhere(openid, extra)
}

async function fetchAll(collectionName, where, orderField) {
  const pageSize = 20
  const rows = []
  while (true) {
    let query = db().collection(collectionName).where(where)
    if (orderField) query = query.orderBy(orderField, 'asc')
    const { data } = await query.skip(rows.length).limit(pageSize).get()
    rows.push(...data)
    if (data.length < pageSize) return rows
  }
}

async function listFridges(openid) {
  return householdService.listAccessibleFridges()
}

async function getFridge(id, openid) {
  return householdService.getAccessibleFridge(id)
}

async function addFridge(fields) {
  return householdService.createFridge(fields)
}

async function updateFridge(id, openid, fields) {
  return householdService.updateFridge(id, fields)
}

async function countFoods(openid, fridgeId) {
  const foods = await listFoods(openid, fridgeId)
  return foods.length
}

async function countFoodRecords(openid, fridgeId) {
  const foods = await listFoods(openid, fridgeId, true)
  return foods.length
}

async function deleteFridge(id, openid, deleteFoods = false) {
  return wx.cloud.callFunction({
    name: 'deleteFridge',
    data: { fridgeId: id, confirmCascade: Boolean(deleteFoods) }
  })
}

async function listFoods(openid, fridgeId, includeInactive = false) {
  const foods = await householdService.listAccessibleFoods(fridgeId || '')
  return includeInactive ? foods : foods.filter(isActiveFood)
}

async function getFood(id, openid) {
  return householdService.getAccessibleFood(id)
}

async function addFood(food) {
  const shelfLifeDays = Number(food.shelf_life_days)
  const data = {
    fridge_id: food.fridge_id,
    name: food.name.trim(),
    category: (food.category || '').trim(),
    storage_area: (food.storage_area || '').trim(),
    quantity: food.quantity ? Number(food.quantity) : null,
    unit: (food.unit || '').trim(),
    put_in_date: food.put_in_date,
    shelf_life_days: shelfLifeDays,
    expire_date: calculateExpireDate(food.put_in_date, shelfLifeDays),
    status: 'fresh',
    note: (food.note || '').trim(),
  }
  return householdService.createFood(data)
}

async function batchAddFoods(fridgeId, foods) {
  const prepared = foods.map(food => {
    const shelfLifeDays = Number(food.shelf_life_days)
    return {
      ...food,
      shelf_life_days: shelfLifeDays,
      expire_date: calculateExpireDate(food.put_in_date, shelfLifeDays)
    }
  })
  return householdService.batchCreateFoods(fridgeId, prepared)
}

async function markConsumed(id, openid) {
  return householdService.markFoodConsumed(id)
}

async function markDiscarded(id, openid) {
  return householdService.markFoodDiscarded(id)
}

async function freezeFood(id, openid, fields) {
  const shelfLifeDays = Number(fields.shelf_life_days)
  const putInDate = fields.put_in_date
  return householdService.freezeFood(id, {
    fridge_id: fields.fridge_id,
    storage_area: (fields.storage_area || '').trim(),
    put_in_date: putInDate,
    shelf_life_days: shelfLifeDays,
    expire_date: calculateExpireDate(putInDate, shelfLifeDays)
  })
}

async function deleteFood(id, openid) {
  return householdService.deleteFood(id)
}

function previewRecipeConsumption(recipe, ingredients) { return householdService.previewRecipeConsumption(recipe, ingredients) }
function consumeRecipeIngredients(recipe, ingredients, operationId) { return householdService.consumeRecipeIngredients(recipe, ingredients, operationId) }
function discardExpiredFoods() { return householdService.discardExpiredFoods() }

async function listFoodTemplates(openid) {
  return fetchAll('food_templates', ownerWhere(openid), 'created_at')
}

async function getFoodTemplate(id, openid) {
  const { data } = await db().collection('food_templates').where(ownerWhere(openid, { _id: id })).limit(1).get()
  return data[0] || null
}

async function addFoodTemplate(template) {
  const now = db().serverDate()
  return db().collection('food_templates').add({ data: {
    name: template.name.trim(),
    category: template.category || '',
    default_shelf_life_days: Number(template.default_shelf_life_days),
    default_fridge_id: template.default_fridge_id || '',
    default_storage_area: (template.default_storage_area || '').trim(),
    created_at: now,
    updated_at: now
  } })
}

async function updateFoodTemplate(id, openid, template) {
  return db().collection('food_templates').where(ownerWhere(openid, { _id: id })).update({ data: {
    name: template.name.trim(),
    category: template.category || '',
    default_shelf_life_days: Number(template.default_shelf_life_days),
    default_fridge_id: template.default_fridge_id || '',
    default_storage_area: (template.default_storage_area || '').trim(),
    updated_at: db().serverDate()
  } })
}

async function deleteFoodTemplate(id, openid) {
  return db().collection('food_templates').where(ownerWhere(openid, { _id: id })).remove()
}

async function listShoppingItems(openid) {
  return fetchAll('shopping_items', ownerWhere(openid), 'created_at')
}

async function addShoppingItem(item) {
  const now = db().serverDate()
  return db().collection('shopping_items').add({ data: {
    name: item.name.trim(),
    category: item.category || '',
    quantity: item.quantity ? Number(item.quantity) : null,
    unit: (item.unit || '').trim(),
    purchased: false,
    purchased_at: null,
    created_at: now,
    updated_at: now
  } })
}

async function markShoppingPurchased(id, openid, purchased = true) {
  return db().collection('shopping_items').where(ownerWhere(openid, { _id: id })).update({ data: {
    purchased: Boolean(purchased),
    purchased_at: purchased ? db().serverDate() : null,
    updated_at: db().serverDate()
  } })
}

async function deleteShoppingItem(id, openid) {
  return db().collection('shopping_items').where(ownerWhere(openid, { _id: id })).remove()
}

function validTimezoneOffset(timezoneOffsetMinutes) {
  const offset = Number(timezoneOffsetMinutes)
  return Number.isFinite(offset) && offset >= -840 && offset <= 840 ? offset : null
}

async function updateUserTimezone(openid, timezoneOffsetMinutes) {
  const offset = validTimezoneOffset(timezoneOffsetMinutes)
  if (offset === null) throw new Error('设备时区偏移无效')
  return db().collection('users').where(ownerWhere(openid, { openid })).update({
    data: {
      timezone_offset_minutes: offset,
      timezone_updated_at: db().serverDate(),
      updated_at: db().serverDate()
    }
  })
}

async function setReminderEnabled(openid, enabled, timezoneOffsetMinutes) {
  const offset = validTimezoneOffset(timezoneOffsetMinutes)
  const data = { notification_enabled: Boolean(enabled), updated_at: db().serverDate() }
  if (offset !== null) {
    data.timezone_offset_minutes = offset
    data.timezone_updated_at = db().serverDate()
  }
  return db().collection('users').where(ownerWhere(openid, { openid })).update({
    data
  })
}

module.exports = {
  listFridges, getFridge, addFridge, updateFridge, countFoods, countFoodRecords, deleteFridge,
  listFoods, getFood, addFood, batchAddFoods, markConsumed, markDiscarded, freezeFood, deleteFood,
  previewRecipeConsumption, consumeRecipeIngredients, discardExpiredFoods,
  listFoodTemplates, getFoodTemplate, addFoodTemplate, updateFoodTemplate, deleteFoodTemplate,
  listShoppingItems, addShoppingItem, markShoppingPurchased, deleteShoppingItem,
  setReminderEnabled, updateUserTimezone
}
