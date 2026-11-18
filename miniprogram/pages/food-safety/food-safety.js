const smartFood = require('../../services/smartFood')

Page({
  data: { question: '', loading: false, answer: null, error: '' },
  onQuestionInput(event) { this.setData({ question: event.detail.value }) },
  useExample(event) { this.setData({ question: event.currentTarget.dataset.question }, () => this.submit()) },
  async submit() {
    const question = this.data.question.trim()
    if (!question) return wx.showToast({ title: '请输入问题', icon: 'none' })
    if (this.data.loading) return
    this.setData({ loading: true, answer: null, error: '' })
    try {
      const answer = await smartFood.askFoodSafety(question)
      this.setData({ answer })
    } catch (error) {
      console.error('食品安全问答失败', error)
      this.setData({ error: error.message || '暂时无法回答，请稍后重试' })
    } finally { this.setData({ loading: false }) }
  },
  copySource(event) {
    const url = event.currentTarget.dataset.url
    if (url) wx.setClipboardData({ data: url })
  }
})
