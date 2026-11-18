const assert = require('assert')
const {
  FRIDGE_VISIBILITY,
  normalizeFridgeAccessFields,
  canAccessFridge,
  canManageFridge
} = require('../miniprogram/utils/householdAccess')
const { buildFridgeMigration, belongsToMigrationHousehold } = require('../cloudfunctions/household/migration')
const {
  canUpdateHouseholdName,
  canRemoveHouseholdMember,
  canLeaveHousehold
} = require('../cloudfunctions/household/permissions')
const { buildHouseholdPageState } = require('../miniprogram/utils/householdPage')
const {
  canAccessFridge: canAccessFridgeOnServer,
  selectedMembersForVisibility
} = require('../cloudfunctions/household/access')
const { planMemberDeparture, privateFridgeDetachPatch } = require('../cloudfunctions/household/membershipLifecycle')
const { INVITE_STATUS, inviteState, joinState } = require('../cloudfunctions/household/invite')

const creator = 'user-a'
const member = 'user-b'
const other = 'user-c'
const base = { _id: 'fridge-1', _openid: creator, household_id: 'household-1' }

const privateFridge = { ...base, created_by: creator, visibility: FRIDGE_VISIBILITY.PRIVATE }
assert.strictEqual(canAccessFridge(creator, privateFridge), true, 'creator can access private fridge')
assert.strictEqual(canAccessFridge(member, privateFridge, { isHouseholdMember: true }), false, 'member cannot access private fridge')

const householdFridge = { ...base, created_by: creator, visibility: FRIDGE_VISIBILITY.HOUSEHOLD }
assert.strictEqual(canAccessFridge(member, householdFridge, { isHouseholdMember: true }), true, 'member can access household fridge')
assert.strictEqual(canAccessFridge(other, householdFridge, { isHouseholdMember: false }), false, 'non-member cannot access household fridge')

const selectedFridge = { ...base, created_by: creator, visibility: FRIDGE_VISIBILITY.SELECTED }
assert.strictEqual(canAccessFridge(member, selectedFridge, { isHouseholdMember: true, isSelectedMember: true }), true, 'selected member can access selected fridge')
assert.strictEqual(canAccessFridge(member, selectedFridge, { isHouseholdMember: true, isSelectedMember: false }), false, 'unselected member cannot access selected fridge')
assert.strictEqual(canAccessFridge(other, selectedFridge, { isHouseholdMember: false, isSelectedMember: true }), false, 'selected record alone does not grant a non-member access')
assert.strictEqual(canAccessFridge(creator, selectedFridge, { isHouseholdMember: false, isSelectedMember: false }), true, 'creator always has access')

const legacyFridge = { _id: 'legacy-fridge', _openid: creator, name: '旧冰箱' }
assert.deepStrictEqual(normalizeFridgeAccessFields(legacyFridge), {
  ...legacyFridge,
  household_id: '',
  created_by: creator,
  visibility: FRIDGE_VISIBILITY.PRIVATE
})
assert.strictEqual(canAccessFridge(creator, legacyFridge), true, 'legacy owner keeps access')
assert.strictEqual(canAccessFridge(member, legacyFridge, { isHouseholdMember: true }), false, 'legacy fridge defaults to private')
assert.strictEqual(canManageFridge(creator, legacyFridge), true, 'legacy owner can manage fridge')
assert.strictEqual(canManageFridge(member, householdFridge), false, 'shared member cannot manage fridge settings')

assert.deepStrictEqual(buildFridgeMigration(
  { _openid: creator, name: '旧冰箱' },
  creator,
  'household-1'
), {
  household_id: 'household-1',
  created_by: creator,
  visibility: FRIDGE_VISIBILITY.PRIVATE
}, 'legacy fridge receives private household defaults')
assert.deepStrictEqual(buildFridgeMigration(
  { ...householdFridge },
  creator,
  'household-1'
), {}, 'existing household fields are preserved')
assert.deepStrictEqual(buildFridgeMigration(
  { _openid: creator, household_id: 'another-household' },
  creator,
  'household-1'
), {}, 'fridge assigned to another household is not changed')
assert.strictEqual(belongsToMigrationHousehold({ household_id: '' }, 'household-1'), true)
assert.strictEqual(belongsToMigrationHousehold({ household_id: 'another-household' }, 'household-1'), false)

const ownerMembership = { _id: 'member-owner', household_id: 'household-1', user_openid: creator, role: 'owner' }
const memberMembership = { _id: 'member-b', household_id: 'household-1', user_openid: member, role: 'member' }
const otherMember = { _id: 'member-c', household_id: 'household-1', user_openid: other, role: 'member' }
assert.strictEqual(canUpdateHouseholdName(ownerMembership), true, 'owner can update household name')
assert.strictEqual(canUpdateHouseholdName(memberMembership), false, 'member cannot update household name')
assert.strictEqual(canRemoveHouseholdMember(ownerMembership, memberMembership), true, 'owner can remove member')
assert.strictEqual(canRemoveHouseholdMember(memberMembership, otherMember), false, 'member cannot remove another member')
assert.strictEqual(canRemoveHouseholdMember(ownerMembership, ownerMembership), false, 'owner cannot remove self')
assert.strictEqual(canLeaveHousehold(memberMembership), true, 'member can leave household')
assert.strictEqual(canLeaveHousehold(ownerMembership), false, 'owner cannot leave household')

assert.deepStrictEqual(buildHouseholdPageState({ hasHousehold: false }, creator), {
  hasHousehold: false,
  household: null,
  membership: null,
  members: [],
  isOwner: false,
  roleLabel: ''
}, 'user without household sees create state')

const ownerPageState = buildHouseholdPageState({
  hasHousehold: true,
  household: { _id: 'household-1', name: '我的家庭' },
  membership: ownerMembership,
  members: [ownerMembership, memberMembership, { ...otherMember, display_name: '妈妈' }]
}, creator)
assert.strictEqual(ownerPageState.hasHousehold, true, 'household context shows detail state')
assert.strictEqual(ownerPageState.isOwner, true)
assert.strictEqual(ownerPageState.roleLabel, '创建者')
assert.strictEqual(ownerPageState.members[0].displayName, '我')
assert.strictEqual(ownerPageState.members[1].displayName, '成员 1')
assert.strictEqual(ownerPageState.members[1].canRemove, true)
assert.strictEqual(ownerPageState.members[2].displayName, '妈妈')

const memberPageState = buildHouseholdPageState({
  hasHousehold: true,
  household: { _id: 'household-1', name: '我的家庭' },
  membership: memberMembership,
  members: [ownerMembership, memberMembership]
}, member)
assert.strictEqual(memberPageState.isOwner, false)
assert.strictEqual(memberPageState.roleLabel, '成员')
assert.strictEqual(memberPageState.members.every(item => item.canRemove === false), true, 'member page has no remove actions')

const selectedIds = new Set(['fridge-selected'])
assert.strictEqual(canAccessFridgeOnServer(creator, { ...privateFridge, _id: 'fridge-private' }, { householdId: 'household-1', selectedFridgeIds: selectedIds }), true)
assert.strictEqual(canAccessFridgeOnServer(member, { ...privateFridge, _id: 'fridge-private' }, { householdId: 'household-1', selectedFridgeIds: selectedIds }), false)
assert.strictEqual(canAccessFridgeOnServer(member, { ...householdFridge, _id: 'fridge-household' }, { householdId: 'household-1', selectedFridgeIds: selectedIds }), true)
assert.strictEqual(canAccessFridgeOnServer(other, { ...householdFridge, _id: 'fridge-household' }, { householdId: '', selectedFridgeIds: selectedIds }), false)
assert.strictEqual(canAccessFridgeOnServer(member, { ...selectedFridge, _id: 'fridge-selected' }, { householdId: 'household-1', selectedFridgeIds: selectedIds }), true)
assert.strictEqual(canAccessFridgeOnServer(other, { ...selectedFridge, _id: 'fridge-selected' }, { householdId: 'household-1', selectedFridgeIds: new Set() }), false)
assert.strictEqual(canAccessFridgeOnServer(other, { ...selectedFridge, _id: 'fridge-selected' }, { householdId: '', selectedFridgeIds: selectedIds }), false)

assert.deepStrictEqual(selectedMembersForVisibility('private', [member]), [], 'selected to private clears old members')
assert.deepStrictEqual(selectedMembersForVisibility('household', [member]), [], 'selected to household clears old members')
assert.deepStrictEqual(selectedMembersForVisibility('selected', [member, member]), [member], 'selected members are de-duplicated')

const departurePrivate = planMemberDeparture([
  { _id: 'private-owned', created_by: member, household_id: 'household-1', visibility: 'private' }
], member, 'household-1')
assert.strictEqual(departurePrivate.canLeave, true)
assert.deepStrictEqual(departurePrivate.privateFridgeIds, ['private-owned'])
assert.deepStrictEqual(departurePrivate.sharedFridgeIds, [])
assert.deepStrictEqual(privateFridgeDetachPatch(), { household_id: '', visibility: 'private' }, 'private fridge is retained and detached')
const departureShared = planMemberDeparture([
  { _id: 'household-owned', created_by: member, household_id: 'household-1', visibility: 'household' },
  { _id: 'selected-owned', created_by: member, household_id: 'household-1', visibility: 'selected' }
], member, 'household-1')
assert.strictEqual(departureShared.canLeave, false)
assert.deepStrictEqual(departureShared.sharedFridgeIds, ['household-owned', 'selected-owned'])

const future = new Date(Date.now() + 60000)
const past = new Date(Date.now() - 60000)
assert.strictEqual(inviteState({ status: INVITE_STATUS.ACTIVE, expires_at: future }), INVITE_STATUS.ACTIVE, 'valid token')
assert.strictEqual(inviteState({ status: INVITE_STATUS.ACTIVE, expires_at: past }), INVITE_STATUS.EXPIRED, 'expired token')
assert.strictEqual(inviteState({ status: INVITE_STATUS.REVOKED, expires_at: future }), INVITE_STATUS.REVOKED, 'revoked token')
assert.strictEqual(inviteState(null), 'invalid', 'invalid token')
assert.strictEqual(joinState(null, 'household-1'), 'available')
assert.strictEqual(joinState(ownerMembership, 'household-1'), 'already_member', 'owner opens own invite')
assert.strictEqual(joinState(memberMembership, 'household-1'), 'already_member', 'duplicate join')
assert.strictEqual(joinState({ ...memberMembership, household_id: 'household-2' }, 'household-1'), 'other_household')

console.log('Phase 2.5 Household 权限、邀请、成员退出和旧数据兼容测试全部通过')
