const app = getApp()
const store = require('../../services/database')
const { CATEGORIES, normalizeCategoryKey } = require('../../utils/categories')

Page({
  data: {
    id: '', name: '', categories: CATEGORIES, categoryNames: CATEGORIES.map(item => item.label), categoryIndex: 9,
    fridges: [], fridgeNames: ['不指定冰箱'], fridgeIndex: 0,
    shelfLifeDays: '', storageArea: '', submitting: false
  },
  onLoad(options) { this.setData({ id: options.id || '' }); this.loadData() },
  async loadData() {
    try {
      const openid = await app.ensureLogin()
      const fridges = await store.listFridges(openid)
      this.setData({ fridges, fridgeNames: ['不指定冰箱', ...fridges.map(item => item.name)] })
      if (!this.data.id) return
      const template = await store.getFoodTemplate(this.data.id, openid)
      if (!template) throw new Error('模板不存在或已删除')
      const category = normalizeCategoryKey(template.category)
      const categoryIndex = CATEGORIES.findIndex(item => item.key === category)
      const fridgeIndex = template.default_fridge_id
        ? fridges.findIndex(item => item._id === template.default_fridge_id) + 1
        : 0
      this.setData({
        name: template.name,
        categoryIndex: categoryIndex >= 0 ? categoryIndex : 9,
        fridgeIndex: fridgeIndex > 0 ? fridgeIndex : 0,
        shelfLifeDays: String(template.default_shelf_life_days || ''),
        storageArea: template.default_storage_area || ''
      })
      wx.setNavigationBarTitle({ title: '编辑常用模板' })
    } catch (error) {
      console.error(error)
      wx.showToast({ title: error.message || '加载失败', icon: 'none' })
    }
  },
  onInput(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }) },
  onCategoryChange(event) { this.setData({ categoryIndex: Number(event.detail.value) }) },
  onFridgeChange(event) { this.setData({ fridgeIndex: Number(event.detail.value) }) },
  async submit() {
    const days = Number(this.data.shelfLifeDays)
    if (!this.data.name.trim()) return wx.showToast({ title: '请填写食材名称', icon: 'none' })
    if (!/^\d+$/.test(String(this.data.shelfLifeDays)) || !Number.isInteger(days) || days <= 0) return wx.showToast({ title: '默认天数必须大于 0', icon: 'none' })
    const template = {
      name: this.data.name,
      category: this.data.categories[this.data.categoryIndex].key,
      default_shelf_life_days: days,
      default_fridge_id: this.data.fridgeIndex > 0 ? this.data.fridges[this.data.fridgeIndex - 1]._id : '',
      default_storage_area: this.data.storageArea
    }
    this.setData({ submitting: true })
    try {
      const openid = await app.ensureLogin()
      if (this.data.id) await store.updateFoodTemplate(this.data.id, openid, template)
      else await store.addFoodTemplate(template)
      wx.showToast({ title: '模板已保存' })
      setTimeout(() => wx.navigateBack(), 500)
    } catch (error) {
      console.error(error)
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally { this.setData({ submitting: false }) }
  }
})
