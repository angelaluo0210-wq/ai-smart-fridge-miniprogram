const app = getApp()
const store = require('../../services/database')
const { todayString, calculateExpireDate, isValidDate } = require('../../utils/date')
const { CATEGORIES, normalizeCategoryKey } = require('../../utils/categories')
const {
  STORAGE_MODES,
  normalizeFoodName,
  inferFoodCategory,
  inferStorageMode,
  storageModeByKey,
  recommendFoodShelfLife,
  recommendedDaysValue
} = require('../../utils/foodShelfLifeRules')

Page({
  data: {
    fridges: [], fridgeNames: [], fridgeIndex: -1, templates: [],
    categories: CATEGORIES, categoryNames: CATEGORIES.map(item => item.label), categoryIndex: -1,
    storageModes: STORAGE_MODES, storageModeNames: STORAGE_MODES.map(item => item.label), storageModeIndex: 0, storageMode: 'refrigerated',
    name: '', category: '', storageArea: '', quantity: '', unit: '',
    putInDate: todayString(), shelfLifeDays: '', expirePreview: '',
    recommendationText: '', recommendationDays: '', recommendationSource: '', shelfLifeManuallyEdited: false,
    note: '', submitting: false
  },

  onLoad(options) {
    const decode = value => {
      try { return decodeURIComponent(value || '') } catch (error) { return value || '' }
    }
    this.preselectedFridgeId = options.fridgeId || ''
    this.externalPrefill = {
      name: decode(options.name), category: decode(options.category),
      quantity: decode(options.quantity), unit: decode(options.unit)
    }
    this.shelfLifeManuallyEdited = false
    this.categoryManuallyEdited = false
    this.storageModeManuallyEdited = false
    this.storageAreaSuggested = false
    this.activeTemplate = null
    this.loadFridges()
  },

  async loadFridges() {
    try {
      const openid = await app.ensureLogin()
      const fridges = await store.listFridges(openid)
      let templates = []
      try { templates = await store.listFoodTemplates(openid) } catch (error) { console.warn('常用模板暂不可用', error) }
      let fridgeIndex = fridges.findIndex(item => item._id === this.preselectedFridgeId)
      if (fridgeIndex < 0 && fridges.length === 1) fridgeIndex = 0
      const storageMode = inferStorageMode('', fridges[fridgeIndex], 'refrigerated')
      this.setData({
        fridges, fridgeNames: fridges.map(item => item.name), fridgeIndex, templates,
        storageMode, storageModeIndex: STORAGE_MODES.findIndex(item => item.key === storageMode)
      }, () => this.applyExternalPrefill())
    } catch (error) { wx.showToast({ title: '冰箱加载失败', icon: 'none' }) }
  },

  applyExternalPrefill() {
    const prefill = this.externalPrefill || {}
    if (!prefill.name) return
    this.setData({ name: prefill.name, quantity: prefill.quantity, unit: prefill.unit }, () => {
      this.applySmartPrefill(prefill.name, { preferredCategory: prefill.category })
    })
    this.externalPrefill = null
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field
    const value = event.detail.value
    if (field === 'shelfLifeDays') {
      this.shelfLifeManuallyEdited = true
      return this.setData({ shelfLifeDays: value, shelfLifeManuallyEdited: true }, () => this.updatePreview())
    }
    if (field === 'name') {
      this.activeTemplate = null
      return this.setData({ name: value }, () => this.applySmartPrefill(value))
    }
    if (field === 'storageArea') {
      this.storageAreaSuggested = false
      const detectedMode = inferStorageMode(value, null, this.data.storageMode)
      const modeIndex = STORAGE_MODES.findIndex(item => item.key === detectedMode)
      return this.setData({ storageArea: value, storageMode: detectedMode, storageModeIndex: modeIndex }, () => this.applyRecommendation())
    }
    this.setData({ [field]: value })
  },

  onFridgeChange(event) {
    const fridgeIndex = Number(event.detail.value)
    if (this.storageModeManuallyEdited) return this.setData({ fridgeIndex }, () => this.applyRecommendation())
    const storageMode = inferStorageMode(this.storageAreaSuggested ? '' : this.data.storageArea, this.data.fridges[fridgeIndex], this.data.storageMode)
    const storageModeIndex = STORAGE_MODES.findIndex(item => item.key === storageMode)
    this.setData({ fridgeIndex, storageMode, storageModeIndex }, () => this.applyRecommendation())
  },

  onStorageModeChange(event) {
    const storageModeIndex = Number(event.detail.value)
    const mode = STORAGE_MODES[storageModeIndex] || STORAGE_MODES[0]
    this.storageModeManuallyEdited = true
    // foods 没有独立的存储方式字段，用现有 storage_area 保存用户本次选择。
    this.storageAreaSuggested = true
    this.setData({
      storageModeIndex,
      storageMode: mode.key,
      storageArea: mode.defaultArea
    }, () => this.applyRecommendation())
  },

  onCategoryChange(event) {
    const categoryIndex = Number(event.detail.value)
    this.categoryManuallyEdited = true
    this.setData({ categoryIndex, category: this.data.categories[categoryIndex].key }, () => this.applyRecommendation())
  },

  openTemplates() {
    wx.navigateTo({
      url: '/pages/food-templates/food-templates?select=1',
      events: { templateSelected: template => this.applyTemplate(template) }
    })
  },

  applyTemplate(template, options = {}) {
    const preserveManualDays = options.preserveManualDays === true
    this.activeTemplate = template
    if (!preserveManualDays) this.shelfLifeManuallyEdited = false
    this.categoryManuallyEdited = false
    this.storageModeManuallyEdited = false
    const category = normalizeCategoryKey(template.category)
    const categoryIndex = this.data.categories.findIndex(item => item.key === category)
    const fridgeIndex = template.default_fridge_id
      ? this.data.fridges.findIndex(item => item._id === template.default_fridge_id)
      : this.data.fridgeIndex
    const storageMode = inferStorageMode(template.default_storage_area, this.data.fridges[fridgeIndex], this.data.storageMode)
    const storageModeIndex = STORAGE_MODES.findIndex(item => item.key === storageMode)
    this.storageAreaSuggested = false
    this.setData({
      name: template.name || '', category, categoryIndex,
      storageArea: template.default_storage_area || storageModeByKey(storageMode).defaultArea,
      storageMode, storageModeIndex,
      fridgeIndex: fridgeIndex >= 0 ? fridgeIndex : this.data.fridgeIndex,
      shelfLifeManuallyEdited: this.shelfLifeManuallyEdited
    }, () => this.applyRecommendation({ force: !preserveManualDays }))
  },

  applySmartPrefill(name, options = {}) {
    const normalized = normalizeFoodName(name)
    if (!normalized) {
      if (!this.shelfLifeManuallyEdited) this.setData({ shelfLifeDays: '', expirePreview: '' })
      return this.setData({ recommendationText: '', recommendationDays: '', recommendationSource: '' })
    }
    const template = this.data.templates.find(item => normalizeFoodName(item.name) === normalized)
    if (template) return this.applyTemplate(template, { preserveManualDays: this.shelfLifeManuallyEdited })

    const inferredCategory = inferFoodCategory(name, options.preferredCategory || (this.categoryManuallyEdited ? this.data.category : ''))
    const categoryIndex = this.data.categories.findIndex(item => item.key === inferredCategory)
    const categoryData = !this.categoryManuallyEdited && categoryIndex >= 0
      ? { category: inferredCategory, categoryIndex }
      : {}
    this.setData(categoryData, () => this.applyRecommendation())
  },

  applyRecommendation(options = {}) {
    const recommendation = recommendFoodShelfLife({
      name: this.data.name,
      category: this.data.category,
      storageMode: this.data.storageMode,
      template: this.activeTemplate
    })
    const force = options.force === true
    const shelfLifeDays = recommendedDaysValue(this.data.shelfLifeDays, recommendation, this.shelfLifeManuallyEdited, force)
    if (force) this.shelfLifeManuallyEdited = false
    const shouldSuggestArea = recommendation && (!this.data.storageArea || this.storageAreaSuggested)
    if (shouldSuggestArea) this.storageAreaSuggested = true
    this.setData({
      shelfLifeDays,
      shelfLifeManuallyEdited: this.shelfLifeManuallyEdited,
      recommendationText: recommendation
        ? recommendation.text
        : (this.data.name.trim() ? '暂无系统推荐，请手动填写保存天数' : ''),
      recommendationDays: recommendation ? String(recommendation.recommendedDays) : '',
      recommendationSource: recommendation ? recommendation.source : 'none',
      ...(shouldSuggestArea ? { storageArea: storageModeByKey(this.data.storageMode).defaultArea } : {})
    }, () => this.updatePreview())
  },

  restoreRecommendation() {
    if (!this.data.recommendationDays) return
    this.shelfLifeManuallyEdited = false
    this.applyRecommendation({ force: true })
  },

  onDateChange(event) { this.setData({ putInDate: event.detail.value }, () => this.updatePreview()) },

  updatePreview() {
    const days = Number(this.data.shelfLifeDays)
    if (isValidDate(this.data.putInDate) && Number.isInteger(days) && days > 0) {
      this.setData({ expirePreview: calculateExpireDate(this.data.putInDate, days) })
    } else if (this.data.expirePreview) this.setData({ expirePreview: '' })
  },

  validate() {
    if (!this.data.name.trim()) return '请填写食材名称'
    if (this.data.fridgeIndex < 0 || !this.data.fridges[this.data.fridgeIndex]) return '请选择冰箱'
    if (!isValidDate(this.data.putInDate)) return '放入日期格式不正确'
    const days = Number(this.data.shelfLifeDays)
    if (!/^\d+$/.test(String(this.data.shelfLifeDays)) || !Number.isInteger(days) || days <= 0) return '保存天数必须是大于 0 的整数'
    if (this.data.quantity && (!Number.isFinite(Number(this.data.quantity)) || Number(this.data.quantity) <= 0)) return '数量必须大于 0'
    return ''
  },

  async submit() {
    const message = this.validate()
    if (message) return wx.showToast({ title: message, icon: 'none' })
    this.setData({ submitting: true })
    try {
      await store.addFood({
        fridge_id: this.data.fridges[this.data.fridgeIndex]._id,
        name: this.data.name, category: this.data.category, storage_area: this.data.storageArea,
        quantity: this.data.quantity, unit: this.data.unit, put_in_date: this.data.putInDate,
        shelf_life_days: this.data.shelfLifeDays, note: this.data.note
      })
      wx.showToast({ title: '添加成功' })
      setTimeout(() => wx.navigateBack(), 500)
    } catch (error) {
      console.error(error)
      wx.showToast({ title: error.message || '添加失败', icon: 'none' })
    } finally { this.setData({ submitting: false }) }
  }
})
