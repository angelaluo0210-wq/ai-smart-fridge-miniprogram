const app = getApp()
const store = require('../../services/database')
const { todayString, calculateExpireDate } = require('../../utils/date')

Page({
  data: {
    food: null, fridges: [], fridgeNames: [], fridgeIndex: -1,
    storageArea: '冷冻区', shelfLifeDays: '', putInDate: todayString(),
    expirePreview: '', submitting: false
  },
  onLoad(options) { this.foodId = options.id || ''; this.loadData() },
  async loadData() {
    try {
      const openid = await app.ensureLogin()
      const [food, fridges] = await Promise.all([store.getFood(this.foodId, openid), store.listFridges(openid)])
      if (!food) throw new Error('食材不存在或已删除')
      this.setData({
        food, fridges, fridgeNames: fridges.map(item => item.name),
        fridgeIndex: fridges.findIndex(item => item._id === food.fridge_id)
      })
    } catch (error) {
      console.error(error)
      wx.showToast({ title: error.message || '加载失败', icon: 'none' })
    }
  },
  onFridgeChange(event) { this.setData({ fridgeIndex: Number(event.detail.value) }) },
  onInput(event) {
    this.setData({ [event.currentTarget.dataset.field]: event.detail.value }, () => this.updatePreview())
  },
  updatePreview() {
    const days = Number(this.data.shelfLifeDays)
    this.setData({ expirePreview: Number.isInteger(days) && days > 0 ? calculateExpireDate(this.data.putInDate, days) : '' })
  },
  async submit() {
    const daysText = String(this.data.shelfLifeDays)
    const days = Number(daysText)
    if (this.data.fridgeIndex < 0 || !this.data.fridges[this.data.fridgeIndex]) return wx.showToast({ title: '请选择目标冰箱', icon: 'none' })
    if (!/^\d+$/.test(daysText) || !Number.isInteger(days) || days <= 0) return wx.showToast({ title: '请填写新的保存天数', icon: 'none' })
    const { confirm } = await wx.showModal({
      title: '确认转冷冻',
      content: `将从今天重新保存 ${days} 天，预计 ${this.data.expirePreview} 到期。`,
      confirmText: '确认'
    })
    if (!confirm) return
    this.setData({ submitting: true })
    try {
      await store.freezeFood(this.foodId, await app.ensureLogin(), {
        fridge_id: this.data.fridges[this.data.fridgeIndex]._id,
        storage_area: this.data.storageArea,
        put_in_date: this.data.putInDate,
        shelf_life_days: days
      })
      wx.showToast({ title: '已转入冷冻' })
      setTimeout(() => wx.navigateBack(), 500)
    } catch (error) {
      console.error(error)
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally { this.setData({ submitting: false }) }
  }
})
