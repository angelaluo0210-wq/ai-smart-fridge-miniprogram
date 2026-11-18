const app = getApp()
const store = require('../../services/database')

function operationId() {
  return `cook_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

Page({
  data: {
    recipe: null,
    previewLoading: false,
    consuming: false,
    showConsumption: false,
    consumptionRows: []
  },
  onLoad() {
    this.getOpenerEventChannel().on('recipeData', payload => this.setData({ recipe: payload.recipe || null }))
  },
  async startCooking() {
    if (!this.data.recipe || this.data.previewLoading) return
    this.setData({ previewLoading: true })
    try {
      const openid = await app.ensureLogin()
      await store.updateUserTimezone(openid, new Date().getTimezoneOffset())
      const result = await store.previewRecipeConsumption(this.data.recipe)
      const rows = (result.ingredients || []).map(item => ({
        ...item,
        quantityText: item.estimated && item.quantity > 0 ? String(item.quantity) : '',
        unitText: item.unit || ''
      }))
      if (!rows.length) return wx.showToast({ title: '菜谱没有可匹配的库存食材', icon: 'none' })
      this.currentOperationId = operationId()
      this.setData({ consumptionRows: rows, showConsumption: true })
    } catch (error) {
      console.error('制作预估加载失败', error)
      wx.showToast({ title: error.message || '暂时无法读取库存', icon: 'none' })
    } finally { this.setData({ previewLoading: false }) }
  },
  closeConsumption() {
    if (!this.data.consuming) this.setData({ showConsumption: false })
  },
  stopPropagation() {},
  onConsumptionInput(event) {
    const index = Number(event.currentTarget.dataset.index)
    const field = event.currentTarget.dataset.field
    const value = event.detail.value
    const row = this.data.consumptionRows[index]
    if (!row || !['quantityText', 'unitText'].includes(field)) return
    const patch = { [`consumptionRows[${index}].${field}`]: value }
    if (field === 'quantityText') {
      const quantity = Number(value)
      patch[`consumptionRows[${index}].shortage`] = Number.isFinite(quantity) ? Math.max(0, Math.round((quantity - row.inventoryQuantity) * 1000) / 1000) : 0
    } else if (value.trim() !== row.unit) {
      patch[`consumptionRows[${index}].warning`] = '单位已修改，服务端将重新校验后再扣减'
    }
    this.setData(patch)
  },
  async confirmCooking() {
    if (this.data.consuming) return
    const ingredients = this.data.consumptionRows.map(item => ({
      name: item.name,
      quantity: item.quantityText === '' ? 0 : Number(item.quantityText),
      unit: String(item.unitText || '').trim()
    }))
    const invalid = ingredients.find(item => !Number.isFinite(item.quantity) || item.quantity < 0 || (item.quantity > 0 && !item.unit))
    if (invalid) return wx.showToast({ title: `请检查${invalid.name}的数量和单位`, icon: 'none' })
    this.setData({ consuming: true })
    try {
      const result = await store.consumeRecipeIngredients(this.data.recipe, ingredients, this.currentOperationId)
      const shortage = (result.summaries || []).filter(item => item.shortage > 0)
      this.setData({ showConsumption: false })
      wx.showToast({ title: result.alreadyApplied ? '库存已更新，请勿重复提交' : '已更新冰箱库存', icon: 'success' })
      if (shortage.length) console.log('[做菜库存不足]', shortage)
      setTimeout(() => wx.navigateBack(), 900)
    } catch (error) {
      console.error('制作库存扣减失败', error)
      wx.showToast({ title: error.message || '库存更新失败', icon: 'none' })
    } finally { this.setData({ consuming: false }) }
  }
})
