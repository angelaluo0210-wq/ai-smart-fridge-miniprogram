const smartFood = require('../../services/smartFood')

const COPY = {
  vision: { title: '拍照识别食材', description: '拍摄冰箱或食材照片，识别结果需要你确认后才会加入库存。', button: '拍照或从相册选择' },
  receipt: { title: '扫描购物小票', description: '小票仅用于临时识别商品，处理后会删除图片。请在导入前核对每一项。', button: '拍摄或选择小票' }
}

Page({
  data: {
    mode: 'vision', copy: COPY.vision, loading: false, error: '', empty: false,
    stages: [
      { key: 'upload', label: '上传图片', status: 'pending' },
      { key: 'recognize', label: '识别食材', status: 'pending' },
      { key: 'organize', label: '整理结果', status: 'pending' }
    ]
  },
  onLoad(options) {
    const mode = options.mode === 'receipt' ? 'receipt' : 'vision'
    this.setData({
      mode, copy: COPY[mode],
      'stages[1].label': mode === 'receipt' ? '识别小票' : '识别食材',
      'stages[2].label': mode === 'receipt' ? '整理商品' : '整理结果'
    })
  },
  updateStage(key, status) {
    const stages = this.data.stages.map(item => item.key === key ? { ...item, status } : item)
    this.setData({ stages })
  },
  async chooseImage() {
    if (this.data.loading) return
    this.setData({ loading: true, error: '', empty: false, stages: this.data.stages.map(item => ({ ...item, status: 'pending' })) })
    try {
      const result = await smartFood.chooseAndProcessImage(this.data.mode, { onStage: (key, status) => this.updateStage(key, status) })
      if (!result.configured) {
        this.setData({ error: '云端 AI Provider 尚未配置，请先完成环境变量设置。' })
        return
      }
      const foods = Array.isArray(result.foods) ? result.foods : []
      if (!foods.length) {
        this.setData({ empty: true })
        return
      }
      wx.navigateTo({
        url: `/pages/import-review/import-review?source=${this.data.mode}`,
        success: response => response.eventChannel.emit('importCandidates', { foods })
      })
    } catch (error) {
      if (error.message !== 'USER_CANCELLED') {
        console.error('图片智能处理失败', error)
        const stageText = this.data.stages.find(item => item.status === 'error')
        this.setData({ error: stageText ? `${stageText.label}失败，请重试` : (error.message || '处理失败，请重试') })
      }
    } finally { this.setData({ loading: false }) }
  },
  manualAdd() { wx.navigateTo({ url: '/pages/add-food/add-food' }) }
})
