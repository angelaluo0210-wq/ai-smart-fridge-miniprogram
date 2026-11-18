const app = getApp()
const store = require('../../services/database')
const { CATEGORIES } = require('../../utils/categories')
const {
  STORAGE_MODES,
  inferFoodCategory,
  inferStorageMode,
  storageModeByKey,
  recommendFoodShelfLife,
  recommendedDaysValue
} = require('../../utils/foodShelfLifeRules')
const { todayString } = require('../../utils/date')

function reviewItem(item = {}) {
  const category = inferFoodCategory(item.name, item.category)
  const storageMode = inferStorageMode(item.storageArea, null, 'refrigerated')
  const recommendation = recommendFoodShelfLife({ name: item.name, category, storageMode })
  return {
    _key: item._key || `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    selected: item.selected !== false,
    name: String(item.name || '').slice(0, 30),
    category,
    categoryIndex: Math.max(0, CATEGORIES.findIndex(row => row.key === category)),
    categoryManuallyEdited: false,
    storageMode,
    storageModeIndex: Math.max(0, STORAGE_MODES.findIndex(row => row.key === storageMode)),
    storageArea: String(item.storageArea || storageModeByKey(storageMode).defaultArea).slice(0, 30),
    shelfLifeDays: recommendation ? String(recommendation.recommendedDays) : '',
    shelfLifeManuallyEdited: false,
    recommendationText: recommendation ? recommendation.text : (item.name ? '暂无系统推荐，请手动填写保存天数' : ''),
    recommendationDays: recommendation ? String(recommendation.recommendedDays) : ''
  }
}

Page({
  data: {
    source: 'vision', loading: true, submitting: false,
    foods: [], categories: CATEGORIES, categoryNames: CATEGORIES.map(item => item.label),
    storageModes: STORAGE_MODES, storageModeNames: STORAGE_MODES.map(item => item.label),
    fridges: [], fridgeNames: [], fridgeIndex: -1
  },
  onLoad(options) {
    this.setData({ source: options.source === 'receipt' ? 'receipt' : 'vision' })
    this.getOpenerEventChannel().on('importCandidates', payload => {
      this.setData({ foods: (payload.foods || []).slice(0, 20).map(reviewItem) })
    })
    this.loadFridges()
  },
  async loadFridges() {
    try {
      const fridges = await store.listFridges(await app.ensureLogin())
      this.setData({
        fridges, fridgeNames: fridges.map(item => item.name),
        fridgeIndex: fridges.length === 1 ? 0 : -1
      })
    } catch (error) {
      console.error('批量导入冰箱加载失败', error)
      wx.showToast({ title: '冰箱加载失败', icon: 'none' })
    } finally { this.setData({ loading: false }) }
  },
  onFridgeChange(event) { this.setData({ fridgeIndex: Number(event.detail.value) }) },
  onFieldInput(event) {
    const { index, field } = event.currentTarget.dataset
    const value = event.detail.value
    if (field === 'shelfLifeDays') {
      return this.setData({
        [`foods[${index}].shelfLifeDays`]: value,
        [`foods[${index}].shelfLifeManuallyEdited`]: true
      })
    }
    if (field === 'storageArea') {
      const storageMode = inferStorageMode(value, null, this.data.foods[index].storageMode)
      return this.setData({
        [`foods[${index}].storageArea`]: value,
        [`foods[${index}].storageMode`]: storageMode,
        [`foods[${index}].storageModeIndex`]: STORAGE_MODES.findIndex(item => item.key === storageMode)
      }, () => this.refreshRecommendation(Number(index)))
    }
    this.setData({ [`foods[${index}].${field}`]: value }, () => {
      if (field === 'name') this.refreshRecommendation(Number(index), { inferCategory: true })
    })
  },
  onCategoryChange(event) {
    const index = Number(event.currentTarget.dataset.index)
    const categoryIndex = Number(event.detail.value)
    this.setData({
      [`foods[${index}].categoryIndex`]: categoryIndex,
      [`foods[${index}].category`]: this.data.categories[categoryIndex].key,
      [`foods[${index}].categoryManuallyEdited`]: true
    }, () => this.refreshRecommendation(index))
  },
  onStorageModeChange(event) {
    const index = Number(event.currentTarget.dataset.index)
    const storageModeIndex = Number(event.detail.value)
    const storageMode = STORAGE_MODES[storageModeIndex].key
    this.setData({
      [`foods[${index}].storageModeIndex`]: storageModeIndex,
      [`foods[${index}].storageMode`]: storageMode,
      [`foods[${index}].storageArea`]: storageModeByKey(storageMode).defaultArea
    }, () => this.refreshRecommendation(index))
  },
  refreshRecommendation(index, options = {}) {
    const item = this.data.foods[index]
    if (!item) return
    const category = options.inferCategory && !item.categoryManuallyEdited
      ? inferFoodCategory(item.name)
      : item.category
    const categoryIndex = Math.max(0, CATEGORIES.findIndex(row => row.key === category))
    const recommendation = recommendFoodShelfLife({ name: item.name, category, storageMode: item.storageMode })
    this.setData({
      [`foods[${index}].category`]: category,
      [`foods[${index}].categoryIndex`]: categoryIndex,
      [`foods[${index}].shelfLifeDays`]: recommendedDaysValue(item.shelfLifeDays, recommendation, item.shelfLifeManuallyEdited, options.force === true),
      [`foods[${index}].shelfLifeManuallyEdited`]: options.force === true ? false : item.shelfLifeManuallyEdited,
      [`foods[${index}].recommendationText`]: recommendation
        ? recommendation.text
        : (item.name.trim() ? '暂无系统推荐，请手动填写保存天数' : ''),
      [`foods[${index}].recommendationDays`]: recommendation ? String(recommendation.recommendedDays) : ''
    })
  },
  restoreRecommendation(event) {
    this.refreshRecommendation(Number(event.currentTarget.dataset.index), { force: true })
  },
  toggleItem(event) {
    const index = Number(event.currentTarget.dataset.index)
    this.setData({ [`foods[${index}].selected`]: Boolean(event.detail.value) })
  },
  removeItem(event) {
    const foods = this.data.foods.slice()
    foods.splice(Number(event.currentTarget.dataset.index), 1)
    this.setData({ foods })
  },
  addItem() {
    if (this.data.foods.length >= 20) return wx.showToast({ title: '一次最多 20 项', icon: 'none' })
    this.setData({ foods: [...this.data.foods, reviewItem()] })
  },
  validate() {
    if (this.data.fridgeIndex < 0 || !this.data.fridges[this.data.fridgeIndex]) return '请选择目标冰箱'
    const selected = this.data.foods.filter(item => item.selected)
    if (!selected.length) return '请至少选择一项食材'
    if (selected.some(item => !item.name.trim())) return '食材名称不能为空'
    if (selected.some(item => !/^\d+$/.test(item.shelfLifeDays) || Number(item.shelfLifeDays) <= 0)) return '保存天数必须是正整数'
    return ''
  },
  async submit() {
    const message = this.validate()
    if (message) return wx.showToast({ title: message, icon: 'none' })
    this.setData({ submitting: true })
    try {
      const foods = this.data.foods.filter(item => item.selected).map(item => ({
        name: item.name.trim(), category: item.category, storage_area: item.storageArea.trim(),
        quantity: null, unit: '', put_in_date: todayString(), shelf_life_days: Number(item.shelfLifeDays), note: ''
      }))
      const result = await store.batchAddFoods(this.data.fridges[this.data.fridgeIndex]._id, foods)
      wx.showToast({ title: `已加入 ${result.created} 项` })
      setTimeout(() => wx.navigateBack({ delta: 2 }), 600)
    } catch (error) {
      console.error('批量导入失败', error)
      wx.showModal({ title: '导入失败', content: error.message || '请稍后重试', showCancel: false })
    } finally { this.setData({ submitting: false }) }
  }
})
