function roleLabel(role) {
  return role === 'owner' ? '创建者' : '成员'
}

function memberDisplayName(member, fallbackIndex, currentOpenid) {
  if (member.user_openid === currentOpenid) return '我'
  const savedName = String(member.display_name || member.nickname || member.name || '').trim()
  return savedName || `成员 ${fallbackIndex}`
}

function buildHouseholdPageState(context, currentOpenid) {
  if (!context || !context.hasHousehold) {
    return {
      hasHousehold: false,
      household: null,
      membership: null,
      members: [],
      isOwner: false,
      roleLabel: ''
    }
  }

  const membership = context.membership || null
  const isOwner = Boolean(membership && membership.role === 'owner')
  let fallbackIndex = 0
  const members = (Array.isArray(context.members) ? context.members : []).map(member => {
    if (member.user_openid !== currentOpenid && !String(member.display_name || member.nickname || member.name || '').trim()) {
      fallbackIndex += 1
    }
    return {
      ...member,
      isSelf: member.user_openid === currentOpenid,
      displayName: memberDisplayName(member, fallbackIndex, currentOpenid),
      roleLabel: roleLabel(member.role),
      canRemove: isOwner && member.role === 'member' && member.user_openid !== currentOpenid
    }
  })

  return {
    hasHousehold: true,
    household: context.household,
    membership,
    members,
    isOwner,
    roleLabel: roleLabel(membership && membership.role)
  }
}

module.exports = { roleLabel, memberDisplayName, buildHouseholdPageState }
