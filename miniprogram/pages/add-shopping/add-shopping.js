const store = require('../../services/database')
const { CATEGORIES } = require('../../utils/categories')

Page({
  data: {
    name: '', categories: CATEGORIES, categoryNames: CATEGORIES.map(item => item.label), categoryIndex: 9,
    quantity: '', unit: '', submitting: false
  },
  onInput(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }) },
  onCategoryChange(event) { this.setData({ categoryIndex: Number(event.detail.value) }) },
  async submit() {
    if (!this.data.name.trim()) return wx.showToast({ title: '请填写食材名称', icon: 'none' })
    if (this.data.quantity && (!Number.isFinite(Number(this.data.quantity)) || Number(this.data.quantity) <= 0)) return wx.showToast({ title: '数量必须大于 0', icon: 'none' })
    this.setData({ submitting: true })
    try {
      await store.addShoppingItem({
        name: this.data.name,
        category: this.data.categories[this.data.categoryIndex].key,
        quantity: this.data.quantity,
        unit: this.data.unit
      })
      wx.showToast({ title: '已加入清单' })
      setTimeout(() => wx.navigateBack(), 500)
    } catch (error) {
      console.error(error)
      wx.showToast({ title: '添加失败', icon: 'none' })
    } finally { this.setData({ submitting: false }) }
  }
})
