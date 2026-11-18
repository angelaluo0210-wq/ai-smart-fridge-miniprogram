const app = getApp()
const store = require('../../services/database')
const { decorateFood } = require('../../utils/foodStatus')
const { decorateCategory } = require('../../utils/categories')

Page({
  data: { keyword: '', statusFilter: '', filterLabel: '', allFoods: [], results: [], loading: true, clearingExpired: false },
  onLoad(options) {
    const status = ['all', 'near_expiry', 'expired'].includes(options.status) ? options.status : ''
    const labels = { all: '全部当前库存', near_expiry: '快过期食材', expired: '已过期食材' }
    this.setData({ statusFilter: status, filterLabel: labels[status] || '' })
    if (status) wx.setNavigationBarTitle({ title: labels[status] })
  },
  onShow() { this.loadFoods() },
  async loadFoods() {
    this.setData({ loading: true })
    try {
      const openid = await app.ensureLogin()
      await store.updateUserTimezone(openid, new Date().getTimezoneOffset())
      const [fridges, foods] = await Promise.all([store.listFridges(openid), store.listFoods(openid)])
      const fridgeNames = fridges.reduce((all, item) => { all[item._id] = item.name; return all }, {})
      const allFoods = foods.map(food => decorateCategory({
        ...decorateFood(food),
        fridgeName: fridgeNames[food.fridge_id] || '未知冰箱'
      }))
      this.setData({ allFoods }, () => this.applySearch())
    } catch (error) {
      console.error('搜索数据加载失败', error)
      wx.showToast({ title: '搜索数据加载失败', icon: 'none' })
    } finally { this.setData({ loading: false }) }
  },
  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value }, () => this.applySearch())
  },
  clearKeyword() { this.setData({ keyword: '' }, () => this.applySearch()) },
  applySearch() {
    const keyword = this.data.keyword.trim().toLowerCase()
    const results = this.data.allFoods.filter(food => {
      const matchesKeyword = !keyword || String(food.name || '').toLowerCase().includes(keyword)
      const matchesStatus = !this.data.statusFilter || this.data.statusFilter === 'all' || food.computedStatus === this.data.statusFilter
      return matchesKeyword && matchesStatus
    })
    this.setData({ results })
  },
  openFood(event) {
    wx.navigateTo({ url: `/pages/food-detail/food-detail?id=${event.currentTarget.dataset.id}` })
  },
  clearExpired() {
    if (this.data.clearingExpired || this.data.statusFilter !== 'expired' || !this.data.results.length) return
    const count = this.data.results.length
    wx.showModal({
      title: `发现 ${count} 件已过期食材`,
      content: '清理后将从当前库存中移除，并计入浪费统计。',
      confirmText: '确认清理',
      confirmColor: '#b83232',
      success: async result => {
        if (!result.confirm || this.data.clearingExpired) return
        this.setData({ clearingExpired: true })
        try {
          const response = await store.discardExpiredFoods()
          wx.showToast({ title: `已清理 ${response.updated} 件`, icon: 'success' })
          await this.loadFoods()
        } catch (error) {
          console.error('批量清理过期食材失败', error)
          wx.showToast({ title: error.message || '清理失败，请稍后重试', icon: 'none' })
        } finally { this.setData({ clearingExpired: false }) }
      }
    })
  }
})
