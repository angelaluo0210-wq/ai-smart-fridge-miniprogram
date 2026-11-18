const app = getApp()
const store = require('../../services/database')
const { decorateFood } = require('../../utils/foodStatus')

Page({
  data: { loading: true, nearExpiry: [], expired: [] },
  onShow() { this.loadData() },
  onPullDownRefresh() { this.loadData().finally(() => wx.stopPullDownRefresh()) },
  async loadData() {
    this.setData({ loading: true })
    try {
      const openid = await app.ensureLogin()
      const [fridges, foods] = await Promise.all([store.listFridges(openid), store.listFoods(openid)])
      const names = fridges.reduce((all, item) => { all[item._id] = item.name; return all }, {})
      const decorated = foods.map(item => ({ ...decorateFood(item), fridgeName: names[item.fridge_id] || '未知冰箱' }))
      this.setData({
        nearExpiry: decorated.filter(item => item.computedStatus === 'near_expiry').sort((a, b) => a.remainingDays - b.remainingDays),
        expired: decorated.filter(item => item.computedStatus === 'expired').sort((a, b) => a.remainingDays - b.remainingDays)
      })
    } catch (error) {
      console.error(error)
      wx.showToast({ title: '提醒加载失败', icon: 'none' })
    } finally { this.setData({ loading: false }) }
  },
  openFood(event) { wx.navigateTo({ url: `/pages/food-detail/food-detail?id=${event.currentTarget.dataset.id}` }) }
})
