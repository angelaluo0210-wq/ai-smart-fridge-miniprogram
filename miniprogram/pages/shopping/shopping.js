const app = getApp()
const store = require('../../services/database')
const { decorateCategory } = require('../../utils/categories')

Page({
  data: { pending: [], purchased: [], loading: true },
  onShow() { this.loadData() },
  onPullDownRefresh() { this.loadData().finally(() => wx.stopPullDownRefresh()) },
  async loadData() {
    this.setData({ loading: true })
    try {
      const items = (await store.listShoppingItems(await app.ensureLogin())).map(decorateCategory)
      this.setData({ pending: items.filter(item => !item.purchased), purchased: items.filter(item => item.purchased) })
    } catch (error) {
      console.error(error)
      wx.showToast({ title: '购物清单加载失败', icon: 'none' })
    } finally { this.setData({ loading: false }) }
  },
  addItem() { wx.navigateTo({ url: '/pages/add-shopping/add-shopping' }) },
  async markPurchased(event) {
    try {
      await store.markShoppingPurchased(event.currentTarget.dataset.id, await app.ensureLogin(), true)
      wx.showToast({ title: '已购买' })
      this.loadData()
    } catch (error) { wx.showToast({ title: '操作失败', icon: 'none' }) }
  },
  addToFridge(event) {
    const item = this.data.purchased.find(row => row._id === event.currentTarget.dataset.id)
    if (!item) return
    const query = [
      `name=${encodeURIComponent(item.name || '')}`,
      `category=${encodeURIComponent(item.category || '')}`,
      `quantity=${encodeURIComponent(item.quantity || '')}`,
      `unit=${encodeURIComponent(item.unit || '')}`
    ].join('&')
    wx.navigateTo({ url: `/pages/add-food/add-food?${query}` })
  },
  async deleteItem(event) {
    const { id, name } = event.currentTarget.dataset
    const { confirm } = await wx.showModal({ title: '删除购物项', content: `确定删除“${name}”吗？`, confirmColor: '#B83232' })
    if (!confirm) return
    try {
      await store.deleteShoppingItem(id, await app.ensureLogin())
      wx.showToast({ title: '已删除' })
      this.loadData()
    } catch (error) { wx.showToast({ title: '删除失败', icon: 'none' }) }
  }
})
