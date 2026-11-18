const app = getApp()
const store = require('../../services/database')
const smartFood = require('../../services/smartFood')
const { decorateFood } = require('../../utils/foodStatus')
const { findClassicRecipeCandidates, getRecipeBatch } = require('../../utils/classicRecipes')

function recipeTitleKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s·•，,、。.!！?？_\-—]/g, '')
}

function mergeRecipeLists(primary, fallback, maxItems = 3) {
  const titles = new Set()
  return (Array.isArray(primary) ? primary : []).concat(Array.isArray(fallback) ? fallback : []).filter(recipe => {
    const title = recipeTitleKey(recipe && recipe.title)
    if (!title || titles.has(title)) return false
    titles.add(title)
    return true
  }).slice(0, maxItems)
}

function recipeRefreshLog(payload) {
  try {
    if (wx.getAccountInfoSync().miniProgram.envVersion === 'develop') console.log('[Recipe Refresh]', payload)
  } catch (error) {}
}

Page({
  data: {
    loading: true,
    fridges: [],
    inventoryCount: 0,
    hasMoreFridges: false,
    counts: { fresh: 0, near_expiry: 0, expired: 0 },
    priorityFoods: [],
    recipeLoading: false,
    recipes: [],
    recipeMessage: ''
  },

  onShow() { this.loadData() },
  onPullDownRefresh() { this.loadData().finally(() => wx.stopPullDownRefresh()) },

  async loadData() {
    this.setData({ loading: true })
    try {
      const openid = await app.ensureLogin()
      const [fridges, foods] = await Promise.all([store.listFridges(openid), store.listFoods(openid)])
      const decorated = foods.map(food => decorateFood(food))
      const counts = { fresh: 0, near_expiry: 0, expired: 0 }
      decorated.forEach(food => { if (counts[food.computedStatus] !== undefined) counts[food.computedStatus] += 1 })
      const fridgeCounts = decorated.reduce((all, food) => {
        all[food.fridge_id] = (all[food.fridge_id] || 0) + 1
        return all
      }, {})
      const fridgeNames = fridges.reduce((all, fridge) => { all[fridge._id] = fridge.name; return all }, {})
      const priorityFoods = decorated
        .filter(food => food.computedStatus === 'expired' || food.computedStatus === 'near_expiry')
        .sort((a, b) => a.remainingDays - b.remainingDays)
        .slice(0, 3)
        .map(food => ({ ...food, fridgeName: fridgeNames[food.fridge_id] || '未知冰箱' }))
      const fridgeCards = fridges.map(fridge => ({ ...fridge, foodCount: fridgeCounts[fridge._id] || 0 }))
      this.setData({
        fridges: fridgeCards.slice(0, 3),
        inventoryCount: decorated.length,
        hasMoreFridges: fridgeCards.length > 3,
        counts,
        priorityFoods
      })
      this.classicRecipeCandidates = findClassicRecipeCandidates(decorated)
      this.recipeRequestId = (this.recipeRequestId || 0) + 1
      const localBatch = getRecipeBatch(this.classicRecipeCandidates, 0, 3)
      this.classicRecipePage = localBatch.nextPage
      if (localBatch.recipes.length === 3) {
        this.setData({ recipes: localBatch.recipes, recipeLoading: false, recipeMessage: '' })
      } else {
        this.loadRecipe(false, localBatch.recipes)
      }
    } catch (error) {
      console.error(error)
      wx.showToast({ title: '加载失败，请检查云环境', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  openFridge(event) { wx.navigateTo({ url: `/pages/fridge-detail/fridge-detail?id=${event.currentTarget.dataset.id}` }) },
  openAllFridges() { wx.switchTab({ url: '/pages/fridge/fridge' }) },
  addFood() { wx.navigateTo({ url: '/pages/add-food/add-food' }) },
  recognizeFoods() { wx.navigateTo({ url: '/pages/smart-capture/smart-capture?mode=vision' }) },
  scanReceipt() { wx.navigateTo({ url: '/pages/smart-capture/smart-capture?mode=receipt' }) },
  openSearch() { wx.navigateTo({ url: '/pages/search/search' }) },
  openShopping() { wx.navigateTo({ url: '/pages/shopping/shopping' }) },
  openReminders() { wx.switchTab({ url: '/pages/reminders/reminders' }) },
  openInventoryStat(event) {
    const status = event.currentTarget.dataset.status || 'all'
    wx.navigateTo({ url: `/pages/search/search?status=${status}` })
  },
  async loadRecipe(forceRefresh = false, localRecipes = []) {
    const oldRecipeTitles = this.data.recipes.map(recipe => recipe.title)
    const excludedTitles = oldRecipeTitles.concat((Array.isArray(localRecipes) ? localRecipes : []).map(recipe => recipe.title))
    const requestId = (this.recipeRequestId || 0) + 1
    this.recipeRequestId = requestId
    this.setData({ recipeLoading: true, recipeMessage: '' })
    try {
      const result = await smartFood.generateRecipe(forceRefresh, excludedTitles)
      if (requestId !== this.recipeRequestId) {
        if (forceRefresh) recipeRefreshLog({ forceRefresh: true, oldRecipeTitles, clientReceivedRecipes: [], setDataExecuted: false, reason: 'stale_request' })
        return
      }
      const messages = {
        provider_not_configured: '智能推荐待配置',
        empty_inventory: '当前没有可用于推荐的食材',
        invalid_provider_result: '本次没有生成可靠的推荐'
      }
      const providerRecipes = Array.isArray(result.recipes) ? result.recipes : (result.recipe ? [result.recipe] : [])
      const recipes = mergeRecipeLists(localRecipes, providerRecipes, 3)
      const newRecipeTitles = recipes.map(recipe => recipe.title)
      if (forceRefresh) recipeRefreshLog({
        forceRefresh: true,
        cacheBypassed: Boolean(result.refreshDiagnostics && result.refreshDiagnostics.cacheBypassed),
        providerCalled: Boolean(result.refreshDiagnostics && result.refreshDiagnostics.providerCalled),
        oldRecipeTitles,
        newRecipeTitles,
        clientReceivedRecipes: newRecipeTitles
      })
      if (forceRefresh && recipes.length < 3) {
        this.setData({ recipeMessage: '暂时无法更新菜谱，请稍后再试' }, () => recipeRefreshLog({ forceRefresh: true, oldRecipeTitles, newRecipeTitles, setDataExecuted: false }))
        return
      }
      this.setData({ recipes, recipeMessage: recipes.length ? '' : (messages[result.reason] || '暂时无法生成推荐') }, () => {
        if (forceRefresh) recipeRefreshLog({ forceRefresh: true, oldRecipeTitles, newRecipeTitles, clientReceivedRecipes: newRecipeTitles, setDataExecuted: true })
      })
    } catch (error) {
      if (requestId === this.recipeRequestId) {
        if (!forceRefresh && localRecipes.length) this.setData({ recipes: localRecipes, recipeMessage: '其余智能推荐暂时不可用' })
        else this.setData({ recipeMessage: this.data.recipes.length ? '暂时无法更新菜谱，请稍后再试' : '智能推荐暂时不可用' })
      }
      if (forceRefresh) recipeRefreshLog({
        forceRefresh: true,
        oldRecipeTitles,
        newRecipeTitles: [],
        clientReceivedRecipes: [],
        setDataExecuted: false,
        error: error.errMsg || error.message || 'refresh_failed'
      })
      console.error('首页菜谱推荐失败', error)
    } finally {
      if (requestId === this.recipeRequestId) this.setData({ recipeLoading: false })
    }
  },
  retryRecipe() { this.loadRecipe() },
  refreshRecipes() {
    recipeRefreshLog({ buttonClicked: true, forceRefresh: true, oldRecipeTitles: this.data.recipes.map(recipe => recipe.title) })
    if (this.data.recipeLoading) return
    const localBatch = getRecipeBatch(this.classicRecipeCandidates, this.classicRecipePage, 3)
    this.classicRecipePage = localBatch.nextPage
    if (localBatch.recipes.length === 3) {
      const oldRecipeTitles = this.data.recipes.map(recipe => recipe.title)
      const newRecipeTitles = localBatch.recipes.map(recipe => recipe.title)
      this.setData({ recipes: localBatch.recipes, recipeMessage: '' }, () => recipeRefreshLog({
        forceRefresh: true,
        cacheBypassed: false,
        providerCalled: false,
        oldRecipeTitles,
        newRecipeTitles,
        clientReceivedRecipes: newRecipeTitles,
        setDataExecuted: true
      }))
      return
    }
    this.loadRecipe(true, localBatch.recipes)
  },
  openRecipe(event) {
    const recipe = this.data.recipes[Number(event.currentTarget.dataset.index)]
    if (!recipe) return
    wx.navigateTo({
      url: '/pages/recipe/recipe',
      success: response => response.eventChannel.emit('recipeData', { recipe })
    })
  }
})
