async function callHousehold(action, data = {}) {
  try {
    const response = await wx.cloud.callFunction({
      name: 'household',
      data: { action, ...data }
    })
    if (!response.result) throw new Error('家庭服务未返回结果')
    return response.result
  } catch (error) {
    console.error(`[家庭服务] ${action} 调用失败`, error)
    const rawMessage = String(error.errMsg || error.message || '')
    const knownMessages = [
      '请填写家庭名称',
      '家庭名称最多 30 个字',
      '家庭已创建，但旧数据迁移未完成',
      '当前用户已加入家庭，不能重复创建',
      '家庭记录不存在，请联系家庭创建者',
      '你当前还没有加入家庭',
      '只有家庭创建者可以修改家庭名称',
      '只有家庭创建者可以移除普通成员',
      '创建者不能移除自己',
      '创建者暂时不能直接退出家庭',
      '该成员已不在当前家庭',
      '仍有共享冰箱，请先将这些冰箱改为“仅自己可见”',
      '只有冰箱创建者可以修改冰箱设置',
      '冰箱属于其他家庭，不能修改共享范围',
      '你没有权限访问该冰箱',
      '冰箱不存在或已删除',
      '食材不存在或已删除',
      '实际消耗量必须大于或等于 0',
      '消耗单位',
      '单位不一致，请确认实际使用量',
      '制作操作标识无效',
      '没有可导入的食材',
      '一次最多导入 20 项食材',
      '选择的成员已不在当前家庭',
      '只有家庭创建者可以生成邀请',
      '只有家庭创建者可以撤销邀请',
      '只有家庭创建者可以生成邀请二维码',
      '邀请已过期，请联系创建者重新生成',
      '邀请已被撤销',
      '邀请无效',
      '邀请已失效',
      '邀请不存在',
      '当前账号已经加入一个家庭，请先退出后再加入其他家庭'
    ]
    const friendlyMessage = knownMessages.find(message => rawMessage.includes(message)) || '家庭服务暂时不可用，请稍后重试'
    throw new Error(friendlyMessage)
  }
}

function getHouseholdContext() {
  return callHousehold('getContext')
}

function createHousehold(name) {
  return callHousehold('createHousehold', { name })
}

function migrateOwnedData() {
  return callHousehold('migrateOwnedData')
}

function updateHouseholdName(name) {
  return callHousehold('updateHouseholdName', { name })
}

function removeMember(memberId) {
  return callHousehold('removeMember', { memberId })
}

function leaveHousehold() {
  return callHousehold('leaveHousehold')
}

function listAccessibleFridges() { return callHousehold('listAccessibleFridges') }
function getAccessibleFridge(fridgeId) { return callHousehold('getAccessibleFridge', { fridgeId }) }
function createFridge(fields) { return callHousehold('createFridge', fields) }
function updateFridge(fridgeId, fields) { return callHousehold('updateFridge', { fridgeId, ...fields }) }
function listAccessibleFoods(fridgeId = '') { return callHousehold('listAccessibleFoods', { fridgeId }) }
function getAccessibleFood(foodId) { return callHousehold('getAccessibleFood', { foodId }) }
function createFood(fields) { return callHousehold('createFood', fields) }
function batchCreateFoods(fridgeId, foods) { return callHousehold('batchCreateFoods', { fridgeId, foods }) }
function markFoodConsumed(foodId) { return callHousehold('markFoodConsumed', { foodId }) }
function markFoodDiscarded(foodId) { return callHousehold('markFoodDiscarded', { foodId }) }
function freezeFood(foodId, fields) { return callHousehold('freezeFood', { foodId, ...fields }) }
function deleteFood(foodId) { return callHousehold('deleteFood', { foodId }) }
function previewRecipeConsumption(recipe, ingredients) { return callHousehold('previewRecipeConsumption', ingredients ? { ingredients } : { recipe }) }
function consumeRecipeIngredients(recipe, ingredients, operationId) { return callHousehold('consumeRecipeIngredients', { recipe, ingredients, operationId }) }
function discardExpiredFoods() { return callHousehold('discardExpiredFoods') }
function createInvite() { return callHousehold('createInvite') }
function validateInvite(token) { return callHousehold('validateInvite', { token }) }
function joinHousehold(token) { return callHousehold('joinHousehold', { token }) }
function revokeInvite(inviteId) { return callHousehold('revokeInvite', { inviteId }) }
function createInviteQrCode(inviteId) { return callHousehold('createInviteQrCode', { inviteId }) }

module.exports = {
  getHouseholdContext,
  createHousehold,
  migrateOwnedData,
  updateHouseholdName,
  removeMember,
  leaveHousehold,
  listAccessibleFridges,
  getAccessibleFridge,
  createFridge,
  updateFridge,
  listAccessibleFoods,
  getAccessibleFood,
  createFood,
  batchCreateFoods,
  markFoodConsumed,
  markFoodDiscarded,
  freezeFood,
  deleteFood,
  previewRecipeConsumption,
  consumeRecipeIngredients,
  discardExpiredFoods,
  createInvite,
  validateInvite,
  joinHousehold,
  revokeInvite,
  createInviteQrCode
}
