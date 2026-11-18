/**
 * foodShelfLifeRules.js
 * V1 食品保存时间推荐规则库（新增食材与识别导入的唯一规则源）
 *
 * 设计原则：
 * 1. 易腐食品的冷藏期限主要参考 FoodSafety.gov Cold Food Storage Chart。
 * 2. 冷冻期限主要属于品质建议，不代表超过时间后自动“不安全”。
 * 3. recommendedDays 默认使用官方范围中较保守的下限。
 * 4. 水果蔬菜如果没有可靠期限，不随意编造保存天数。
 * 5. UI 应区分：
 *    - type: "safety"  食品安全建议
 *    - type: "quality" 保鲜 / 品质建议
 *
 * 温度前提：
 * - 冷藏 <= 4°C
 * - 冷冻 <= -18°C
 */

const { normalizeCategoryKey } = require('./categories');

const SOURCES = {
  FOOD_SAFETY_COLD_STORAGE: {
    id: 'foodsafety_gov_cold_storage',
    label: 'FoodSafety.gov Cold Food Storage Chart',
    url: 'https://www.foodsafety.gov/food-safety-charts/cold-food-storage-charts',
  },

  FOOD_SAFETY_4_STEPS: {
    id: 'foodsafety_gov_4_steps',
    label: 'FoodSafety.gov 4 Steps to Food Safety',
    url: 'https://www.foodsafety.gov/keep-food-safe/4-steps-to-food-safety',
  },

  USDA_FRESH_PRODUCE: {
    id: 'usda_fns_fresh_produce',
    label: 'USDA FNS Storing Fresh Produce',
    url: 'https://www.fns.usda.gov/fs/produce-safety/storage',
  },

  USDA_FOODKEEPER: {
    id: 'usda_foodkeeper',
    label: 'USDA FoodKeeper',
    url: 'https://www.foodsafety.gov/keep-food-safe/foodkeeper-app',
  },

  PROJECT_EXISTING_RULE: {
    id: 'project_existing_rule',
    label: '项目原有确定性保存规则',
    url: '',
  },
};


const TEMPERATURE_ASSUMPTIONS = {
  refrigeratedMaxC: 4,
  frozenMaxC: -18,
};


/**
 * 天数范围
 */
const dayRange = (
  minDays,
  maxDays,
  recommendedDays = minDays,
  type = 'safety'
) => ({
  minDays,
  maxDays,
  recommendedDays,
  type,
});

const qualityRange = (minDays, maxDays, recommendedDays = minDays) =>
  dayRange(minDays, maxDays, recommendedDays, 'quality');

const storageRange = (minDays, maxDays, recommendedDays = minDays) =>
  dayRange(minDays, maxDays, recommendedDays, 'storage');


/**
 * 月数范围
 *
 * 数据库存储仍转换成天数，
 * displayRange 用于 UI 展示。
 */
const monthRange = (
  minMonths,
  maxMonths,
  recommendedMonths = minMonths
) => ({
  minDays: Math.round(minMonths * 30),
  maxDays: Math.round(maxMonths * 30),
  recommendedDays: Math.round(recommendedMonths * 30),

  displayRange: `${minMonths}-${maxMonths}个月`,

  type: 'quality',
});


/**
 * 固定天数
 */
const fixedDays = (
  days,
  type = 'safety'
) => ({
  minDays: days,
  maxDays: days,
  recommendedDays: days,
  type,
});


/**
 * 不推荐这种保存方式
 */
const notRecommended = () => ({
  supported: false,
  type: 'quality',
});



const FOOD_SHELF_LIFE_RULES = [

  // =========================================================
  // 沙拉 / 即食食品
  // =========================================================

  {
    id: 'prepared_salad_mixed',

    names: [
      '鸡蛋沙拉',
      '鸡肉沙拉',
      '火腿沙拉',
      '金枪鱼沙拉',
      '通心粉沙拉',
      '意面沙拉',
    ],

    category: 'other',

    refrigerated: dayRange(
      3,
      4
    ),

    frozen: notRecommended(),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },


  // =========================================================
  // 热狗 / 午餐肉 / 培根 / 香肠
  // =========================================================

  {
    id: 'hot_dog_opened',

    names: [
      '热狗肠',
      '热狗',
      '法兰克福香肠',
    ],

    qualifiers: [
      'opened',
    ],

    category: 'meat',

    refrigerated: fixedDays(
      7
    ),

    frozen: monthRange(
      1,
      2
    ),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },


  {
    id: 'hot_dog_unopened',

    names: [
      '未开封热狗肠',
      '未开封热狗',
      '未开封法兰克福香肠',
    ],

    qualifiers: [
      'unopened',
    ],

    category: 'meat',

    refrigerated: fixedDays(
      14
    ),

    frozen: monthRange(
      1,
      2
    ),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },


  {
    id: 'luncheon_meat_opened',

    names: [
      '午餐肉片',
      '熟食肉片',
      '火腿片',
      '冷切肉',
      'deli肉',
    ],

    qualifiers: [
      'opened_or_sliced',
    ],

    category: 'meat',

    refrigerated: dayRange(
      3,
      5
    ),

    frozen: monthRange(
      1,
      2
    ),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },


  {
    id: 'luncheon_meat_unopened',

    names: [
      '未开封午餐肉',
      '未开封冷切肉',
      '未开封熟食肉',
    ],

    qualifiers: [
      'unopened',
    ],

    category: 'meat',

    refrigerated: fixedDays(
      14
    ),

    frozen: monthRange(
      1,
      2
    ),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },


  {
    id: 'bacon',

    names: [
      '培根',
      'bacon',
    ],

    category: 'meat',

    refrigerated: fixedDays(
      7
    ),

    frozen: monthRange(
      1,
      1
    ),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },


  {
    id: 'sausage_raw',

    names: [
      '生香肠',
      '生猪肉香肠',
      '生牛肉香肠',
      '生鸡肉香肠',
      '生火鸡香肠',
    ],

    category: 'meat',

    refrigerated: dayRange(
      1,
      2
    ),

    frozen: monthRange(
      1,
      2
    ),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },


  {
    id: 'sausage_cooked',

    names: [
      '熟香肠',
      '全熟香肠',
    ],

    category: 'meat',

    refrigerated: fixedDays(
      7
    ),

    frozen: monthRange(
      1,
      2
    ),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },



  // =========================================================
  // 肉馅
  // =========================================================

  {
    id: 'ground_meat_raw',

    names: [
      '牛肉馅',
      '猪肉馅',
      '羊肉馅',
      '鸡肉馅',
      '火鸡肉馅',
      '汉堡肉馅',
      '绞肉',
      '肉末',
    ],

    category: 'meat',

    refrigerated: dayRange(
      1,
      2
    ),

    frozen: monthRange(
      3,
      4
    ),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },



  // =========================================================
  // 牛肉 / 猪肉 / 羊肉
  // =========================================================

  {
    id: 'fresh_red_meat_steak',

    names: [
      '牛排',
      '西冷牛排',
      '肋眼牛排',
      '菲力牛排',
      '小牛排',
    ],

    category: 'meat',

    refrigerated: dayRange(
      3,
      5
    ),

    frozen: monthRange(
      4,
      12
    ),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },


  {
    id: 'fresh_red_meat_chops',

    names: [
      '猪排',
      '羊排',
      '小牛排块',
    ],

    category: 'meat',

    refrigerated: dayRange(
      3,
      5
    ),

    frozen: monthRange(
      4,
      12
    ),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },


  {
    id: 'fresh_red_meat_roast',

    names: [
      '烤牛肉用肉块',
      '牛肉烤块',
      '猪肉烤块',
      '羊肉烤块',
      '小牛肉烤块',
    ],

    category: 'meat',

    refrigerated: dayRange(
      3,
      5
    ),

    frozen: monthRange(
      4,
      12
    ),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },


  {
    id: 'fresh_ham_raw',

    names: [
      '鲜火腿',
      '生鲜火腿',
    ],

    category: 'meat',

    refrigerated: dayRange(
      3,
      5
    ),

    frozen: monthRange(
      6,
      6
    ),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },


  {
    id: 'fresh_ham_cooked',

    names: [
      '熟鲜火腿',
      '熟火腿',
    ],

    category: 'meat',

    refrigerated: dayRange(
      3,
      4
    ),

    frozen: monthRange(
      3,
      4
    ),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },



  // =========================================================
  // 鸡肉 / 火鸡
  // =========================================================

  {
    id: 'chicken_turkey_whole_raw',

    names: [
      '整鸡',
      '生整鸡',
      '整只鸡',
      '整只火鸡',
      '生火鸡',
    ],

    category: 'meat',

    refrigerated: dayRange(
      1,
      2
    ),

    frozen: monthRange(
      12,
      12
    ),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },


  {
    id: 'chicken_turkey_pieces_raw',

    names: [
      '鸡胸肉',
      '鸡胸',
      '鸡腿',
      '鸡腿肉',
      '去骨鸡腿',
      '鸡翅',
      '翅根',
      '鸡里脊',
      '生鸡肉',
      '火鸡胸肉',
      '火鸡腿',
      '火鸡肉块',
    ],

    category: 'meat',

    refrigerated: dayRange(
      1,
      2
    ),

    frozen: monthRange(
      9,
      9
    ),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },



  // =========================================================
  // 鱼类
  // =========================================================

  {
    id: 'fatty_fish_raw',

    names: [
      '三文鱼',
      '三文鱼柳',
      'salmon',
      'salmon fillet',
      '鲑鱼',
      '金枪鱼',
      '鲔鱼',
      '鲭鱼',
      '青花鱼',
      '鲶鱼',
      '蓝鱼',
    ],

    category: 'seafood',

    refrigerated: dayRange(
      1,
      3
    ),

    frozen: monthRange(
      2,
      3
    ),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },


  {
    id: 'lean_fish_raw_long_freeze',

    names: [
      '鳕鱼',
      '鳕鱼柳',
      'cod',
      'cod fillet',
      '比目鱼',
      '黑线鳕',
      '大比目鱼',
      '龙利鱼',
      '鲽鱼',
    ],

    category: 'seafood',

    refrigerated: dayRange(
      1,
      3
    ),

    frozen: monthRange(
      6,
      8
    ),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },


  {
    id: 'lean_fish_raw_medium_freeze',

    names: [
      '狭鳕',
      '明太鱼',
      '海鲈',
      '岩鱼',
      '海鳟',
    ],

    category: 'seafood',

    refrigerated: dayRange(
      1,
      3
    ),

    frozen: monthRange(
      4,
      8
    ),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },



  // =========================================================
  // 海鲜 / 贝类
  // =========================================================

  {
    id: 'fresh_crab_meat',

    names: [
      '鲜蟹肉',
      '蟹肉',
    ],

    category: 'seafood',

    refrigerated: dayRange(
      2,
      4
    ),

    frozen: monthRange(
      2,
      4
    ),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },


  {
    id: 'fresh_lobster',

    names: [
      '龙虾肉',
      '鲜龙虾肉',
    ],

    category: 'seafood',

    refrigerated: dayRange(
      2,
      4
    ),

    frozen: monthRange(
      2,
      4
    ),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },


  {
    id: 'live_crab_lobster',

    names: [
      '活螃蟹',
      '活蟹',
      '活龙虾',
    ],

    category: 'seafood',

    refrigerated: fixedDays(
      1
    ),

    frozen: notRecommended(),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },


  {
    id: 'live_bivalves',

    names: [
      '活蛤蜊',
      '活青口',
      '活贻贝',
      '活牡蛎',
      '活生蚝',
      '活扇贝',
    ],

    category: 'seafood',

    refrigerated: dayRange(
      5,
      10
    ),

    frozen: notRecommended(),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },


  {
    id: 'shrimp_crayfish',

    names: [
      '虾',
      '鲜虾',
      '大虾',
      '虾仁',
      '去壳虾',
      '冻虾',
      '基围虾',
      '北极虾',
      '白虾',
      '黑虎虾',
      'shrimp',
      'prawn',
      '对虾',
      '明虾',
      '小龙虾',
      'crayfish',
    ],

    category: 'seafood',

    refrigerated: dayRange(
      3,
      5
    ),

    frozen: monthRange(
      6,
      18
    ),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },


  {
    id: 'shucked_bivalves',

    names: [
      '蛤蜊肉',
      '青口肉',
      '贻贝肉',
      '牡蛎肉',
      '生蚝肉',
      '扇贝肉',
    ],

    category: 'seafood',

    refrigerated: dayRange(
      3,
      10
    ),

    frozen: monthRange(
      3,
      4
    ),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },


  {
    id: 'squid',

    names: [
      '鱿鱼',
      '鲜鱿鱼',
      '乌贼',
      '墨鱼',
    ],

    category: 'seafood',

    refrigerated: dayRange(
      1,
      3
    ),

    frozen: monthRange(
      6,
      18
    ),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },



  // =========================================================
  // 鸡蛋
  // =========================================================

  {
    id: 'egg_raw_in_shell',

    names: [
      '鸡蛋',
      '生鸡蛋',
      '带壳鸡蛋',
      '鲜鸡蛋',
    ],

    category: 'dairy_egg',

    refrigerated: dayRange(
      21,
      35,
      21
    ),

    frozen: notRecommended(),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,

    note: '带壳鸡蛋不建议直接冷冻。',
  },


  {
    id: 'egg_raw_out_of_shell',

    names: [
      '蛋液',
      '生蛋液',
      '蛋黄液',
      '蛋白液',
    ],

    category: 'dairy_egg',

    refrigerated: dayRange(
      2,
      4
    ),

    frozen: monthRange(
      12,
      12
    ),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,

    note: '蛋黄单独冷冻品质较差。',
  },


  {
    id: 'egg_hard_cooked',

    names: [
      '水煮蛋',
      '白煮蛋',
      '熟鸡蛋',
      '硬煮蛋',
    ],

    category: 'dairy_egg',

    refrigerated: fixedDays(
      7
    ),

    frozen: notRecommended(),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },


  {
    id: 'egg_casserole',

    names: [
      '鸡蛋焗菜',
      '蛋类焗烤',
      '蛋类砂锅',
    ],

    category: 'other',

    refrigerated: dayRange(
      3,
      4
    ),

    frozen: monthRange(
      2,
      3
    ),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },


  {
    id: 'quiche',

    names: [
      '咸派',
      '法式咸派',
      'quiche',
    ],

    category: 'other',

    refrigerated: dayRange(
      3,
      5
    ),

    frozen: monthRange(
      2,
      3
    ),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },



  // =========================================================
  // 汤 / 炖菜 / 剩菜
  // =========================================================

  {
    id: 'soup_stew',

    names: [
      '汤',
      '肉汤',
      '蔬菜汤',
      '炖菜',
      '炖肉',
      '火锅汤底',
    ],

    category: 'other',

    refrigerated: dayRange(
      3,
      4
    ),

    frozen: monthRange(
      2,
      3
    ),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },


  {
    id: 'cooked_meat_poultry_leftover',

    names: [
      '熟肉',
      '熟牛肉',
      '熟猪肉',
      '熟羊肉',
      '熟鸡肉',
      '烤鸡',
      '煮鸡肉',
      '熟火鸡肉',
      '肉类剩菜',
      '鸡肉剩菜',
    ],

    category: 'meat',

    refrigerated: dayRange(
      3,
      4
    ),

    frozen: monthRange(
      2,
      6
    ),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },


  {
    id: 'chicken_nuggets_patties',

    names: [
      '鸡块',
      '炸鸡块',
      '鸡肉饼',
      '鸡米花',
    ],

    qualifiers: [
      'cooked_or_ready_to_eat',
    ],

    category: 'meat',

    refrigerated: dayRange(
      3,
      4
    ),

    frozen: monthRange(
      1,
      3
    ),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },


  {
    id: 'pizza',

    names: [
      '披萨',
      'pizza',
    ],

    category: 'other',

    refrigerated: dayRange(
      3,
      4
    ),

    frozen: monthRange(
      1,
      2
    ),

    sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id,
  },



  // =========================================================
  // 水果 / 蔬菜
  //
  // 注意：
  // 以下只提供“存放位置建议”。
  // 没有可靠期限时，不自动生成过期天数。
  // =========================================================

  {
    id: 'banana',

    names: [
      '香蕉',
    ],

    category: 'fruit',

    roomTemperature: {
      recommended: true,
      type: 'quality',
    },

    refrigerated: {
      supported: false,
      type: 'quality',
    },

    sourceId: SOURCES.USDA_FRESH_PRODUCE.id,

    note: 'USDA FNS建议香蕉采用干燥室温储存，而非冷藏。',
  },


  {
    id: 'potato',

    names: [
      '土豆',
      '马铃薯',
      '洋芋',
    ],

    category: 'vegetable',

    roomTemperature: {
      recommended: true,
      type: 'quality',
    },

    refrigerated: {
      supported: false,
      type: 'quality',
    },

    sourceId: SOURCES.USDA_FRESH_PRODUCE.id,

    note: 'USDA FNS建议土豆采用干燥室温储存，而非冷藏。',
  },


  {
    id: 'sweet_potato',

    names: [
      '红薯',
      '地瓜',
      '甘薯',
    ],

    category: 'vegetable',

    roomTemperature: {
      recommended: true,
      type: 'quality',
    },

    refrigerated: {
      supported: false,
      type: 'quality',
    },

    sourceId: SOURCES.USDA_FRESH_PRODUCE.id,

    note: 'USDA FNS建议红薯采用干燥室温储存，而非冷藏。',
  },


  {
    id: 'dry_onion',

    names: [
      '洋葱',
      '黄洋葱',
      '红洋葱',
      '白洋葱',
    ],

    category: 'vegetable',

    roomTemperature: {
      recommended: true,
      type: 'quality',
    },

    refrigerated: {
      supported: false,
      type: 'quality',
    },

    sourceId: SOURCES.USDA_FRESH_PRODUCE.id,

    note: 'USDA FNS建议干洋葱采用干燥室温储存，而非冷藏。',
  },


  // =========================================================
  // 项目 Phase 2 已有高频食材规则及中文通用名称兼容
  // =========================================================

  {
    id: 'generic_fish_raw',
    names: ['鱼', '鲜鱼', '生鱼', '鱼肉', '巴沙鱼', '鲈鱼', '鲫鱼', '草鱼', '多宝鱼', '罗非鱼', 'fresh fish'],
    category: 'seafood',
    refrigerated: dayRange(1, 2, 2),
    frozen: monthRange(2, 6, 3),
    sourceId: SOURCES.PROJECT_EXISTING_RULE.id,
  },

  {
    id: 'generic_chicken_raw',
    names: ['鸡肉', '鲜鸡肉', 'raw chicken'],
    category: 'meat',
    refrigerated: dayRange(1, 2, 2),
    frozen: monthRange(2, 9, 3),
    sourceId: SOURCES.PROJECT_EXISTING_RULE.id,
  },

  {
    id: 'generic_beef_raw',
    names: ['牛肉', '牛肉片', '牛里脊', '牛腩', '牛腱', '肥牛', '西冷', '肋眼', '菲力', 'fresh beef'],
    category: 'meat',
    refrigerated: dayRange(3, 5, 3),
    frozen: monthRange(4, 12, 6),
    sourceId: SOURCES.PROJECT_EXISTING_RULE.id,
  },

  {
    id: 'generic_pork_raw',
    names: ['猪肉', '猪肉片', '五花肉', '里脊肉', '猪里脊', '梅花肉', '排骨', 'fresh pork'],
    category: 'meat',
    refrigerated: dayRange(2, 3, 3),
    frozen: monthRange(3, 6, 4),
    sourceId: SOURCES.PROJECT_EXISTING_RULE.id,
  },

  {
    id: 'cooked_rice',
    names: ['熟米饭', '剩米饭', '米饭', '熟饭'],
    category: 'staple',
    refrigerated: dayRange(3, 4, 3),
    frozen: monthRange(1, 2, 1),
    sourceId: SOURCES.PROJECT_EXISTING_RULE.id,
  },

  {
    id: 'milk_general',
    names: ['牛奶', '鲜奶', '纯牛奶', '全脂牛奶', '低脂牛奶', '脱脂牛奶', 'milk', 'whole milk', 'low-fat milk', 'skim milk'],
    category: 'dairy_egg',
    refrigerated: dayRange(3, 7, 7, 'storage'),
    sourceId: SOURCES.PROJECT_EXISTING_RULE.id,
    note: '不同包装和开封状态差异较大，应优先遵循包装说明。',
  },

  {
    id: 'tofu_general',
    names: ['豆腐', '鲜豆腐', '嫩豆腐', '老豆腐', '内酯豆腐', '北豆腐', '南豆腐', 'tofu'],
    category: 'soy',
    refrigerated: qualityRange(2, 3, 3),
    sourceId: SOURCES.PROJECT_EXISTING_RULE.id,
  },

  {
    id: 'tomato_general',
    names: ['西红柿', '番茄', 'tomato'],
    category: 'vegetable',
    refrigerated: dayRange(5, 7, 7, 'quality'),
    sourceId: SOURCES.PROJECT_EXISTING_RULE.id,
  },

  {
    id: 'carrot_general',
    names: ['胡萝卜', '红萝卜'],
    category: 'vegetable',
    refrigerated: dayRange(14, 21, 14, 'quality'),
    sourceId: SOURCES.PROJECT_EXISTING_RULE.id,
  },

  {
    id: 'spinach_general',
    names: ['菠菜', '嫩菠菜', 'baby spinach', 'spinach'],
    category: 'vegetable',
    refrigerated: dayRange(2, 3, 3, 'quality'),
    sourceId: SOURCES.PROJECT_EXISTING_RULE.id,
  },

  {
    id: 'yogurt_general',
    names: ['酸奶', '优格', '希腊酸奶', 'yogurt', 'greek yogurt'],
    category: 'dairy_egg',
    refrigerated: dayRange(7, 14, 14, 'storage'),
    sourceId: SOURCES.PROJECT_EXISTING_RULE.id,
    note: '应优先遵循包装保质期和开封后说明。',
  },

  {
    id: 'mushroom_general',
    names: ['蘑菇', '鲜蘑菇', 'mushroom'],
    category: 'vegetable',
    refrigerated: dayRange(3, 5, 5, 'quality'),
    sourceId: SOURCES.PROJECT_EXISTING_RULE.id,
  },

  {
    id: 'apple_general',
    names: ['苹果', '红苹果', '青苹果', 'apple'],
    category: 'fruit',
    refrigerated: dayRange(14, 28, 21, 'quality'),
    sourceId: SOURCES.PROJECT_EXISTING_RULE.id,
  },

  // =========================================================
  // 日常蔬菜：以下期限为保鲜 / 品质建议
  // =========================================================

  { id: 'lettuce_leafy', names: ['生菜', '罗马生菜', '球生菜', '嫩生菜', 'lettuce', 'romaine lettuce'], category: 'vegetable', refrigerated: qualityRange(3, 7, 3), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'lettuce_youmai', names: ['油麦菜', '油麦', 'chinese lettuce'], category: 'vegetable', refrigerated: qualityRange(3, 5, 3), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'bok_choy', names: ['小白菜', '上海青', '青江菜', '青梗菜', 'bok choy', 'pak choi'], category: 'vegetable', refrigerated: qualityRange(3, 5, 3), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'napa_cabbage', names: ['大白菜', '娃娃菜', '黄芽白', 'napa cabbage', 'chinese cabbage'], category: 'vegetable', refrigerated: qualityRange(7, 14, 7), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'cabbage_head', names: ['卷心菜', '包菜', '甘蓝', '圆白菜', '莲花白', 'cabbage'], category: 'vegetable', refrigerated: qualityRange(14, 21, 14), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'kale_family', names: ['羽衣甘蓝', '芥蓝', '芥兰', 'kale', 'chinese kale'], category: 'vegetable', refrigerated: qualityRange(5, 7, 5), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'water_spinach', names: ['空心菜', '通菜', '蕹菜', 'water spinach'], category: 'vegetable', refrigerated: qualityRange(2, 3, 2), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'crown_daisy', names: ['茼蒿', '蓬蒿', '皇帝菜', 'crown daisy'], category: 'vegetable', refrigerated: qualityRange(2, 3, 2), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'chinese_chives', names: ['韭菜', '韭黄', 'chinese chives', 'garlic chives'], category: 'vegetable', refrigerated: qualityRange(3, 5, 3), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'fresh_leafy_herbs', names: ['香菜', '芫荽', '欧芹', '洋香菜', 'cilantro', 'coriander', 'parsley'], category: 'vegetable', refrigerated: qualityRange(3, 5, 3), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'scallion', names: ['葱', '小葱', '香葱', '青葱', 'scallion', 'green onion', 'spring onion'], category: 'vegetable', refrigerated: qualityRange(5, 7, 5), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'broccoli', names: ['西兰花', '绿花椰菜', '青花菜', '花椰菜西兰花', 'broccoli'], category: 'vegetable', refrigerated: qualityRange(3, 5, 3), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'cauliflower', names: ['花椰菜', '菜花', '白花菜', 'cauliflower'], category: 'vegetable', refrigerated: qualityRange(4, 7, 4), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'brussels_sprouts', names: ['抱子甘蓝', '球芽甘蓝', 'Brussels sprouts', 'brussels sprout'], category: 'vegetable', refrigerated: qualityRange(7, 14, 7), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'cucumber', names: ['黄瓜', '青瓜', '小黄瓜', 'cucumber'], category: 'vegetable', refrigerated: qualityRange(5, 7, 5), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'zucchini', names: ['西葫芦', '角瓜', '美洲南瓜', 'zucchini', 'courgette'], category: 'vegetable', refrigerated: qualityRange(4, 7, 4), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'eggplant', names: ['茄子', '长茄子', '圆茄子', 'eggplant', 'aubergine'], category: 'vegetable', refrigerated: qualityRange(4, 7, 4), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'bell_pepper', names: ['青椒', '彩椒', '红椒', '黄椒', '甜椒', '灯笼椒', 'bell pepper', 'sweet pepper'], category: 'vegetable', refrigerated: qualityRange(7, 14, 7), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'cherry_tomato', names: ['樱桃番茄', '圣女果', '小番茄', 'cherry tomato', 'grape tomato'], category: 'vegetable', refrigerated: qualityRange(5, 7, 5), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'pumpkin_general', names: ['南瓜', '贝贝南瓜', '栗子南瓜', 'pumpkin'], category: 'vegetable', refrigerated: qualityRange(5, 7, 5), roomTemperature: qualityRange(30, 60, 30), sourceId: SOURCES.USDA_FOODKEEPER.id, note: '完整未切南瓜更适合阴凉干燥处；冷藏建议主要适用于已切开后。' },
  { id: 'fresh_gourds', names: ['冬瓜', '苦瓜', '丝瓜', 'winter melon', 'bitter melon', 'loofah'], category: 'vegetable', refrigerated: qualityRange(3, 7, 3), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'radish_family', names: ['白萝卜', '水萝卜', '小萝卜', '樱桃萝卜', 'radish', 'daikon'], category: 'vegetable', refrigerated: qualityRange(7, 14, 7), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'beetroot', names: ['甜菜根', '红菜头', 'beetroot', 'beet'], category: 'vegetable', refrigerated: qualityRange(7, 14, 7), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'celery', names: ['芹菜', '西芹', '香芹', 'celery'], category: 'vegetable', refrigerated: qualityRange(7, 14, 7), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'asparagus', names: ['芦笋', '石刁柏', 'asparagus'], category: 'vegetable', refrigerated: qualityRange(3, 5, 3), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'lotus_yam', names: ['莲藕', '藕', '山药', '淮山', 'lotus root', 'chinese yam'], category: 'vegetable', refrigerated: qualityRange(5, 14, 5), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'ginger_garlic', names: ['姜', '生姜', '蒜', '大蒜', '蒜头', 'ginger', 'garlic'], category: 'vegetable', refrigerated: qualityRange(14, 21, 14), roomTemperature: qualityRange(14, 30, 14), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'fresh_mushroom_varieties', names: ['白蘑菇', '口蘑', '香菇', '金针菇', '平菇', '杏鲍菇', '蟹味菇', '白玉菇', 'button mushroom', 'shiitake', 'enoki', 'oyster mushroom', 'king oyster mushroom', 'shimeji'], category: 'vegetable', refrigerated: qualityRange(3, 7, 3), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'fresh_green_beans', names: ['四季豆', '豆角', '长豆角', '豇豆', 'green beans', 'string beans'], category: 'vegetable', refrigerated: qualityRange(5, 7, 5), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'fresh_peas_corn', names: ['荷兰豆', '甜豆', '毛豆', '豌豆', '玉米', '甜玉米', 'snow peas', 'snap peas', 'edamame', 'green peas', 'sweet corn'], category: 'vegetable', refrigerated: qualityRange(3, 7, 3), sourceId: SOURCES.USDA_FOODKEEPER.id },

  // =========================================================
  // 水果：完整与切开状态分开；期限主要是保鲜建议
  // =========================================================

  { id: 'pear_general', names: ['梨', '雪梨', '香梨', '鸭梨', 'pear'], category: 'fruit', refrigerated: qualityRange(7, 14, 7), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'grape_general', names: ['葡萄', '提子', '青提', '红提', 'grape', 'grapes'], category: 'fruit', refrigerated: qualityRange(7, 14, 7), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'strawberry_general', names: ['草莓', 'strawberry', 'strawberries'], category: 'fruit', refrigerated: qualityRange(2, 3, 2), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'fresh_berries', names: ['蓝莓', '覆盆子', '树莓', '黑莓', 'blueberry', 'blueberries', 'raspberry', 'blackberry'], category: 'fruit', refrigerated: qualityRange(3, 7, 3), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'fresh_cherry', names: ['樱桃', '车厘子', 'cherry', 'cherries'], category: 'fruit', refrigerated: qualityRange(5, 7, 5), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'stone_fruit', names: ['桃', '桃子', '油桃', '李子', '杏', '水蜜桃', 'peach', 'nectarine', 'plum', 'apricot'], category: 'fruit', refrigerated: qualityRange(3, 5, 3), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'kiwifruit', names: ['猕猴桃', '奇异果', 'kiwi', 'kiwifruit'], category: 'fruit', refrigerated: qualityRange(7, 14, 7), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'citrus_fruit', names: ['橙子', '橙', '柑橘', '橘子', '桔子', '柚子', '葡萄柚', '柠檬', '青柠', 'orange', 'mandarin', 'tangerine', 'grapefruit', 'lemon', 'lime'], category: 'fruit', refrigerated: qualityRange(14, 21, 14), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'watermelon_whole', names: ['西瓜', '整个西瓜', '完整西瓜', 'whole watermelon'], category: 'fruit', refrigerated: qualityRange(7, 14, 7), roomTemperature: qualityRange(7, 10, 7), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'watermelon_cut', names: ['切开的西瓜', '切块西瓜', '西瓜切块', 'cut watermelon', 'sliced watermelon'], category: 'fruit', refrigerated: dayRange(3, 4, 3, 'safety'), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'melon_whole', names: ['哈密瓜', '蜜瓜', '整个哈密瓜', '整个蜜瓜', 'cantaloupe', 'honeydew melon', 'whole melon'], category: 'fruit', refrigerated: qualityRange(7, 14, 7), roomTemperature: qualityRange(3, 7, 3), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'melon_cut', names: ['切开的哈密瓜', '切开的蜜瓜', '哈密瓜切块', '蜜瓜切块', 'cut melon', 'cut cantaloupe'], category: 'fruit', refrigerated: dayRange(3, 4, 3, 'safety'), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'pineapple_whole', names: ['菠萝', '凤梨', '整个菠萝', '整个凤梨', 'pineapple', 'whole pineapple'], category: 'fruit', refrigerated: qualityRange(3, 5, 3), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'pineapple_cut', names: ['切开的菠萝', '切开的凤梨', '菠萝切块', '凤梨切块', 'cut pineapple'], category: 'fruit', refrigerated: dayRange(3, 4, 3, 'safety'), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'tropical_fruit_soft', names: ['芒果', '牛油果', '鳄梨', '木瓜', 'mango', 'avocado', 'papaya'], category: 'fruit', refrigerated: qualityRange(3, 7, 3), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'tropical_fruit_firm', names: ['石榴', '火龙果', 'pomegranate', 'dragon fruit', 'pitaya'], category: 'fruit', refrigerated: qualityRange(7, 14, 7), sourceId: SOURCES.USDA_FOODKEEPER.id },

  // =========================================================
  // 乳制品：按品类和开封状态区分
  // =========================================================

  { id: 'milk_opened', names: ['开封牛奶', '已开封牛奶', '开封鲜奶', 'opened milk'], category: 'dairy_egg', refrigerated: storageRange(3, 7, 3), sourceId: SOURCES.USDA_FOODKEEPER.id, note: '包装上的开封后说明优先。' },
  { id: 'cream_liquid', names: ['奶油', '淡奶油', '稀奶油', 'whipping cream', 'heavy cream', 'light cream'], category: 'dairy_egg', refrigerated: storageRange(7, 10, 7), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'sour_cream', names: ['酸奶油', 'sour cream'], category: 'dairy_egg', refrigerated: storageRange(7, 21, 7), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'butter', names: ['黄油', '无盐黄油', '有盐黄油', 'butter'], category: 'dairy_egg', refrigerated: qualityRange(30, 90, 30), frozen: monthRange(6, 9, 6), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'soft_cheese', names: ['奶油奶酪', '布里奶酪', 'brie', 'cream cheese', 'soft cheese'], category: 'dairy_egg', refrigerated: storageRange(7, 7, 7), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'fresh_cheese', names: ['茅屋奶酪', 'cottage cheese', 'ricotta', 'mozzarella', '马苏里拉', '马苏里拉奶酪'], category: 'dairy_egg', refrigerated: storageRange(5, 7, 5), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'hard_processed_cheese', names: ['cheddar', '切达奶酪', 'parmesan', '帕玛森奶酪', 'processed cheese', '再制奶酪', '加工奶酪', 'hard cheese'], category: 'dairy_egg', refrigerated: storageRange(21, 28, 21), sourceId: SOURCES.USDA_FOODKEEPER.id, note: '适用于开封后的硬质或再制奶酪；包装说明优先。' },

  // =========================================================
  // 豆制品：无明确安全依据的期限均作为品质建议
  // =========================================================

  { id: 'soy_products_fresh', names: ['豆干', '香干', '豆皮', '千张', '百叶', 'dried tofu', 'tofu skin'], category: 'soy', refrigerated: qualityRange(3, 5, 3), sourceId: SOURCES.PROJECT_EXISTING_RULE.id },
  { id: 'dried_yuba', names: ['腐竹', '干腐竹', 'yuba', 'dried bean curd stick'], category: 'soy', roomTemperature: qualityRange(90, 180, 90), sourceId: SOURCES.PROJECT_EXISTING_RULE.id, note: '干制腐竹应密封置于阴凉干燥处；受潮后不要继续储存。' },
  { id: 'soy_milk_general', names: ['豆浆', '鲜豆浆', 'soy milk'], category: 'soy', refrigerated: qualityRange(3, 5, 3), sourceId: SOURCES.PROJECT_EXISTING_RULE.id },
  { id: 'soy_milk_opened', names: ['开封豆浆', '已开封豆浆', 'opened soy milk'], category: 'soy', refrigerated: qualityRange(2, 3, 2), sourceId: SOURCES.PROJECT_EXISTING_RULE.id, note: '包装说明或现制时间更严格时应优先遵循。' },

  // =========================================================
  // 主食与熟食：熟食统一使用 3–4 天 leftovers 规则
  // =========================================================

  { id: 'cooked_starch_leftovers', names: ['炒饭', '粥', '稀饭', '熟面条', '煮面条', '熟意大利面', '意面剩菜', '熟饺子', '煮饺子', 'cooked rice', 'fried rice', 'cooked noodles', 'cooked pasta'], category: 'staple', refrigerated: dayRange(3, 4, 3, 'safety'), frozen: monthRange(3, 4, 3), sourceId: SOURCES.FOOD_SAFETY_COLD_STORAGE.id },
  { id: 'dumpling_uncooked', names: ['饺子', '生饺子', '鲜饺子', 'dumpling', 'uncooked dumplings'], category: 'staple', refrigerated: dayRange(1, 2, 1, 'safety'), frozen: monthRange(1, 3, 1), sourceId: SOURCES.PROJECT_EXISTING_RULE.id },
  { id: 'steamed_buns', names: ['馒头', '包子', '花卷', 'steamed bun', 'baozi', 'mantou'], category: 'staple', refrigerated: qualityRange(3, 4, 3), frozen: monthRange(1, 2, 1), sourceId: SOURCES.PROJECT_EXISTING_RULE.id },
  { id: 'bread_toast', names: ['面包', '吐司', '切片面包', 'bread', 'toast'], category: 'staple', refrigerated: qualityRange(5, 7, 5), roomTemperature: qualityRange(3, 5, 3), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'dry_noodles_pasta', names: ['面条', '挂面', '干面条', '意大利面', '干意面', 'noodles', 'dry pasta'], category: 'staple', roomTemperature: qualityRange(180, 365, 180), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'cake_plain', names: ['蛋糕', '海绵蛋糕', '磅蛋糕', 'cake', 'sponge cake'], category: 'staple', refrigerated: qualityRange(3, 5, 3), sourceId: SOURCES.USDA_FOODKEEPER.id },
  { id: 'cake_cream', names: ['奶油蛋糕', '鲜奶油蛋糕', '裱花蛋糕', 'cream cake', 'whipped cream cake'], category: 'staple', refrigerated: dayRange(3, 4, 3, 'safety'), sourceId: SOURCES.USDA_FOODKEEPER.id },

];



/**
 * =========================================================
 * alias 索引
 *
 * 例如：
 *
 * "鲜虾"
 * ↓
 * shrimp_crayfish
 * =========================================================
 */

const FOOD_ALIAS_INDEX =
  FOOD_SHELF_LIFE_RULES.reduce(
    (index, rule) => {

      rule.names.forEach(
        (name) => {

          index[
            name
              .trim()
              .toLowerCase()
          ] = rule.id;

        }
      );

      return index;

    },
    {}
  );



/**
 * id -> rule
 */
const RULE_BY_ID =
  FOOD_SHELF_LIFE_RULES.reduce(
    (index, rule) => {

      index[rule.id] = rule;

      return index;

    },
    {}
  );



/**
 * 精确查找食材规则
 *
 * 注意：
 * V1 暂时只做 exact alias matching。
 *
 * 更复杂的：
 * - 模糊匹配
 * - OCR normalization
 * - LLM normalization
 *
 * 建议放到 service 层，
 * 不要直接写在规则库中。
 */
function findFoodShelfLifeRule(foodName) {

  if (
    !foodName ||
    typeof foodName !== 'string'
  ) {
    return null;
  }

  const normalized =
    foodName
      .trim()
      .toLowerCase();

  const ruleId =
    FOOD_ALIAS_INDEX[
      normalized
    ];

  return ruleId
    ? RULE_BY_ID[ruleId]
    : null;
}



/**
 * 获取指定保存方式的推荐
 *
 * storageMode:
 *
 * "refrigerated"
 * "frozen"
 * "roomTemperature"
 */
function getStorageRecommendation(
  foodName,
  storageMode = 'refrigerated'
) {

  const rule =
    findFoodShelfLifeRule(
      foodName
    );


  if (!rule) {

    return {
      matched: false,
      foodName,
      storageMode,
      recommendation: null,
    };

  }


  const recommendation =
    rule[storageMode] ||
    null;


  return {

    matched: true,

    ruleId:
      rule.id,

    canonicalName:
      rule.names[0],

    category:
      rule.category,

    storageMode,

    recommendation,

    sourceId:
      rule.sourceId,

    note:
      rule.note || '',

  };

}


// =========================================================
// 小程序表单适配：分类、存储方式、推荐天数和提示文案都从上面的规则生成。
// =========================================================

const STORAGE_MODES = [
  { key: 'refrigerated', ruleKey: 'refrigerated', label: '冷藏', defaultArea: '冷藏区' },
  { key: 'frozen', ruleKey: 'frozen', label: '冷冻', defaultArea: '冷冻区' },
  { key: 'room', ruleKey: 'roomTemperature', label: '常温', defaultArea: '阴凉处' },
];

const CATEGORY_LABELS = {
  vegetable: '蔬菜', fruit: '水果', meat: '肉类', seafood: '海鲜', dairy_egg: '蛋奶',
  soy: '豆制品', staple: '主食', drink: '饮料', seasoning: '调味品', other: '其他',
};

const CATEGORY_PATTERNS = [
  ['seafood', /(?:虾|鱼|蟹|贝|鱿鱼|章鱼|海鲜|水产)/],
  ['meat', /(?:牛肉|猪肉|鸡肉|鸭肉|羊肉|排骨|肉馅|肉片)/],
  ['dairy_egg', /(?:牛奶|鲜奶|酸奶|奶酪|芝士|鸡蛋|鸭蛋)/],
  ['soy', /(?:豆腐|豆浆|豆干|豆制品)/],
  ['staple', /(?:米饭|熟饭|大米|面包|馒头|面条|主食)/],
  ['fruit', /(?:苹果|香蕉|橙|梨|葡萄|草莓|水果)/],
  ['vegetable', /(?:胡萝卜|红萝卜|西红柿|番茄|菠菜|蘑菇|白菜|青菜|蔬菜|土豆|黄瓜)/],
];

function normalizeFoodName(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, '');
}

// 这些规则因为保存期限相同而合并，但其中食材在烹饪时不能互相替代。
// 菜谱标准化必须保留具体名称，保存建议仍继续共享同一个 ruleId。
const CULINARY_DISTINCT_RULE_IDS = new Set([
  'chicken_turkey_pieces_raw',
  'generic_pork_raw',
  'ginger_garlic',
  'fresh_mushroom_varieties',
  'fresh_peas_corn',
  'soy_products_fresh',
]);

/**
 * 将库存名称转换成可供菜谱匹配使用的规范名称。
 * ruleId 仍指向具体保存状态规则（如开封牛奶、切开西瓜），
 * 因此菜谱标准化不会改变保存期限匹配所使用的规则身份。
 */
function canonicalizeIngredientName(name) {
  const normalizedName = normalizeFoodName(name);
  if (!normalizedName) {
    return { normalizedName: '', canonicalName: '', ruleId: '' };
  }
  // 菜谱匹配只接受规则库明确列出的 alias；表单所用的包含匹配不能在这里复用，
  // 否则“饺子皮”可能因包含“饺子”而被误判成一份饺子。
  const rule = findFoodShelfLifeRule(name);
  return {
    normalizedName,
    canonicalName: rule && !CULINARY_DISTINCT_RULE_IDS.has(rule.id) ? rule.names[0] : normalizedName,
    ruleId: rule ? rule.id : '',
  };
}

function normalizeRuleCategory(category) {
  return normalizeCategoryKey(category);
}

function findFoodRuleForInput(name) {
  const exact = findFoodShelfLifeRule(name);
  if (exact) return exact;
  const normalized = normalizeFoodName(name);
  if (!normalized) return null;
  const partial = FOOD_SHELF_LIFE_RULES
    .flatMap(rule => rule.names.map(alias => ({ rule, alias: normalizeFoodName(alias) })))
    .filter(item => item.alias.length >= 2 && normalized.includes(item.alias))
    .sort((left, right) => right.alias.length - left.alias.length)[0];
  return partial ? partial.rule : null;
}

function inferFoodCategory(name, preferredCategory = '') {
  const exact = findFoodRuleForInput(name);
  if (exact) return normalizeRuleCategory(exact.category);
  const normalized = normalizeFoodName(name);
  const matched = CATEGORY_PATTERNS.find(([, pattern]) => pattern.test(normalized));
  if (matched) return matched[0];
  return normalizeCategoryKey(preferredCategory);
}

function storageModeByKey(key) {
  return STORAGE_MODES.find(item => item.key === key) || STORAGE_MODES[0];
}

function inferStorageMode(value = '', fridge = null, fallback = 'refrigerated') {
  const fridgeText = fridge ? `${fridge.name || ''} ${fridge.location || ''}` : '';
  const text = `${value || ''} ${fridgeText}`.toLowerCase();
  if (/(?:冷冻|冻柜|冰柜|freezer|frozen)/.test(text)) return 'frozen';
  if (/(?:常温|室温|阴凉|pantry|room)/.test(text)) return 'room';
  if (/(?:冷藏|保鲜|冰箱|fridge|refriger)/.test(text)) return 'refrigerated';
  return storageModeByKey(fallback).key;
}

function recommendationRangeText(recommendation) {
  if (recommendation.displayRange) return recommendation.displayRange;
  if (recommendation.minDays === recommendation.maxDays) return `${recommendation.recommendedDays} 天`;
  return `${recommendation.minDays}–${recommendation.maxDays} 天`;
}

function buildRecommendationText(source, name, category, mode, recommendation, note = '') {
  const modeLabel = storageModeByKey(mode).label;
  if (source === 'template') return `常用模板：${modeLabel}保存 ${recommendation.recommendedDays} 天，已按模板预填。`;
  const target = source === 'exact' ? name : `${CATEGORY_LABELS[category] || '该类食材'}（分类参考）`;
  const range = recommendationRangeText(recommendation);
  if (recommendation.type === 'safety') {
    return `食品安全建议：${target}${modeLabel}建议在 ${range}内处理，已按 ${recommendation.recommendedDays} 天预填；包装说明更严格时以包装为准。`;
  }
  if (recommendation.type === 'quality') {
    return `保鲜建议：${target}${modeLabel}通常可保鲜约 ${range}，已按 ${recommendation.recommendedDays} 天预填；实际以状态和包装说明为准。`;
  }
  return `储存建议：${target}${modeLabel}建议参考 ${range}，已按 ${recommendation.recommendedDays} 天预填；${note || '包装说明有不同要求时以包装为准。'}`;
}

function recommendFoodShelfLife({ name, category, storageMode = 'refrigerated', template = null } = {}) {
  const mode = storageModeByKey(storageMode);
  const templateDays = Number(template && template.default_shelf_life_days);
  if (Number.isInteger(templateDays) && templateDays > 0 && inferStorageMode(template.default_storage_area, null, mode.key) === mode.key) {
    const recommendation = fixedDays(templateDays, 'template');
    return {
      source: 'template', recommendedDays: templateDays, days: templateDays,
      minDays: templateDays, maxDays: templateDays, adviceType: 'template',
      category: normalizeCategoryKey(template.category), storageMode: mode.key,
      text: buildRecommendationText('template', name, category, mode.key, recommendation),
    };
  }

  const rule = findFoodRuleForInput(name);
  const recommendation = rule && rule[mode.ruleKey];
  if (!rule || !recommendation || recommendation.supported === false || !Number.isInteger(recommendation.recommendedDays)) return null;
  const normalizedCategory = normalizeRuleCategory(rule.category);
  return {
    source: 'exact', recommendedDays: recommendation.recommendedDays, days: recommendation.recommendedDays,
    minDays: recommendation.minDays, maxDays: recommendation.maxDays, adviceType: recommendation.type,
    category: normalizedCategory, storageMode: mode.key, matchedName: rule.names[0],
    sourceId: rule.sourceId, note: rule.note || '',
    text: buildRecommendationText('exact', rule.names[0], normalizedCategory, mode.key, recommendation, rule.note),
  };
}

function recommendedDaysValue(currentValue, recommendation, manuallyEdited, force = false) {
  if (manuallyEdited && !force) return String(currentValue || '');
  return recommendation ? String(recommendation.recommendedDays) : '';
}



module.exports = {

  SOURCES,

  TEMPERATURE_ASSUMPTIONS,

  FOOD_SHELF_LIFE_RULES,

  FOOD_ALIAS_INDEX,

  findFoodShelfLifeRule,

  getStorageRecommendation,

  STORAGE_MODES,

  normalizeFoodName,

  canonicalizeIngredientName,

  findFoodRuleForInput,

  inferFoodCategory,

  inferStorageMode,

  storageModeByKey,

  buildRecommendationText,

  recommendFoodShelfLife,

  recommendedDaysValue,

};
