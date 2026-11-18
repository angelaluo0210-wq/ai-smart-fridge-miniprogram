const app = getApp()
const store = require('../../services/database')
const householdService = require('../../services/household')
const { buildHouseholdPageState } = require('../../utils/householdPage')

const VISIBILITY_OPTIONS = [
  { key: 'private', label: '仅自己可见', description: '只有你可以查看和管理' },
  { key: 'household', label: '全部家庭成员可见', description: '家庭中的所有有效成员都可以管理食材' },
  { key: 'selected', label: '部分家庭成员可见', description: '只有你和选中的成员可以管理食材' }
]

Page({
  data: {
    id: '', name: '', location: '', submitting: false, loading: true,
    hasHousehold: false, visibility: 'private', visibilityOptions: VISIBILITY_OPTIONS,
    selectableMembers: [], selectedMemberOpenids: []
  },
  onLoad(options) { this.setData({ id: options.id || '' }); this.loadData() },
  async loadData() {
    try {
      const openid = await app.ensureLogin()
      const context = await householdService.getHouseholdContext()
      const pageState = buildHouseholdPageState(context, openid)
      const data = { hasHousehold: context.hasHousehold, selectableMembers: pageState.members.filter(member => !member.isSelf) }
      if (this.data.id) {
        const fridge = await store.getFridge(this.data.id, openid)
        if (!fridge || !fridge.can_manage) throw new Error('只有冰箱创建者可以修改冰箱设置')
        Object.assign(data, {
          name: fridge.name, location: fridge.location || '', visibility: fridge.visibility || 'private',
          selectedMemberOpenids: fridge.selected_member_openids || []
        })
        data.selectableMembers = data.selectableMembers.map(member => ({
          ...member,
          checked: data.selectedMemberOpenids.includes(member.user_openid)
        }))
        wx.setNavigationBarTitle({ title: '修改冰箱' })
      }
      this.setData(data)
    } catch (error) {
      console.error('冰箱设置加载失败', error)
      wx.showModal({ title: '无法打开冰箱设置', content: error.message || '请稍后重试', showCancel: false })
        .then(() => wx.navigateBack())
    } finally { this.setData({ loading: false }) }
  },
  onNameInput(event) { this.setData({ name: event.detail.value }) },
  onLocationInput(event) { this.setData({ location: event.detail.value }) },
  onVisibilityChange(event) { this.setData({ visibility: event.detail.value }) },
  onSelectedMembersChange(event) {
    const selectedMemberOpenids = event.detail.value || []
    this.setData({
      selectedMemberOpenids,
      selectableMembers: this.data.selectableMembers.map(member => ({
        ...member,
        checked: selectedMemberOpenids.includes(member.user_openid)
      }))
    })
  },
  async submit() {
    const name = this.data.name.trim()
    if (!name) return wx.showToast({ title: '请填写冰箱名称', icon: 'none' })
    if (Array.from(name).length > 30) return wx.showToast({ title: '名称最多 30 个字', icon: 'none' })
    const visibility = this.data.hasHousehold ? this.data.visibility : 'private'
    this.setData({ submitting: true })
    try {
      const openid = await app.ensureLogin()
      const fields = {
        name, location: this.data.location, visibility,
        selectedMemberOpenids: visibility === 'selected' ? this.data.selectedMemberOpenids : []
      }
      if (this.data.id) await store.updateFridge(this.data.id, openid, fields)
      else await store.addFridge(fields)
      wx.showToast({ title: this.data.id ? '修改成功' : '添加成功' })
      setTimeout(() => wx.navigateBack(), 500)
    } catch (error) {
      console.error(error)
      wx.showToast({ title: error.message || '保存失败', icon: 'none' })
    } finally { this.setData({ submitting: false }) }
  }
})
