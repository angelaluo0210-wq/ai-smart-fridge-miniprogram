const app = getApp()
const store = require('../../services/database')
const { getVisibilityLabel } = require('../../utils/householdAccess')
const { isActiveFood } = require('../../utils/foodLifecycle')

Page({
  data: { loading: true, fridges: [] },
  onShow() { this.loadData() },
  onPullDownRefresh() { this.loadData().finally(() => wx.stopPullDownRefresh()) },

  async loadData() {
    this.setData({ loading: true })
    try {
      const openid = await app.ensureLogin()
      const [fridges, records] = await Promise.all([
        store.listFridges(openid),
        store.listFoods(openid, '', true)
      ])
      const counts = records.reduce((all, food) => {
        if (!all[food.fridge_id]) all[food.fridge_id] = { active: 0, records: 0 }
        all[food.fridge_id].records += 1
        if (isActiveFood(food)) all[food.fridge_id].active += 1
        return all
      }, {})
      const withCounts = fridges.map(fridge => ({
        ...fridge,
        foodCount: counts[fridge._id] ? counts[fridge._id].active : 0,
        recordCount: counts[fridge._id] ? counts[fridge._id].records : 0,
        visibilityLabel: getVisibilityLabel(fridge.visibility)
      }))
      this.setData({ fridges: withCounts })
    } catch (error) {
      console.error(error)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally { this.setData({ loading: false }) }
  },

  addFridge() { wx.navigateTo({ url: '/pages/add-fridge/add-fridge' }) },
  openFridge(event) { wx.navigateTo({ url: `/pages/fridge-detail/fridge-detail?id=${event.currentTarget.dataset.id}` }) },
  editFridge(event) { wx.navigateTo({ url: `/pages/add-fridge/add-fridge?id=${event.currentTarget.dataset.id}` }) },
  async deleteFridge(event) {
    const { id, name, records } = event.currentTarget.dataset
    const content = Number(records) > 0
      ? `“${name}”仍关联 ${records} 条当前或历史食材记录。继续会一并永久删除，确定吗？`
      : `确定删除“${name}”吗？`
    const { confirm } = await wx.showModal({ title: '删除冰箱', content, confirmColor: '#B83232' })
    if (!confirm) return
    try {
      const openid = await app.ensureLogin()
      await store.deleteFridge(id, openid, Number(records) > 0)
      wx.showToast({ title: '已删除' })
      this.loadData()
    } catch (error) {
      console.error(error)
      wx.showToast({ title: '删除失败', icon: 'none' })
    }
  }
})
