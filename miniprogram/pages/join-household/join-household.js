const app = getApp()
const householdService = require('../../services/household')

Page({
  data: {
    loading: true, token: '', valid: false, state: '', membershipState: '',
    household: null, joining: false, errorMessage: ''
  },
  onLoad(options) {
    let token = options.token || options.scene || ''
    try { token = decodeURIComponent(token) } catch (error) { console.warn('邀请 token 解码失败', error) }
    this.setData({ token })
    this.validateInvite()
  },
  async validateInvite() {
    this.setData({ loading: true, errorMessage: '' })
    try {
      await app.ensureLogin()
      if (!this.data.token) throw new Error('邀请无效')
      const result = await householdService.validateInvite(this.data.token)
      const messages = { invalid: '邀请无效', expired: '邀请已过期，请联系创建者重新生成', revoked: '邀请已被撤销' }
      this.setData({
        valid: result.valid,
        state: result.state,
        membershipState: result.membershipState || '',
        household: result.household || null,
        errorMessage: result.valid ? '' : (messages[result.state] || '邀请当前不可用')
      })
    } catch (error) {
      this.setData({ valid: false, errorMessage: error.message || '邀请加载失败，请稍后重试' })
    } finally { this.setData({ loading: false }) }
  },
  async joinHousehold() {
    if (!this.data.valid || this.data.joining || this.data.membershipState !== 'available') return
    this.setData({ joining: true })
    try {
      await householdService.joinHousehold(this.data.token)
      wx.showToast({ title: '已加入家庭' })
      setTimeout(() => wx.redirectTo({ url: '/pages/household/household' }), 500)
    } catch (error) {
      wx.showModal({ title: '无法加入家庭', content: error.message || '请稍后重试', showCancel: false })
    } finally { this.setData({ joining: false }) }
  },
  enterHousehold() { wx.redirectTo({ url: '/pages/household/household' }) },
  cancel() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/profile/profile' })
  }
})
