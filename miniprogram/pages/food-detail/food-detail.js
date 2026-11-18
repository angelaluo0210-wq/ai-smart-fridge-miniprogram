const app = getApp()
const store = require('../../services/database')
const { decorateFood } = require('../../utils/foodStatus')
const { decorateCategory } = require('../../utils/categories')

Page({
  data: { id: '', food: null, fridgeName: '', loading: true },
  onLoad(options) { this.setData({ id: options.id || '' }) },
  onShow() { if (this.data.id) this.loadData() },
  async loadData() {
    this.setData({ loading: true })
    try {
      const openid = await app.ensureLogin()
      const food = await store.getFood(this.data.id, openid)
      if (!food) throw new Error('食材不存在或已删除')
      const fridge = await store.getFridge(food.fridge_id, openid)
      this.setData({ food: decorateCategory(decorateFood(food)), fridgeName: fridge ? fridge.name : '冰箱已删除' })
      wx.setNavigationBarTitle({ title: food.name })
    } catch (error) {
      console.error(error)
      wx.showToast({ title: error.message || '加载失败', icon: 'none' })
    } finally { this.setData({ loading: false }) }
  },
  async consume() {
    const { confirm } = await wx.showModal({ title: '标记已食用', content: `确认已经食用“${this.data.food.name}”吗？` })
    if (!confirm) return
    try {
      await store.markConsumed(this.data.id, await app.ensureLogin())
      wx.showToast({ title: '已标记为食用' })
      setTimeout(() => wx.navigateBack(), 500)
    } catch (error) { wx.showToast({ title: '操作失败', icon: 'none' }) }
  },
  async discard() {
    const { confirm } = await wx.showModal({ title: '扔掉食材', content: `确认扔掉“${this.data.food.name}”吗？该记录会保留。`, confirmColor: '#B06B22' })
    if (!confirm) return
    try {
      await store.markDiscarded(this.data.id, await app.ensureLogin())
      wx.showToast({ title: '已移出库存' })
      setTimeout(() => wx.navigateBack(), 500)
    } catch (error) { wx.showToast({ title: '操作失败', icon: 'none' }) }
  },
  freeze() {
    wx.navigateTo({ url: `/pages/freeze-food/freeze-food?id=${this.data.id}` })
  },
  async remove() {
    const { confirm } = await wx.showModal({ title: '删除食材', content: `确定永久删除“${this.data.food.name}”吗？`, confirmColor: '#B83232' })
    if (!confirm) return
    try {
      await store.deleteFood(this.data.id, await app.ensureLogin())
      wx.showToast({ title: '已删除' })
      setTimeout(() => wx.navigateBack(), 500)
    } catch (error) { wx.showToast({ title: '删除失败', icon: 'none' }) }
  }
})
