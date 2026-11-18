const app = getApp()
const config = require('../../config')
const store = require('../../services/database')
const smartFood = require('../../services/smartFood')

Page({
  data: {
    openidTail: '',
    requesting: false,
    testingReminder: false,
    testingSmartFood: false,
    testingProvider: false,
    showReminderTest: false,
    templateConfigured: Boolean(config.expiryTemplateId)
  },
  onLoad() {
    try {
      const accountInfo = wx.getAccountInfoSync()
      this.setData({ showReminderTest: accountInfo.miniProgram.envVersion === 'develop' })
    } catch (error) {
      console.error('无法读取小程序运行环境', error)
      this.setData({ showReminderTest: false })
    }
  },
  async onShow() {
    try {
      const openid = await app.ensureLogin()
      this.setData({ openidTail: openid.slice(-8) })
      try {
        await store.updateUserTimezone(openid, new Date().getTimezoneOffset())
      } catch (error) {
        console.error('用户时区同步失败', error)
      }
    } catch (error) { this.setData({ openidTail: '获取失败' }) }
  },
  enableReminder() {
    if (!config.expiryTemplateId) {
      return wx.showModal({ title: '需要先配置', content: '请先在 miniprogram/config.js 中填写 expiryTemplateId。', showCancel: false })
    }
    this.setData({ requesting: true })
    wx.requestSubscribeMessage({
      tmplIds: [config.expiryTemplateId],
      success: async result => {
        const subscriptionStatus = result[config.expiryTemplateId]
        const accepted = subscriptionStatus === 'accept' || subscriptionStatus === 'acceptWithAudio'
        try {
          if (accepted) {
            await store.setReminderEnabled(
              await app.ensureLogin(),
              true,
              new Date().getTimezoneOffset()
            )
          }
          wx.showToast({ title: accepted ? '订阅成功' : '本次未订阅', icon: 'none' })
        } catch (error) {
          console.error('订阅状态保存失败', error)
          wx.showToast({ title: '设置保存失败', icon: 'none' })
        }
      },
      fail: error => {
        console.error('订阅授权请求失败', { errCode: error.errCode, errMsg: error.errMsg })
        wx.showToast({ title: '授权请求失败', icon: 'none' })
      },
      complete: () => this.setData({ requesting: false })
    })
  },
  openFoodTemplates() {
    wx.navigateTo({ url: '/pages/food-templates/food-templates' })
  },
  openHousehold() {
    wx.navigateTo({ url: '/pages/household/household' })
  },
  openWasteReport() {
    wx.navigateTo({ url: '/pages/waste-report/waste-report' })
  },
  openFoodSafety() {
    wx.navigateTo({ url: '/pages/food-safety/food-safety' })
  },
  async testSmartFoodConnection() {
    if (!this.data.showReminderTest || this.data.testingSmartFood) return
    this.setData({ testingSmartFood: true })
    try {
      const result = await smartFood.getCapabilities()
      console.log('[smartFood 开发诊断结果]', {
        buildId: result.buildId,
        provider: result.provider,
        vision: result.vision,
        ocr: result.ocr,
        text: result.text,
        models: result.models
      })
      wx.showModal({
        title: '智能服务连接成功',
        content: `build: ${result.buildId || '未知'}\nvision: ${Boolean(result.vision)}\nocr: ${Boolean(result.ocr)}\ntext: ${Boolean(result.text)}`,
        showCancel: false
      })
    } catch (error) {
      console.error('[smartFood 开发诊断失败]', {
        errCode: error.errCode,
        errMsg: error.errMsg || error.message,
        requestId: error.requestId || '',
        result: error.result
      })
      wx.showModal({
        title: '智能服务连接失败',
        content: `errCode: ${error.errCode === undefined ? '未知' : error.errCode}\nerrMsg: ${error.errMsg || error.message || '未知'}\nrequestId: ${error.requestId || '无'}`,
        showCancel: false
      })
    } finally {
      this.setData({ testingSmartFood: false })
    }
  },
  async testProviderConnection() {
    if (!this.data.showReminderTest || this.data.testingProvider) return
    this.setData({ testingProvider: true })
    try {
      const result = await smartFood.testProviderConnection()
      const diagnostic = {
        ok: Boolean(result.ok),
        buildId: result.buildId || '',
        provider: result.provider || '',
        model: result.model || '',
        httpStatus: Number(result.httpStatus) || 0,
        providerErrorCode: result.providerErrorCode || '',
        providerErrorMessage: result.providerErrorMessage || '',
        requestId: result.requestId || ''
      }
      console.log('[AI Provider diagnostic]', diagnostic)
      wx.showModal({
        title: diagnostic.ok ? 'AI 服务连接成功' : 'AI 服务连接失败',
        content: diagnostic.ok
          ? `${diagnostic.model}\nHTTP ${diagnostic.httpStatus}`
          : `HTTP ${diagnostic.httpStatus}\n${diagnostic.providerErrorCode || '未知错误'}\n${diagnostic.providerErrorMessage || '请查看 Console'}`,
        showCancel: false
      })
    } catch (error) {
      console.error('[AI Provider diagnostic]', {
        ok: false,
        buildId: '',
        provider: '',
        model: '',
        httpStatus: 0,
        providerErrorCode: error.errCode || '',
        providerErrorMessage: error.errMsg || error.message || '云函数调用失败',
        requestId: error.requestId || ''
      })
      wx.showModal({ title: 'AI 服务连接失败', content: '云函数调用失败，请查看 Console。', showCancel: false })
    } finally {
      this.setData({ testingProvider: false })
    }
  },
  async testSendReminder() {
    if (!this.data.showReminderTest || this.data.testingReminder) return
    this.setData({ testingReminder: true })
    try {
      const response = await wx.cloud.callFunction({
        name: 'sendExpiryReminders',
        data: {}
      })
      console.log('[订阅消息真机测试] 云函数返回', response)

      const result = response.result || {}
      const results = Array.isArray(result.results) ? result.results : []
      const sentResult = results.find(item => item && item.sent === true)
      if (sentResult) {
        wx.showModal({
          title: '测试提醒发送成功',
          content: '请在手机微信的服务通知中确认消息。',
          showCancel: false
        })
        return
      }

      const failures = results.filter(item => item && item.sent === false)
      failures.forEach(item => {
        console.error('[订阅消息真机测试] 发送失败', {
          errCode: item.errCode,
          errMsg: item.errMsg || item.reason,
          food_id: item.foodId,
          openid: item.openid
        })
      })

      if (failures.length) {
        const first = failures[0]
        wx.showModal({
          title: '测试提醒发送失败',
          content: `errCode: ${first.errCode === undefined ? '未知' : first.errCode}\nerrMsg: ${first.errMsg || first.reason || '未知错误'}`,
          showCancel: false
        })
      } else {
        wx.showModal({
          title: '没有发送提醒',
          content: '请确认已允许一次性订阅，并存在 0–2 天内到期且未食用的食材。详细结果已输出到 Console。',
          showCancel: false
        })
      }
    } catch (error) {
      console.error('[订阅消息真机测试] 云函数调用异常', {
        errCode: error.errCode,
        errMsg: error.errMsg || error.message,
        error
      })
      wx.showModal({
        title: '云函数调用失败',
        content: error.errMsg || error.message || '请查看 Console 和云函数日志',
        showCancel: false
      })
    } finally {
      this.setData({ testingReminder: false })
    }
  }
})
