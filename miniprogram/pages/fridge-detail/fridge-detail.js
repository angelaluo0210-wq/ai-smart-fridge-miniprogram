const app = getApp()
const store = require('../../services/database')
const { decorateFood } = require('../../utils/foodStatus')
const { CATEGORIES, decorateCategory } = require('../../utils/categories')

Page({
  data: {
    id: '', fridge: null, allFoods: [], foods: [], loading: true,
    categoryOptions: [{ key: 'all', label: '全部分类' }, ...CATEGORIES],
    categoryNames: ['全部分类', ...CATEGORIES.map(item => item.label)],
    categoryIndex: 0
  },
  onLoad(options) { this.setData({ id: options.id || '' }) },
  onShow() { if (this.data.id) this.loadData() },
  onPullDownRefresh() { this.loadData().finally(() => wx.stopPullDownRefresh()) },

  async loadData() {
    this.setData({ loading: true })
    try {
      const openid = await app.ensureLogin()
      const [fridge, foods] = await Promise.all([store.getFridge(this.data.id, openid), store.listFoods(openid, this.data.id)])
      if (!fridge) throw new Error('冰箱不存在或已删除')
      const decorated = foods.map(food => decorateCategory(decorateFood(food)))
      this.setData({ fridge, allFoods: decorated }, () => this.applyCategoryFilter())
      wx.setNavigationBarTitle({ title: fridge.name })
    } catch (error) {
      console.error(error)
      wx.showToast({ title: error.message || '加载失败', icon: 'none' })
    } finally { this.setData({ loading: false }) }
  },

  addFood() { wx.navigateTo({ url: `/pages/add-food/add-food?fridgeId=${this.data.id}` }) },
  onCategoryChange(event) {
    this.setData({ categoryIndex: Number(event.detail.value) }, () => this.applyCategoryFilter())
  },
  applyCategoryFilter() {
    const option = this.data.categoryOptions[this.data.categoryIndex]
    const foods = !option || option.key === 'all'
      ? this.data.allFoods
      : this.data.allFoods.filter(food => food.categoryKey === option.key)
    this.setData({ foods })
  },
  openFood(event) { wx.navigateTo({ url: `/pages/food-detail/food-detail?id=${event.currentTarget.dataset.id}` }) },
  async consumeFood(event) {
    const { id, name } = event.currentTarget.dataset
    const { confirm } = await wx.showModal({ title: '标记已食用', content: `确认已经食用“${name}”吗？` })
    if (!confirm) return
    try {
      await store.markConsumed(id, await app.ensureLogin())
      wx.showToast({ title: '已移出库存' })
      this.loadData()
    } catch (error) { wx.showToast({ title: '操作失败', icon: 'none' }) }
  },
  async discardFood(event) {
    const { id, name } = event.currentTarget.dataset
    const { confirm } = await wx.showModal({ title: '扔掉食材', content: `确认扔掉“${name}”吗？该记录会保留。`, confirmColor: '#B06B22' })
    if (!confirm) return
    try {
      await store.markDiscarded(id, await app.ensureLogin())
      wx.showToast({ title: '已移出库存' })
      this.loadData()
    } catch (error) { wx.showToast({ title: '操作失败', icon: 'none' }) }
  },
  freezeFood(event) {
    wx.navigateTo({ url: `/pages/freeze-food/freeze-food?id=${event.currentTarget.dataset.id}` })
  },
  async deleteFood(event) {
    const { id, name } = event.currentTarget.dataset
    const { confirm } = await wx.showModal({ title: '删除食材', content: `确定永久删除“${name}”吗？`, confirmColor: '#B83232' })
    if (!confirm) return
    try {
      await store.deleteFood(id, await app.ensureLogin())
      wx.showToast({ title: '已删除' })
      this.loadData()
    } catch (error) { wx.showToast({ title: '删除失败', icon: 'none' }) }
  }
})
