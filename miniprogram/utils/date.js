const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function pad(value) {
  return String(value).padStart(2, '0')
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function parseNaturalDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12, 0, 0, 0)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date
}

function isValidDate(value) {
  return Boolean(parseNaturalDate(value))
}

function todayString(now = new Date()) {
  return formatDate(now)
}

function calculateExpireDate(putInDate, shelfLifeDays) {
  const date = parseNaturalDate(putInDate)
  const days = Number(shelfLifeDays)
  if (!date) throw new Error('放入日期格式不正确')
  if (!Number.isInteger(days) || days <= 0) throw new Error('保存天数必须是大于 0 的整数')
  date.setDate(date.getDate() + days)
  return formatDate(date)
}

function getRemainingDays(expireDate, today = todayString()) {
  const end = parseNaturalDate(expireDate)
  const start = parseNaturalDate(today)
  if (!end || !start) throw new Error('日期格式不正确')
  return Math.round((end.getTime() - start.getTime()) / 86400000)
}

module.exports = { formatDate, parseNaturalDate, isValidDate, todayString, calculateExpireDate, getRemainingDays }
