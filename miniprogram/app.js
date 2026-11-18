const config = require('./config')

App({
  globalData: {
    openid: '',
    cloudReady: false
  },

  onLaunch() {
    if (!wx.cloud) {
      wx.showModal({
        title: '基础库版本过低',
        content: '请升级微信后重新打开小程序。',
        showCancel: false
      })
      return
    }

    wx.cloud.init({
      env: config.cloudEnv || undefined,
      traceUser: true
    })
    this.globalData.cloudReady = true
    this.loginPromise = this.login()
  },

  async login() {
    try {
      const { result } = await wx.cloud.callFunction({ name: 'login' })
      if (!result || !result.openid) throw new Error('登录结果缺少 openid')
      this.globalData.openid = result.openid
      return result.openid
    } catch (error) {
      console.error('登录失败', error)
      throw error
    }
  },

  ensureLogin() {
    if (this.globalData.openid) return Promise.resolve(this.globalData.openid)
    if (!this.loginPromise) this.loginPromise = this.login()
    return this.loginPromise
  }
})
