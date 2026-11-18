const app = getApp()
const store = require('../../services/database')
const { decorateCategory } = require('../../utils/categories')

Page({
  data: { templates: [], loading: true, selectMode: false },
  onLoad(options) { this.setData({ selectMode: options.select === '1' }) },
  onShow() { this.loadData() },
  onPullDownRefresh() { this.loadData().finally(() => wx.stopPullDownRefresh()) },
  async loadData() {
    this.setData({ loading: true })
    try {
      const openid = await app.ensureLogin()
      const [templates, fridges] = await Promise.all([store.listFoodTemplates(openid), store.listFridges(openid)])
      const fridgeNames = fridges.reduce((all, item) => { all[item._id] = item.name; return all }, {})
      this.setData({ templates: templates.map(item => decorateCategory({
        ...item,
        fridgeName: fridgeNames[item.default_fridge_id] || '添加时选择冰箱'
      })) })
    } catch (error) {
      console.error(error)
      wx.showToast({ title: '模板加载失败', icon: 'none' })
    } finally { this.setData({ loading: false }) }
  },
  addTemplate() { wx.navigateTo({ url: '/pages/edit-template/edit-template' }) },
  editTemplate(event) { wx.navigateTo({ url: `/pages/edit-template/edit-template?id=${event.currentTarget.dataset.id}` }) },
  selectTemplate(event) {
    if (!this.data.selectMode) return
    const template = this.data.templates.find(item => item._id === event.currentTarget.dataset.id)
    if (!template) return
    this.getOpenerEventChannel().emit('templateSelected', template)
    wx.navigateBack()
  },
  async deleteTemplate(event) {
    const { id, name } = event.currentTarget.dataset
    const { confirm } = await wx.showModal({ title: '删除模板', content: `确定删除“${name}”模板吗？`, confirmColor: '#B83232' })
    if (!confirm) return
    try {
      await store.deleteFoodTemplate(id, await app.ensureLogin())
      wx.showToast({ title: '已删除' })
      this.loadData()
    } catch (error) { wx.showToast({ title: '删除失败', icon: 'none' }) }
  }
})
