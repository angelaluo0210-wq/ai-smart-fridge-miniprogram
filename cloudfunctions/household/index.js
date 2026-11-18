const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const config = require('./config')
const { buildFridgeMigration, belongsToMigrationHousehold } = require('./migration')
const { canUpdateHouseholdName, canRemoveHouseholdMember, canLeaveHousehold } = require('./permissions')
const {
  VISIBILITY, VALID_VISIBILITIES, normalizeFridge, canAccessFridge, canManageFridge, selectedMembersForVisibility
} = require('./access')
const { planMemberDeparture, privateFridgeDetachPatch } = require('./membershipLifecycle')
const { INVITE_STATUS, inviteState, joinState } = require('./invite')
const { localDateForOffset } = require('./date')
const {
  namesMatch, recipeIngredients, previewConsumption, buildDeductionPlan, normalizeRequestedIngredients, expiredFoodsForCleanup,
  hasOperationId, nextOperationIds
} = require('./recipeConsumption')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const command = db.command

const VALID_ACTIONS = new Set([
  'getContext', 'createHousehold', 'migrateOwnedData', 'updateHouseholdName', 'removeMember', 'leaveHousehold',
  'listAccessibleFridges', 'getAccessibleFridge', 'createFridge', 'updateFridge',
  'listAccessibleFoods', 'getAccessibleFood', 'createFood', 'batchCreateFoods', 'markFoodConsumed', 'markFoodDiscarded',
  'freezeFood', 'deleteFood', 'previewRecipeConsumption', 'consumeRecipeIngredients', 'discardExpiredFoods',
  'createInvite', 'validateInvite', 'joinHousehold', 'revokeInvite', 'createInviteQrCode'
])

function normalizeText(value, maxLength, label, required = false) {
  const text = String(value || '').trim()
  if (required && !text) throw new Error(`请填写${label}`)
  if (Array.from(text).length > maxLength) throw new Error(`${label}最多 ${maxLength} 个字`)
  return text
}

function normalizeHouseholdName(name) { return normalizeText(name, 30, '家庭名称', true) }
function normalizeFridgeName(name) { return normalizeText(name, 30, '冰箱名称', true) }

async function fetchAll(collectionName, where = {}) {
  const rows = []
  const pageSize = 100
  while (true) {
    const { data } = await db.collection(collectionName).where(where).skip(rows.length).limit(pageSize).get()
    rows.push(...data)
    if (data.length < pageSize) return rows
  }
}

async function updateInBatches(collectionName, updates) {
  let updated = 0
  for (let index = 0; index < updates.length; index += 20) {
    const batch = updates.slice(index, index + 20)
    await Promise.all(batch.map(item => db.collection(collectionName).doc(item.id).update({ data: item.data })))
    updated += batch.length
  }
  return updated
}

async function removeRows(collectionName, rows) {
  for (let index = 0; index < rows.length; index += 20) {
    await Promise.all(rows.slice(index, index + 20).map(row => db.collection(collectionName).doc(row._id).remove()))
  }
  return rows.length
}

async function getDocument(collectionName, id) {
  if (!id) return null
  try {
    const result = await db.collection(collectionName).doc(String(id)).get()
    return result.data || null
  } catch (error) {
    if (/not exist|does not exist|不存在/i.test(String(error.errMsg || error.message || ''))) return null
    throw error
  }
}

async function findMembership(openid) {
  const result = await db.collection('household_members').where({ user_openid: openid }).limit(1).get()
  return result.data[0] || null
}

async function currentUser(openid) {
  const result = await db.collection('users').where({ openid }).limit(1).get()
  return result.data[0] || {}
}

async function getHousehold(householdId) { return getDocument('households', householdId) }

function safeMember(member) {
  return {
    _id: member._id, household_id: member.household_id, user_openid: member.user_openid,
    role: member.role, display_name: member.display_name || '', joined_at: member.joined_at,
    created_at: member.created_at, updated_at: member.updated_at
  }
}

async function listMembers(householdId) {
  const members = await fetchAll('household_members', { household_id: householdId })
  return members.sort((a, b) => a.role === b.role
    ? String(a._id).localeCompare(String(b._id))
    : (a.role === 'owner' ? -1 : 1)).map(safeMember)
}

async function getContext(openid) {
  const membership = await findMembership(openid)
  if (!membership) return { hasHousehold: false, household: null, membership: null, members: [] }
  const household = await getHousehold(membership.household_id)
  if (!household) throw new Error('家庭记录不存在，请联系家庭创建者')
  return { hasHousehold: true, household, membership: safeMember(membership), members: await listMembers(household._id) }
}

function membershipDocumentId(openid) {
  return `hm_${crypto.createHash('sha256').update(openid).digest('hex').slice(0, 29)}`
}

function fridgeMemberDocumentId(fridgeId, openid) {
  return `fm_${crypto.createHash('sha256').update(`${fridgeId}:${openid}`).digest('hex').slice(0, 29)}`
}

async function migrateOwnedData(openid, householdId) {
  const now = db.serverDate()
  const ownedFridges = await fetchAll('fridges', { _openid: openid })
  const fridgeUpdates = ownedFridges.map(fridge => ({ id: fridge._id, data: buildFridgeMigration(fridge, openid, householdId) }))
    .filter(item => Object.keys(item.data).length)
  fridgeUpdates.forEach(item => { item.data.updated_at = now })
  const migratedFridges = await updateInBatches('fridges', fridgeUpdates)
  const foodUpdates = []
  for (const fridge of ownedFridges.filter(item => belongsToMigrationHousehold(item, householdId))) {
    const foods = await fetchAll('foods', { fridge_id: fridge._id })
    foods.forEach(food => {
      if (!food.household_id) foodUpdates.push({ id: food._id, data: { household_id: householdId, updated_at: now } })
    })
  }
  const migratedFoods = await updateInBatches('foods', foodUpdates)
  return { fridges: migratedFridges, foods: migratedFoods }
}

async function createHousehold(openid, name) {
  if ((await getContext(openid)).hasHousehold) throw new Error('当前用户已加入家庭，不能重复创建')
  const transaction = await db.startTransaction()
  let householdId = ''
  try {
    const now = db.serverDate()
    const householdResult = await transaction.collection('households').add({ data: {
      _openid: openid, name: normalizeHouseholdName(name), owner_openid: openid, created_at: now, updated_at: now
    } })
    householdId = householdResult._id
    await transaction.collection('household_members').add({ data: {
      _id: membershipDocumentId(openid), _openid: openid, household_id: householdId,
      user_openid: openid, role: 'owner', joined_at: now, created_at: now, updated_at: now
    } })
    await transaction.commit()
  } catch (error) {
    await transaction.rollback()
    throw error
  }
  try {
    const migration = await migrateOwnedData(openid, householdId)
    return { ...(await getContext(openid)), migration }
  } catch (error) {
    throw new Error(`家庭已创建，但旧数据迁移未完成：${error.message}`)
  }
}

async function accessContext(openid) {
  const membership = await findMembership(openid)
  const selectedRows = membership ? await fetchAll('fridge_members', { user_openid: openid }) : []
  return { membership, householdId: membership ? membership.household_id : '', selectedFridgeIds: new Set(selectedRows.map(row => row.fridge_id)) }
}

async function accessibleFridges(openid) {
  const context = await accessContext(openid)
  const rows = await fetchAll('fridges', { _openid: openid })
  if (context.householdId) rows.push(...await fetchAll('fridges', { household_id: context.householdId }))
  const unique = new Map(rows.map(row => [row._id, row]))
  return Array.from(unique.values()).filter(fridge => canAccessFridge(openid, fridge, context)).map(fridge => ({
    ...normalizeFridge(fridge), can_manage: canManageFridge(openid, fridge)
  })).sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
}

async function requireAccessibleFridge(openid, fridgeId) {
  const fridge = await getDocument('fridges', fridgeId)
  if (!fridge) throw new Error('冰箱不存在或已删除')
  if (!canAccessFridge(openid, fridge, await accessContext(openid))) throw new Error('你没有权限访问该冰箱')
  return fridge
}

async function selectedOpenidsForFridge(fridgeId) {
  return (await fetchAll('fridge_members', { fridge_id: fridgeId })).map(row => row.user_openid)
}

async function validateSelectedMembers(householdId, creatorOpenid, selectedOpenids) {
  const requested = Array.from(new Set((selectedOpenids || []).map(String).filter(Boolean))).filter(id => id !== creatorOpenid)
  if (!requested.length) return []
  const valid = new Set((await fetchAll('household_members', { household_id: householdId })).map(row => row.user_openid))
  if (requested.some(openid => !valid.has(openid))) throw new Error('选择的成员已不在当前家庭')
  return requested
}

async function syncFridgeMembers(fridge, selectedOpenids) {
  await removeRows('fridge_members', await fetchAll('fridge_members', { fridge_id: fridge._id }))
  const requested = selectedMembersForVisibility(fridge.visibility, selectedOpenids)
  if (!requested.length) return 0
  const now = db.serverDate()
  const rows = await validateSelectedMembers(fridge.household_id, fridge.created_by, requested)
  await Promise.all(rows.map(userOpenid => db.collection('fridge_members').add({ data: {
    _id: fridgeMemberDocumentId(fridge._id, userOpenid), _openid: fridge.created_by,
    fridge_id: fridge._id, household_id: fridge.household_id, user_openid: userOpenid,
    permission: 'editor', created_at: now
  } })))
  return rows.length
}

async function getAccessibleFridge(openid, fridgeId) {
  const raw = await requireAccessibleFridge(openid, fridgeId)
  const fridge = { ...normalizeFridge(raw), can_manage: canManageFridge(openid, raw) }
  fridge.selected_member_openids = fridge.can_manage ? await selectedOpenidsForFridge(fridge._id) : []
  return fridge
}

async function createFridge(openid, event) {
  const context = await getContext(openid)
  let visibility = VALID_VISIBILITIES.has(event.visibility) ? event.visibility : VISIBILITY.PRIVATE
  const householdId = context.hasHousehold ? context.household._id : ''
  if (!householdId) visibility = VISIBILITY.PRIVATE
  const selectedOpenids = visibility === VISIBILITY.SELECTED
    ? await validateSelectedMembers(householdId, openid, event.selectedMemberOpenids)
    : []
  const now = db.serverDate()
  const result = await db.collection('fridges').add({ data: {
    _openid: openid, household_id: householdId, created_by: openid,
    name: normalizeFridgeName(event.name), location: normalizeText(event.location, 30, '所在位置'),
    visibility, created_at: now, updated_at: now
  } })
  const fridge = await getDocument('fridges', result._id)
  await syncFridgeMembers(normalizeFridge(fridge), selectedOpenids)
  return getAccessibleFridge(openid, result._id)
}

async function updateFridge(openid, event) {
  const raw = await getDocument('fridges', event.fridgeId)
  if (!raw) throw new Error('冰箱不存在或已删除')
  if (!canManageFridge(openid, raw)) throw new Error('只有冰箱创建者可以修改冰箱设置')
  const context = await getContext(openid)
  let visibility = VALID_VISIBILITIES.has(event.visibility) ? event.visibility : VISIBILITY.PRIVATE
  const currentHouseholdId = context.hasHousehold ? context.household._id : ''
  const existingHouseholdId = String(raw.household_id || '')
  let householdId = existingHouseholdId
  if (visibility !== VISIBILITY.PRIVATE) {
    if (!currentHouseholdId) visibility = VISIBILITY.PRIVATE
    else if (existingHouseholdId && existingHouseholdId !== currentHouseholdId) throw new Error('冰箱属于其他家庭，不能修改共享范围')
    else householdId = currentHouseholdId
  }
  const selectedOpenids = visibility === VISIBILITY.SELECTED
    ? await validateSelectedMembers(householdId, openid, event.selectedMemberOpenids)
    : []
  await db.collection('fridges').doc(raw._id).update({ data: {
    name: normalizeFridgeName(event.name), location: normalizeText(event.location, 30, '所在位置'),
    household_id: householdId, visibility, updated_at: db.serverDate()
  } })
  if (householdId !== existingHouseholdId) {
    const foods = await fetchAll('foods', { fridge_id: raw._id })
    await updateInBatches('foods', foods.map(food => ({ id: food._id, data: { household_id: householdId, updated_at: db.serverDate() } })))
  }
  const fridge = normalizeFridge(await getDocument('fridges', raw._id))
  await syncFridgeMembers(fridge, selectedOpenids)
  return getAccessibleFridge(openid, raw._id)
}

async function fetchFoodsForFridges(fridgeIds) {
  const foods = []
  for (let index = 0; index < fridgeIds.length; index += 20) {
    foods.push(...await fetchAll('foods', { fridge_id: command.in(fridgeIds.slice(index, index + 20)) }))
  }
  return foods.sort((a, b) => String(a.expire_date || '').localeCompare(String(b.expire_date || '')))
}

async function listAccessibleFoods(openid, fridgeId) {
  const fridges = fridgeId ? [await requireAccessibleFridge(openid, fridgeId)] : await accessibleFridges(openid)
  return fetchFoodsForFridges(fridges.map(fridge => fridge._id))
}

async function requireAccessibleFood(openid, foodId) {
  const food = await getDocument('foods', foodId)
  if (!food) throw new Error('食材不存在或已删除')
  await requireAccessibleFridge(openid, food.fridge_id)
  return food
}

function foodInput(event, fridge, openid) {
  const shelfLifeDays = Number(event.shelf_life_days)
  if (!Number.isInteger(shelfLifeDays) || shelfLifeDays <= 0) throw new Error('保存天数必须是正整数')
  return {
    _openid: openid, household_id: String(fridge.household_id || ''), fridge_id: fridge._id,
    name: normalizeText(event.name, 30, '食材名称', true), category: normalizeText(event.category, 30, '分类'),
    storage_area: normalizeText(event.storage_area, 30, '存放位置'),
    quantity: event.quantity ? Number(event.quantity) : null, unit: normalizeText(event.unit, 10, '单位'),
    put_in_date: String(event.put_in_date || ''), shelf_life_days: shelfLifeDays,
    expire_date: String(event.expire_date || ''), status: 'fresh', note: normalizeText(event.note, 100, '备注')
  }
}

async function createFood(openid, event) {
  const fridge = await requireAccessibleFridge(openid, event.fridge_id)
  const now = db.serverDate()
  const data = foodInput(event, fridge, openid)
  data.created_at = now
  data.updated_at = now
  const result = await db.collection('foods').add({ data })
  return getDocument('foods', result._id)
}

async function batchCreateFoods(openid, event) {
  const rows = Array.isArray(event.foods) ? event.foods : []
  if (!rows.length) throw new Error('没有可导入的食材')
  if (rows.length > 20) throw new Error('一次最多导入 20 项食材')
  const fridge = await requireAccessibleFridge(openid, event.fridgeId)
  const inputs = rows.map(row => foodInput({ ...row, fridge_id: fridge._id }, fridge, openid))
  const transaction = await db.startTransaction()
  try {
    const now = db.serverDate()
    const ids = []
    for (const input of inputs) {
      const result = await transaction.collection('foods').add({ data: { ...input, created_at: now, updated_at: now } })
      ids.push(result._id)
    }
    await transaction.commit()
    return { created: ids.length, foodIds: ids }
  } catch (error) {
    await transaction.rollback()
    throw error
  }
}

async function markFood(openid, foodId, status) {
  const food = await requireAccessibleFood(openid, foodId)
  const timestampField = status === 'consumed' ? 'consumed_at' : 'discarded_at'
  await db.collection('foods').doc(food._id).update({ data: { status, [timestampField]: db.serverDate(), updated_at: db.serverDate() } })
  return { updated: true }
}

async function previewRecipeConsumption(openid, event) {
  const [foods, user] = await Promise.all([listAccessibleFoods(openid), currentUser(openid)])
  const today = localDateForOffset(user.timezone_offset_minutes)
  const ingredients = Array.isArray(event.ingredients)
    ? normalizeRequestedIngredients(event.ingredients).map(item => ({ ...item, estimated: true }))
    : recipeIngredients(event.recipe)
  return { today, ingredients: previewConsumption(foods, ingredients, today) }
}

function validOperationId(value) {
  const operationId = String(value || '').trim()
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(operationId)) throw new Error('制作操作标识无效，请返回后重试')
  return operationId
}

async function consumeRecipeIngredients(openid, event) {
  const operationId = validOperationId(event.operationId)
  const ingredients = normalizeRequestedIngredients(event.ingredients)
  const [accessibleFoods, user] = await Promise.all([listAccessibleFoods(openid), currentUser(openid)])
  const today = localDateForOffset(user.timezone_offset_minutes)
  const candidates = accessibleFoods.filter(food => ingredients.some(item => namesMatch(food.name, item.name)))
  const transaction = await db.startTransaction()
  try {
    const currentFoods = []
    for (const candidate of candidates) {
      const result = await transaction.collection('foods').doc(candidate._id).get()
      if (result.data) currentFoods.push(result.data)
    }
    if (currentFoods.some(food => hasOperationId(food, operationId))) {
      await transaction.rollback()
      return { updated: 0, alreadyApplied: true, operationId, summaries: [] }
    }
    const plan = buildDeductionPlan(currentFoods, ingredients, today)
    const currentById = new Map(currentFoods.map(food => [food._id, food]))
    const finalByFood = new Map()
    plan.deductions.forEach(item => {
      const existing = finalByFood.get(item.foodId)
      finalByFood.set(item.foodId, existing ? { ...item, before: existing.before, used: existing.used + item.used } : { ...item })
    })
    const now = db.serverDate()
    for (const deduction of finalByFood.values()) {
      const currentFood = currentById.get(deduction.foodId)
      const data = {
        quantity: deduction.after,
        recipe_operation_ids: nextOperationIds(currentFood, operationId),
        updated_at: now
      }
      if (deduction.after <= 0) {
        data.status = 'consumed'
        data.consumed_at = now
      }
      await transaction.collection('foods').doc(deduction.foodId).update({ data })
    }
    await transaction.commit()
    return {
      updated: finalByFood.size, alreadyApplied: false, operationId, summaries: plan.summaries,
      deductions: Array.from(finalByFood.values())
    }
  } catch (error) {
    try { await transaction.rollback() } catch (rollbackError) {}
    throw error
  }
}

async function discardExpiredFoods(openid) {
  const [foods, user] = await Promise.all([listAccessibleFoods(openid), currentUser(openid)])
  const today = localDateForOffset(user.timezone_offset_minutes)
  const expired = expiredFoodsForCleanup(foods, today)
  const now = db.serverDate()
  await updateInBatches('foods', expired.map(food => ({
    id: food._id, data: { status: 'discarded', discarded_at: now, updated_at: now }
  })))
  return { updated: expired.length, today }
}

async function freezeFood(openid, event) {
  const food = await requireAccessibleFood(openid, event.foodId)
  const target = await requireAccessibleFridge(openid, event.fridge_id)
  const shelfLifeDays = Number(event.shelf_life_days)
  if (!Number.isInteger(shelfLifeDays) || shelfLifeDays <= 0) throw new Error('保存天数必须是正整数')
  await db.collection('foods').doc(food._id).update({ data: {
    fridge_id: target._id, household_id: String(target.household_id || ''),
    storage_area: normalizeText(event.storage_area, 30, '存放位置'), put_in_date: String(event.put_in_date || ''),
    shelf_life_days: shelfLifeDays, expire_date: String(event.expire_date || ''), status: 'fresh',
    frozen_at: db.serverDate(), updated_at: db.serverDate()
  } })
  return { updated: true }
}

async function deleteFood(openid, foodId) {
  const food = await requireAccessibleFood(openid, foodId)
  await db.collection('foods').doc(food._id).remove()
  return { deleted: true }
}

async function updateHouseholdName(openid, name) {
  const context = await getContext(openid)
  if (!context.hasHousehold) throw new Error('你当前还没有加入家庭')
  if (!canUpdateHouseholdName(context.membership)) throw new Error('只有家庭创建者可以修改家庭名称')
  await db.collection('households').doc(context.household._id).update({ data: { name: normalizeHouseholdName(name), updated_at: db.serverDate() } })
  return getContext(openid)
}

async function ownedHouseholdFridges(userOpenid, householdId) {
  const rows = [...await fetchAll('fridges', { created_by: userOpenid }), ...await fetchAll('fridges', { _openid: userOpenid })]
  return Array.from(new Map(rows.map(row => [row._id, row])).values()).filter(row => String(row.household_id || '') === householdId)
}

async function detachPrivateFridges(userOpenid, householdId) {
  const plan = planMemberDeparture(await ownedHouseholdFridges(userOpenid, householdId), userOpenid, householdId)
  if (!plan.canLeave) throw new Error('仍有共享冰箱，请先将这些冰箱改为“仅自己可见”')
  for (const fridgeId of plan.privateFridgeIds) {
    await db.collection('fridges').doc(fridgeId).update({ data: { ...privateFridgeDetachPatch(), updated_at: db.serverDate() } })
    const foods = await fetchAll('foods', { fridge_id: fridgeId })
    await updateInBatches('foods', foods.map(food => ({ id: food._id, data: { household_id: '', updated_at: db.serverDate() } })))
    await removeRows('fridge_members', await fetchAll('fridge_members', { fridge_id: fridgeId }))
  }
  return plan.privateFridgeIds.length
}

async function removeMember(openid, memberId) {
  const context = await getContext(openid)
  const target = await getDocument('household_members', memberId)
  if (!context.hasHousehold || !target || target.household_id !== context.household._id) throw new Error('该成员已不在当前家庭')
  if (target.user_openid === openid) throw new Error('创建者不能移除自己')
  if (!canRemoveHouseholdMember(context.membership, target)) throw new Error('只有家庭创建者可以移除普通成员')
  const detachedPrivateFridges = await detachPrivateFridges(target.user_openid, context.household._id)
  await db.collection('household_members').doc(target._id).remove()
  await removeRows('fridge_members', await fetchAll('fridge_members', { user_openid: target.user_openid }))
  return { ...(await getContext(openid)), detachedPrivateFridges }
}

async function leaveHousehold(openid) {
  const context = await getContext(openid)
  if (!context.hasHousehold) throw new Error('你当前还没有加入家庭')
  if (!canLeaveHousehold(context.membership)) throw new Error('创建者暂时不能直接退出家庭')
  const detachedPrivateFridges = await detachPrivateFridges(openid, context.household._id)
  await db.collection('household_members').doc(context.membership._id).remove()
  await removeRows('fridge_members', await fetchAll('fridge_members', { user_openid: openid }))
  return { left: true, hasHousehold: false, household: null, membership: null, members: [], detachedPrivateFridges }
}

function randomInviteToken() { return crypto.randomBytes(24).toString('base64url') }
function safeInvite(invite) { return { _id: invite._id, token: invite.invite_token, status: invite.status, expires_at: invite.expires_at, qr_file_id: invite.qr_file_id || '' } }

async function usableInvite(token) {
  const result = await db.collection('household_invites').where({ invite_token: String(token || '') }).limit(1).get()
  const invite = result.data[0] || null
  const state = inviteState(invite)
  if (invite && state === INVITE_STATUS.EXPIRED && invite.status === INVITE_STATUS.ACTIVE) {
    await db.collection('household_invites').doc(invite._id).update({ data: { status: INVITE_STATUS.EXPIRED } })
  }
  return { invite, state }
}

async function createInvite(openid) {
  const context = await getContext(openid)
  if (!context.hasHousehold || context.membership.role !== 'owner') throw new Error('只有家庭创建者可以生成邀请')
  const existing = await fetchAll('household_invites', { household_id: context.household._id, status: INVITE_STATUS.ACTIVE })
  for (const row of existing) {
    if (inviteState(row) === INVITE_STATUS.ACTIVE) return { invite: safeInvite(row), household: context.household }
    await db.collection('household_invites').doc(row._id).update({ data: { status: INVITE_STATUS.EXPIRED } })
  }
  const now = new Date()
  const result = await db.collection('household_invites').add({ data: {
    _openid: openid, household_id: context.household._id, invite_token: randomInviteToken(), created_by: openid,
    expires_at: new Date(now.getTime() + config.inviteExpiresHours * 60 * 60 * 1000),
    status: INVITE_STATUS.ACTIVE, created_at: db.serverDate()
  } })
  return { invite: safeInvite(await getDocument('household_invites', result._id)), household: context.household }
}

async function validateInvite(openid, token) {
  const { invite, state } = await usableInvite(token)
  if (!invite || state === 'invalid') return { valid: false, state: 'invalid' }
  if (state !== INVITE_STATUS.ACTIVE) return { valid: false, state }
  const household = await getHousehold(invite.household_id)
  if (!household) return { valid: false, state: 'invalid' }
  const currentMembership = await findMembership(openid)
  return {
    valid: true, state, membershipState: joinState(currentMembership, household._id),
    household: { _id: household._id, name: household.name }, invite: safeInvite(invite)
  }
}

async function joinHousehold(openid, token) {
  const validation = await validateInvite(openid, token)
  if (!validation.valid) {
    if (validation.state === INVITE_STATUS.EXPIRED) throw new Error('邀请已过期，请联系创建者重新生成')
    if (validation.state === INVITE_STATUS.REVOKED) throw new Error('邀请已被撤销')
    throw new Error('邀请无效')
  }
  if (validation.membershipState === 'other_household') throw new Error('当前账号已经加入一个家庭，请先退出后再加入其他家庭')
  if (validation.membershipState === 'already_member') return { ...(await getContext(openid)), alreadyMember: true }
  const now = db.serverDate()
  try {
    await db.collection('household_members').add({ data: {
      _id: membershipDocumentId(openid), _openid: openid, household_id: validation.household._id,
      user_openid: openid, role: 'member', joined_at: now, created_at: now, updated_at: now
    } })
  } catch (error) {
    const existing = await findMembership(openid)
    if (!existing || existing.household_id !== validation.household._id) throw error
  }
  return { ...(await getContext(openid)), joined: true }
}

async function revokeInvite(openid, inviteId) {
  const context = await getContext(openid)
  if (!context.hasHousehold || context.membership.role !== 'owner') throw new Error('只有家庭创建者可以撤销邀请')
  const invite = await getDocument('household_invites', inviteId)
  if (!invite || invite.household_id !== context.household._id) throw new Error('邀请不存在')
  await db.collection('household_invites').doc(invite._id).update({ data: { status: INVITE_STATUS.REVOKED, revoked_at: db.serverDate() } })
  return { revoked: true }
}

async function createInviteQrCode(openid, inviteId) {
  const context = await getContext(openid)
  if (!context.hasHousehold || context.membership.role !== 'owner') throw new Error('只有家庭创建者可以生成邀请二维码')
  const invite = await getDocument('household_invites', inviteId)
  if (!invite || invite.household_id !== context.household._id || inviteState(invite) !== INVITE_STATUS.ACTIVE) throw new Error('邀请已失效')
  if (invite.qr_file_id) return { fileId: invite.qr_file_id }
  const code = await cloud.openapi.wxacode.getUnlimited({
    scene: invite.invite_token, page: 'pages/join-household/join-household', width: 430,
    checkPath: false, envVersion: config.qrEnvVersion
  })
  const upload = await cloud.uploadFile({ cloudPath: `household-invites/${invite._id}.jpg`, fileContent: code.buffer })
  await db.collection('household_invites').doc(invite._id).update({ data: { qr_file_id: upload.fileID } })
  return { fileId: upload.fileID }
}

exports.main = async event => {
  const { OPENID: openid } = cloud.getWXContext()
  if (!openid) throw new Error('无法获取微信用户身份')
  const action = String(event.action || '')
  if (!VALID_ACTIONS.has(action)) throw new Error('不支持的家庭服务操作')
  if (action === 'getContext') return getContext(openid)
  if (action === 'createHousehold') return createHousehold(openid, event.name)
  if (action === 'updateHouseholdName') return updateHouseholdName(openid, event.name)
  if (action === 'removeMember') return removeMember(openid, event.memberId)
  if (action === 'leaveHousehold') return leaveHousehold(openid)
  if (action === 'listAccessibleFridges') return accessibleFridges(openid)
  if (action === 'getAccessibleFridge') return getAccessibleFridge(openid, event.fridgeId)
  if (action === 'createFridge') return createFridge(openid, event)
  if (action === 'updateFridge') return updateFridge(openid, event)
  if (action === 'listAccessibleFoods') return listAccessibleFoods(openid, event.fridgeId)
  if (action === 'getAccessibleFood') return requireAccessibleFood(openid, event.foodId)
  if (action === 'createFood') return createFood(openid, event)
  if (action === 'batchCreateFoods') return batchCreateFoods(openid, event)
  if (action === 'markFoodConsumed') return markFood(openid, event.foodId, 'consumed')
  if (action === 'markFoodDiscarded') return markFood(openid, event.foodId, 'discarded')
  if (action === 'freezeFood') return freezeFood(openid, event)
  if (action === 'deleteFood') return deleteFood(openid, event.foodId)
  if (action === 'previewRecipeConsumption') return previewRecipeConsumption(openid, event)
  if (action === 'consumeRecipeIngredients') return consumeRecipeIngredients(openid, event)
  if (action === 'discardExpiredFoods') return discardExpiredFoods(openid)
  if (action === 'createInvite') return createInvite(openid)
  if (action === 'validateInvite') return validateInvite(openid, event.token)
  if (action === 'joinHousehold') return joinHousehold(openid, event.token)
  if (action === 'revokeInvite') return revokeInvite(openid, event.inviteId)
  if (action === 'createInviteQrCode') return createInviteQrCode(openid, event.inviteId)
  const context = await getContext(openid)
  if (!context.hasHousehold || context.membership.role !== 'owner') throw new Error('只有家庭创建者可以执行旧数据迁移')
  return { ...context, migration: await migrateOwnedData(openid, context.household._id) }
}

exports._test = { normalizeHouseholdName, membershipDocumentId, fridgeMemberDocumentId, randomInviteToken }
