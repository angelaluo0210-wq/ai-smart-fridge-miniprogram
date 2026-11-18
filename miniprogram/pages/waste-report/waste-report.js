const app = getApp()
const store = require('../../services/database')
const { PERIOD, calculateWasteStats } = require('../../utils/wasteStats')

function viewStats(stats) {
  return {
    total: stats.total,
    consumed: stats.consumed,
    discarded: stats.discarded,
    wasteRateText: stats.wasteRateText,
    hasRecords: stats.hasRecords,
    mostDiscarded: stats.mostDiscarded.slice(0, 5)
  }
}

Page({
  data: {
    loading: true,
    loadFailed: false,
    period: PERIOD.MONTH,
    periodTitle: '本月',
    stats: viewStats(calculateWasteStats([], PERIOD.MONTH))
  },

  onShow() { this.loadData() },
  onPullDownRefresh() { this.loadData().finally(() => wx.stopPullDownRefresh()) },

  async loadData() {
    this.setData({ loading: true, loadFailed: false })
    try {
      const foods = await store.listFoods(await app.ensureLogin(), '', true)
      this.foods = foods
      this.applyPeriod(this.data.period)
    } catch (error) {
      console.error('冰箱报告加载失败', error)
      this.setData({ loadFailed: true })
      wx.showToast({ title: '冰箱报告加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  changePeriod(event) {
    const period = event.currentTarget.dataset.period
    if (period === this.data.period) return
    this.applyPeriod(period)
  },

  applyPeriod(period) {
    const normalized = period === PERIOD.WEEK ? PERIOD.WEEK : PERIOD.MONTH
    this.setData({
      period: normalized,
      periodTitle: normalized === PERIOD.WEEK ? '本周' : '本月',
      stats: viewStats(calculateWasteStats(this.foods || [], normalized, new Date()))
    })
  },

  retry() { this.loadData() }
})
