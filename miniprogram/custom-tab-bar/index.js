const TAB_ROUTES = [
  'pages/index/index',
  'pages/fridge/fridge',
  'pages/reminders/reminders',
  'pages/profile/profile'
]

Component({
  data: {
    selectedRoute: '',
    tabs: [
      { pagePath: '/pages/index/index', route: 'pages/index/index', text: '首页', icon: '⌂' },
      { pagePath: '/pages/fridge/fridge', route: 'pages/fridge/fridge', text: '冰箱', icon: '▣' },
      { action: 'add', text: '添加' },
      { pagePath: '/pages/reminders/reminders', route: 'pages/reminders/reminders', text: '提醒', icon: '◷' },
      { pagePath: '/pages/profile/profile', route: 'pages/profile/profile', text: '我的', icon: '○' }
    ]
  },
  lifetimes: {
    attached() { this.syncSelected() }
  },
  pageLifetimes: {
    show() { this.syncSelected() }
  },
  methods: {
    syncSelected() {
      const pages = getCurrentPages()
      const route = pages.length ? pages[pages.length - 1].route : ''
      this.setData({ selectedRoute: TAB_ROUTES.includes(route) ? route : '' })
    },
    onTabTap(event) {
      const item = this.data.tabs[Number(event.currentTarget.dataset.index)]
      if (!item) return
      if (item.action === 'add') return wx.navigateTo({ url: '/pages/add-food/add-food' })
      if (item.route === this.data.selectedRoute) return
      wx.switchTab({ url: item.pagePath })
    }
  }
})
