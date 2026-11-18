function personalOwnerWhere(openid, extra = {}) {
  return { _openid: String(openid || ''), ...extra }
}

function canAccessPersonalRecord(openid, record) {
  return Boolean(openid && record) && String(record._openid || '') === String(openid)
}

module.exports = { personalOwnerWhere, canAccessPersonalRecord }
