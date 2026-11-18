const app = getApp()
const householdService = require('../../services/household')
const { buildHouseholdPageState } = require('../../utils/householdPage')

Page({
  data: {
    loading: true,
    loadError: false,
    hasHousehold: false,
    household: null,
    membership: null,
    members: [],
    isOwner: false,
    roleLabel: '',
    householdNameInput: '我的家庭',
    editingName: false,
    editNameInput: '',
    creating: false,
    savingName: false,
    actingMemberId: '',
    leaving: false,
    preparingInvite: false,
    invitePanelVisible: false,
    invite: null,
    inviteExpiresText: '',
    generatingQr: false,
    inviteQrFileId: '',
    revokingInvite: false
  },

  onShow() {
    this.loadContext()
  },

  onPullDownRefresh() {
    this.loadContext().finally(() => wx.stopPullDownRefresh())
  },

  async loadContext() {
    this.setData({ loading: true, loadError: false })
    try {
      const openid = await app.ensureLogin()
      const context = await householdService.getHouseholdContext()
      this.applyContext(context, openid)
    } catch (error) {
      console.error('家庭信息加载失败', error)
      this.setData({ loadError: true })
      wx.showToast({ title: error.message || '家庭信息加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  applyContext(context, openid) {
    const state = buildHouseholdPageState(context, openid)
    this.setData({
      ...state,
      loadError: false,
      householdNameInput: state.hasHousehold ? this.data.householdNameInput : '我的家庭',
      editingName: false,
      editNameInput: state.household ? state.household.name : ''
    })
  },

  onHouseholdNameInput(event) {
    this.setData({ householdNameInput: event.detail.value })
  },

  onEditNameInput(event) {
    this.setData({ editNameInput: event.detail.value })
  },

  async createHousehold() {
    if (this.data.creating) return
    if (this.data.hasHousehold) {
      return wx.showToast({ title: '你已经属于一个家庭', icon: 'none' })
    }
    const name = this.data.householdNameInput.trim()
    if (!name) return wx.showToast({ title: '请填写家庭名称', icon: 'none' })
    if (Array.from(name).length > 30) return wx.showToast({ title: '家庭名称最多 30 个字', icon: 'none' })

    this.setData({ creating: true })
    try {
      const openid = await app.ensureLogin()
      const context = await householdService.createHousehold(name)
      this.applyContext(context, openid)
      wx.showToast({ title: '家庭创建成功' })
    } catch (error) {
      wx.showToast({ title: error.message || '创建失败，请稍后重试', icon: 'none' })
    } finally {
      this.setData({ creating: false })
    }
  },

  startEditingName() {
    if (!this.data.isOwner) return
    this.setData({ editingName: true, editNameInput: this.data.household.name || '' })
  },

  cancelEditingName() {
    this.setData({ editingName: false, editNameInput: this.data.household.name || '' })
  },

  async saveHouseholdName() {
    if (!this.data.isOwner || this.data.savingName) return
    const name = this.data.editNameInput.trim()
    if (!name) return wx.showToast({ title: '请填写家庭名称', icon: 'none' })
    if (Array.from(name).length > 30) return wx.showToast({ title: '家庭名称最多 30 个字', icon: 'none' })
    if (name === this.data.household.name) return this.cancelEditingName()

    this.setData({ savingName: true })
    try {
      const context = await householdService.updateHouseholdName(name)
      this.applyContext(context, await app.ensureLogin())
      wx.showToast({ title: '家庭名称已更新' })
    } catch (error) {
      wx.showToast({ title: error.message || '修改失败，请稍后重试', icon: 'none' })
    } finally {
      this.setData({ savingName: false })
    }
  },

  async removeMember(event) {
    if (!this.data.isOwner || this.data.actingMemberId) return
    const memberId = event.currentTarget.dataset.id
    const member = this.data.members.find(item => item._id === memberId)
    if (!member || !member.canRemove) return wx.showToast({ title: '不能移除该成员', icon: 'none' })
    const { confirm } = await wx.showModal({
      title: '移除家庭成员',
      content: `确定将“${member.displayName}”移出家庭吗？`,
      confirmColor: '#B83232'
    })
    if (!confirm) return

    this.setData({ actingMemberId: memberId })
    try {
      const context = await householdService.removeMember(memberId)
      this.applyContext(context, await app.ensureLogin())
      wx.showToast({ title: '成员已移除' })
    } catch (error) {
      wx.showToast({ title: error.message || '移除失败，请稍后重试', icon: 'none' })
    } finally {
      this.setData({ actingMemberId: '' })
    }
  },

  async leaveHousehold() {
    if (this.data.isOwner) {
      return wx.showModal({ title: '暂时无法退出', content: '创建者暂时不能直接退出家庭。', showCancel: false })
    }
    if (this.data.leaving) return
    const { confirm } = await wx.showModal({
      title: '退出家庭',
      content: '退出家庭后，你将无法继续访问家庭共享内容。',
      confirmColor: '#B83232'
    })
    if (!confirm) return

    this.setData({ leaving: true })
    try {
      const context = await householdService.leaveHousehold()
      this.applyContext(context, await app.ensureLogin())
      wx.showToast({ title: '已退出家庭' })
    } catch (error) {
      wx.showToast({ title: error.message || '退出失败，请稍后重试', icon: 'none' })
    } finally {
      this.setData({ leaving: false })
    }
  },

  async prepareInvite() {
    if (!this.data.isOwner || this.data.preparingInvite) return
    this.setData({ preparingInvite: true })
    try {
      const result = await householdService.createInvite()
      const expires = new Date(result.invite.expires_at)
      this.setData({
        invitePanelVisible: true,
        invite: result.invite,
        inviteExpiresText: Number.isNaN(expires.getTime()) ? '24 小时内' : expires.toLocaleString(),
        inviteQrFileId: result.invite.qr_file_id || ''
      })
    } catch (error) {
      wx.showToast({ title: error.message || '邀请生成失败', icon: 'none' })
    } finally { this.setData({ preparingInvite: false }) }
  },

  onShareAppMessage() {
    const token = this.data.invite && this.data.invite.token
    return {
      title: `邀请你加入“${this.data.household ? this.data.household.name : '我的家庭'}”`,
      path: token ? `/pages/join-household/join-household?token=${encodeURIComponent(token)}` : '/pages/profile/profile'
    }
  },

  async generateInviteQrCode() {
    if (!this.data.invite || this.data.generatingQr) return
    this.setData({ generatingQr: true })
    try {
      const result = await householdService.createInviteQrCode(this.data.invite._id)
      this.setData({ inviteQrFileId: result.fileId })
    } catch (error) {
      console.error('邀请二维码生成失败', error)
      wx.showModal({ title: '二维码生成失败', content: error.message || '请检查小程序码 OpenAPI 权限和云函数配置', showCancel: false })
    } finally { this.setData({ generatingQr: false }) }
  },

  previewInviteQrCode() {
    if (this.data.inviteQrFileId) wx.previewImage({ urls: [this.data.inviteQrFileId] })
  },

  async revokeInvite() {
    if (!this.data.invite || this.data.revokingInvite) return
    const { confirm } = await wx.showModal({ title: '撤销邀请', content: '撤销后，已转发的链接和二维码将立即失效。', confirmColor: '#B83232' })
    if (!confirm) return
    this.setData({ revokingInvite: true })
    try {
      await householdService.revokeInvite(this.data.invite._id)
      this.setData({ invitePanelVisible: false, invite: null, inviteQrFileId: '', inviteExpiresText: '' })
      wx.showToast({ title: '邀请已撤销' })
    } catch (error) {
      wx.showToast({ title: error.message || '撤销失败', icon: 'none' })
    } finally { this.setData({ revokingInvite: false }) }
  }
})
