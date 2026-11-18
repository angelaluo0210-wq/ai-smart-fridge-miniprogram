/**
 * classicRecipes.js
 * 中国家常菜预置菜谱库（V1）
 * 中国经典家常菜；本地优先匹配，AI 仅做 fallback。
 */

const { canonicalizeIngredientName } = require('./foodShelfLifeRules')

const CLASSIC_RECIPES = [
  { id:"tomato_scrambled_eggs", title:"西红柿炒鸡蛋", requiredIngredients:["西红柿","鸡蛋"], optionalIngredients:["葱"], tags:["快手","下饭","家常"], steps:["鸡蛋炒熟盛出","西红柿炒软出汁","倒回鸡蛋调味翻匀"] },
  { id:"pepper_pork", title:"辣椒炒肉", requiredIngredients:["青椒","猪肉"], optionalIngredients:["蒜","姜"], tags:["下饭","家常"], steps:["猪肉切片炒至变色","下青椒炒至断生","调味后翻炒均匀"] },
  { id:"shredded_pork_green_pepper", title:"青椒肉丝", requiredIngredients:["青椒","猪肉"], optionalIngredients:["蒜"], tags:["快手","下饭"], steps:["猪肉切丝滑炒","加入青椒丝翻炒","调味收汁"] },
  { id:"potato_shredded", title:"酸辣土豆丝", requiredIngredients:["土豆"], optionalIngredients:["干辣椒","醋","蒜"], tags:["素菜","快手"], steps:["土豆切丝泡水","爆香蒜和辣椒","下土豆丝快炒并加醋调味"] },
  { id:"garlic_spinach", title:"蒜蓉菠菜", requiredIngredients:["菠菜"], optionalIngredients:["蒜"], tags:["素菜","快手"], steps:["菠菜洗净焯水或直接下锅","蒜末爆香","加入菠菜快速翻炒调味"] },
  { id:"garlic_broccoli", title:"蒜蓉西兰花", requiredIngredients:["西兰花"], optionalIngredients:["蒜"], tags:["素菜","清淡"], steps:["西兰花焯水","蒜末爆香","下西兰花调味翻炒"] },
  { id:"broccoli_beef", title:"西兰花炒牛肉", requiredIngredients:["西兰花","牛肉"], optionalIngredients:["蒜","姜"], tags:["荤素","下饭"], steps:["牛肉切片腌制后滑炒","西兰花焯水","合炒调味"] },
  { id:"eggplant_garlic", title:"蒜香茄子", requiredIngredients:["茄子"], optionalIngredients:["蒜","葱"], tags:["素菜","下饭"], steps:["茄子切条煎软","蒜末爆香","加茄子调味烧至入味"] },
  { id:"braised_eggplant", title:"红烧茄子", requiredIngredients:["茄子"], optionalIngredients:["青椒","蒜"], tags:["素菜","下饭"], steps:["茄子煎软","下配料翻炒","加入酱汁焖烧入味"] },
  { id:"fish_fragrant_eggplant", title:"鱼香茄子", requiredIngredients:["茄子"], optionalIngredients:["蒜","姜","葱"], tags:["下饭","经典"], steps:["茄子炒软","爆香葱姜蒜","加入鱼香汁翻炒收汁"] },
  { id:"dry_fried_green_beans", title:"干煸四季豆", requiredIngredients:["四季豆"], optionalIngredients:["猪肉","干辣椒","蒜"], tags:["下饭","家常"], steps:["四季豆炒至表皮起皱","爆香配料","回锅翻炒调味"] },
  { id:"green_beans_pork", title:"豆角炒肉", requiredIngredients:["四季豆","猪肉"], optionalIngredients:["蒜"], tags:["下饭","家常"], steps:["猪肉炒至变色","加入豆角翻炒","加少量水焖熟后调味"] },
  { id:"cabbage_vinegar", title:"醋溜白菜", requiredIngredients:["大白菜"], optionalIngredients:["蒜","醋"], tags:["素菜","快手"], steps:["白菜切片","蒜爆香后下白菜","大火翻炒并加醋调味"] },
  { id:"hand_torn_cabbage", title:"手撕包菜", requiredIngredients:["卷心菜"], optionalIngredients:["干辣椒","蒜"], tags:["素菜","下饭"], steps:["卷心菜手撕成片","爆香蒜和辣椒","大火快炒调味"] },
  { id:"celery_pork", title:"芹菜炒肉", requiredIngredients:["芹菜","猪肉"], optionalIngredients:["蒜"], tags:["荤素","家常"], steps:["猪肉滑炒","加入芹菜翻炒","调味至芹菜断生"] },
  { id:"celery_dried_tofu", title:"芹菜炒豆干", requiredIngredients:["芹菜","豆干"], optionalIngredients:["蒜"], tags:["素菜","家常"], steps:["豆干切条煎香","加入芹菜翻炒","调味出锅"] },
  { id:"mushroom_green_veg", title:"香菇青菜", requiredIngredients:["香菇","小白菜"], optionalIngredients:["蒜"], tags:["素菜","清淡"], steps:["香菇切片炒香","加入青菜","调味快速翻炒"] },
  { id:"mushroom_chicken", title:"香菇鸡肉", requiredIngredients:["香菇","鸡肉"], optionalIngredients:["姜","葱"], tags:["家常","下饭"], steps:["鸡肉炒至变色","加入香菇翻炒","加调料焖熟"] },
  { id:"oyster_mushroom_egg", title:"平菇炒鸡蛋", requiredIngredients:["平菇","鸡蛋"], optionalIngredients:["葱"], tags:["快手","家常"], steps:["鸡蛋炒熟盛出","平菇炒软","鸡蛋回锅调味"] },
  { id:"enoki_egg", title:"金针菇炒鸡蛋", requiredIngredients:["金针菇","鸡蛋"], optionalIngredients:["葱"], tags:["快手","家常"], steps:["鸡蛋炒熟","金针菇炒软","合炒调味"] },
  { id:"cucumber_scrambled_egg", title:"黄瓜炒鸡蛋", requiredIngredients:["黄瓜","鸡蛋"], optionalIngredients:["葱"], tags:["快手","清淡"], steps:["鸡蛋炒熟","黄瓜片快速翻炒","鸡蛋回锅调味"] },
  { id:"cucumber_pork", title:"黄瓜炒肉片", requiredIngredients:["黄瓜","猪肉"], optionalIngredients:["蒜"], tags:["清淡","快手"], steps:["猪肉片炒熟","加入黄瓜片快炒","调味出锅"] },
  { id:"zucchini_egg", title:"西葫芦炒鸡蛋", requiredIngredients:["西葫芦","鸡蛋"], optionalIngredients:["葱"], tags:["快手","家常"], steps:["鸡蛋炒熟","西葫芦片炒软","鸡蛋回锅调味"] },
  { id:"zucchini_pork", title:"西葫芦炒肉片", requiredIngredients:["西葫芦","猪肉"], optionalIngredients:["蒜"], tags:["家常","快手"], steps:["肉片滑炒","加入西葫芦","调味炒熟"] },
  { id:"tomato_beef", title:"番茄炒牛肉", requiredIngredients:["西红柿","牛肉"], optionalIngredients:["葱","姜"], tags:["下饭","家常"], steps:["牛肉滑炒盛出","西红柿炒出汁","牛肉回锅调味"] },
  { id:"tomato_tofu", title:"番茄烧豆腐", requiredIngredients:["西红柿","豆腐"], optionalIngredients:["葱"], tags:["素菜","家常"], steps:["豆腐煎至微黄","西红柿炒出汁","加入豆腐焖烧调味"] },
  { id:"mapo_tofu", title:"麻婆豆腐", requiredIngredients:["豆腐","猪肉"], optionalIngredients:["豆瓣酱","花椒","蒜"], tags:["下饭","经典"], steps:["肉末炒香","加入豆瓣酱和豆腐","加水烧入味后勾薄芡"] },
  { id:"home_style_tofu", title:"家常豆腐", requiredIngredients:["豆腐"], optionalIngredients:["青椒","木耳","猪肉"], tags:["下饭","经典"], steps:["豆腐煎至两面金黄","炒香配菜","加入豆腐和酱汁焖烧"] },
  { id:"tofu_cabbage", title:"白菜炖豆腐", requiredIngredients:["大白菜","豆腐"], optionalIngredients:["葱","姜"], tags:["炖菜","清淡"], steps:["白菜炒软","加入豆腐和清水","炖至入味"] },
  { id:"tofu_mushroom", title:"香菇烧豆腐", requiredIngredients:["香菇","豆腐"], optionalIngredients:["葱"], tags:["素菜","下饭"], steps:["豆腐煎香","香菇炒香","加调料焖烧"] },
  { id:"egg_chive", title:"韭菜炒鸡蛋", requiredIngredients:["韭菜","鸡蛋"], optionalIngredients:[], tags:["快手","家常"], steps:["鸡蛋炒熟","加入韭菜段","快速翻炒调味"] },
  { id:"egg_onion", title:"洋葱炒鸡蛋", requiredIngredients:["洋葱","鸡蛋"], optionalIngredients:[], tags:["快手","家常"], steps:["鸡蛋炒熟","洋葱炒软","鸡蛋回锅调味"] },
  { id:"egg_carrot", title:"胡萝卜炒鸡蛋", requiredIngredients:["胡萝卜","鸡蛋"], optionalIngredients:["葱"], tags:["快手","家常"], steps:["鸡蛋炒熟","胡萝卜丝炒软","鸡蛋回锅调味"] },
  { id:"egg_pepper", title:"青椒炒鸡蛋", requiredIngredients:["青椒","鸡蛋"], optionalIngredients:[], tags:["快手","下饭"], steps:["鸡蛋炒熟","青椒翻炒","鸡蛋回锅调味"] },
  { id:"egg_wood_ear", title:"木耳炒鸡蛋", requiredIngredients:["木耳","鸡蛋"], optionalIngredients:["葱"], tags:["快手","家常"], steps:["鸡蛋炒熟","木耳翻炒","鸡蛋回锅调味"] },
  { id:"egg_tomato_noodle", title:"西红柿鸡蛋面", requiredIngredients:["西红柿","鸡蛋","面条"], optionalIngredients:["葱"], tags:["主食","快手"], steps:["炒好西红柿鸡蛋卤","面条煮熟","浇卤拌匀"] },
  { id:"fried_rice_egg", title:"蛋炒饭", requiredIngredients:["熟米饭","鸡蛋"], optionalIngredients:["葱","胡萝卜"], tags:["主食","快手"], steps:["鸡蛋炒散","加入米饭炒松","加配菜和调味翻匀"] },
  { id:"yangzhou_fried_rice", title:"扬州炒饭", requiredIngredients:["熟米饭","鸡蛋"], optionalIngredients:["火腿","豌豆","胡萝卜"], tags:["主食","经典"], steps:["鸡蛋炒散","下配料翻炒","加入米饭炒香调味"] },
  { id:"soy_sauce_fried_rice", title:"酱油炒饭", requiredIngredients:["熟米饭"], optionalIngredients:["鸡蛋","葱"], tags:["主食","快手"], steps:["米饭炒散","加入酱油调味","加鸡蛋或葱花翻匀"] },
  { id:"rice_poridge", title:"白粥", requiredIngredients:["大米"], optionalIngredients:[], tags:["主食","清淡"], steps:["大米洗净","加水煮开","转小火熬至米粒开花"] },
  { id:"preserved_egg_pork_congee", title:"皮蛋瘦肉粥", requiredIngredients:["大米","皮蛋","猪肉"], optionalIngredients:["姜","葱"], tags:["主食","粥"], steps:["大米煮粥","加入肉丝煮熟","放皮蛋和调味"] },
  { id:"tomato_beef_noodle", title:"番茄牛肉面", requiredIngredients:["西红柿","牛肉","面条"], optionalIngredients:["葱","姜"], tags:["主食","汤面"], steps:["牛肉炖熟","西红柿炒出汁并与牛肉同煮","煮面后浇汤"] },
  { id:"scallion_noodle", title:"葱油拌面", requiredIngredients:["面条","葱"], optionalIngredients:["酱油"], tags:["主食","快手"], steps:["葱段小火炸香","加入酱油调成葱油汁","面煮熟后拌匀"] },
  { id:"sesame_noodle", title:"麻酱拌面", requiredIngredients:["面条"], optionalIngredients:["芝麻酱","黄瓜"], tags:["主食","凉拌"], steps:["调好麻酱汁","面条煮熟过凉","拌入酱汁和配菜"] },
  { id:"pork_noodle", title:"肉丝面", requiredIngredients:["猪肉","面条"], optionalIngredients:["青菜","葱"], tags:["主食","汤面"], steps:["肉丝炒香","加水煮汤","下面条和青菜煮熟"] },
  { id:"cabbage_noodle", title:"白菜肉丝面", requiredIngredients:["大白菜","猪肉","面条"], optionalIngredients:[], tags:["主食","汤面"], steps:["肉丝炒香","加入白菜和水","下面条煮熟调味"] },
  { id:"shrimp_egg", title:"虾仁炒鸡蛋", requiredIngredients:["虾","鸡蛋"], optionalIngredients:["葱"], tags:["海鲜","快手"], steps:["虾仁炒至变色","加入蛋液","炒至凝固调味"] },
  { id:"shrimp_broccoli", title:"西兰花炒虾仁", requiredIngredients:["西兰花","虾"], optionalIngredients:["蒜"], tags:["海鲜","清淡"], steps:["虾仁炒熟盛出","西兰花焯水","合炒调味"] },
  { id:"shrimp_cucumber", title:"黄瓜炒虾仁", requiredIngredients:["黄瓜","虾"], optionalIngredients:["蒜"], tags:["海鲜","清淡"], steps:["虾仁滑炒","加入黄瓜","快速翻炒调味"] },
  { id:"shrimp_tofu", title:"虾仁豆腐", requiredIngredients:["虾","豆腐"], optionalIngredients:["葱"], tags:["海鲜","清淡"], steps:["豆腐焯水或煎香","虾仁炒熟","加少量水同烧调味"] },
  { id:"steamed_fish", title:"清蒸鱼", requiredIngredients:["鱼"], optionalIngredients:["姜","葱"], tags:["海鲜","清淡"], steps:["鱼处理干净","加姜蒸熟","淋蒸鱼豉油和热油"] },
  { id:"braised_fish", title:"红烧鱼", requiredIngredients:["鱼"], optionalIngredients:["姜","葱","蒜"], tags:["海鲜","下饭"], steps:["鱼煎至两面定型","加入葱姜蒜和酱汁","加水焖烧收汁"] },
  { id:"sweet_sour_fish", title:"糖醋鱼", requiredIngredients:["鱼"], optionalIngredients:["醋","糖"], tags:["海鲜","经典"], steps:["鱼煎熟或炸熟","调糖醋汁","浇汁收浓"] },
  { id:"fish_tofu_soup", title:"鱼头豆腐汤", requiredIngredients:["鱼","豆腐"], optionalIngredients:["姜","葱"], tags:["汤","海鲜"], steps:["鱼煎香","加热水煮白","加入豆腐继续煮熟"] },
  { id:"seaweed_egg_soup", title:"紫菜蛋花汤", requiredIngredients:["紫菜","鸡蛋"], optionalIngredients:["葱"], tags:["汤","快手"], steps:["水烧开加入紫菜","淋入蛋液","调味撒葱花"] },
  { id:"tomato_egg_soup", title:"西红柿蛋花汤", requiredIngredients:["西红柿","鸡蛋"], optionalIngredients:["葱"], tags:["汤","快手"], steps:["西红柿煮出味","淋入蛋液","调味撒葱花"] },
  { id:"winter_melon_pork_rib_soup", title:"冬瓜排骨汤", requiredIngredients:["冬瓜","排骨"], optionalIngredients:["姜"], tags:["汤","炖菜"], steps:["排骨焯水","加水和姜炖煮","加入冬瓜煮软调味"] },
  { id:"corn_pork_rib_soup", title:"玉米排骨汤", requiredIngredients:["玉米","排骨"], optionalIngredients:["胡萝卜","姜"], tags:["汤","炖菜"], steps:["排骨焯水","与玉米同炖","加入胡萝卜煮熟调味"] },
  { id:"radish_pork_rib_soup", title:"萝卜排骨汤", requiredIngredients:["白萝卜","排骨"], optionalIngredients:["姜"], tags:["汤","炖菜"], steps:["排骨焯水炖煮","加入白萝卜","炖至软烂调味"] },
  { id:"lotus_root_pork_rib_soup", title:"莲藕排骨汤", requiredIngredients:["莲藕","排骨"], optionalIngredients:["姜"], tags:["汤","炖菜"], steps:["排骨焯水","加入莲藕和水","炖至熟软调味"] },
  { id:"tomato_potato_beef_soup", title:"番茄土豆牛肉汤", requiredIngredients:["西红柿","土豆","牛肉"], optionalIngredients:["洋葱"], tags:["汤","炖菜"], steps:["牛肉炖至半熟","加入番茄土豆","继续炖至软烂"] },
  { id:"winter_melon_shrimp_soup", title:"冬瓜虾仁汤", requiredIngredients:["冬瓜","虾"], optionalIngredients:["葱"], tags:["汤","清淡"], steps:["冬瓜煮软","加入虾仁","煮至变色后调味"] },
  { id:"mushroom_chicken_soup", title:"香菇鸡汤", requiredIngredients:["香菇","鸡肉"], optionalIngredients:["姜"], tags:["汤","炖菜"], steps:["鸡肉焯水","加入香菇和姜","小火炖熟调味"] },
  { id:"chicken_potato_stew", title:"土豆炖鸡", requiredIngredients:["土豆","鸡肉"], optionalIngredients:["姜","葱"], tags:["炖菜","下饭"], steps:["鸡肉炒香","加入土豆和调料","加水焖至软烂"] },
  { id:"chicken_mushroom_stew", title:"小鸡炖蘑菇", requiredIngredients:["鸡肉","蘑菇"], optionalIngredients:["姜","葱"], tags:["炖菜","经典"], steps:["鸡肉炒香","加入蘑菇和调料","加水炖至入味"] },
  { id:"soy_sauce_chicken", title:"酱油鸡", requiredIngredients:["鸡肉"], optionalIngredients:["姜","葱"], tags:["肉菜","家常"], steps:["鸡肉煎香","加入酱油和少量水","焖至熟透收汁"] },
  { id:"cola_chicken_wings", title:"可乐鸡翅", requiredIngredients:["鸡翅"], optionalIngredients:["可乐","姜"], tags:["肉菜","经典"], steps:["鸡翅煎至微黄","加入可乐和酱油","焖至收汁"] },
  { id:"braised_chicken_wings", title:"红烧鸡翅", requiredIngredients:["鸡翅"], optionalIngredients:["姜","葱"], tags:["肉菜","下饭"], steps:["鸡翅煎香","加入调料和水","焖至熟透收汁"] },
  { id:"salt_pepper_chicken", title:"椒盐鸡块", requiredIngredients:["鸡肉"], optionalIngredients:["椒盐"], tags:["肉菜","香煎"], steps:["鸡肉切块腌制","煎至金黄熟透","撒椒盐翻匀"] },
  { id:"kung_pao_chicken", title:"宫保鸡丁", requiredIngredients:["鸡肉"], optionalIngredients:["花生","干辣椒","葱"], tags:["经典","下饭"], steps:["鸡丁滑炒","爆香辣椒葱段","加入宫保汁和花生翻匀"] },
  { id:"cashew_chicken", title:"腰果鸡丁", requiredIngredients:["鸡肉"], optionalIngredients:["腰果","黄瓜","胡萝卜"], tags:["家常","清淡"], steps:["鸡丁滑炒","加入配菜","最后加入腰果调味"] },
  { id:"chicken_pepper", title:"青椒炒鸡丁", requiredIngredients:["鸡肉","青椒"], optionalIngredients:["蒜"], tags:["快手","下饭"], steps:["鸡丁炒至变色","加入青椒","调味翻炒"] },
  { id:"chicken_celery", title:"芹菜炒鸡丁", requiredIngredients:["鸡肉","芹菜"], optionalIngredients:["蒜"], tags:["快手","家常"], steps:["鸡丁滑炒","加入芹菜","调味炒熟"] },
  { id:"chicken_carrot", title:"胡萝卜炒鸡丁", requiredIngredients:["鸡肉","胡萝卜"], optionalIngredients:["蒜"], tags:["家常","快手"], steps:["鸡丁炒熟","加入胡萝卜","调味翻炒"] },
  { id:"braised_pork", title:"红烧肉", requiredIngredients:["五花肉"], optionalIngredients:["姜","葱"], tags:["经典","炖菜"], steps:["五花肉煸香","加入糖色和调料","加水焖至软烂"] },
  { id:"twice_cooked_pork", title:"回锅肉", requiredIngredients:["五花肉","青椒"], optionalIngredients:["蒜苗","豆瓣酱"], tags:["川味","下饭"], steps:["五花肉煮熟切片","煸出油脂","加入豆瓣酱和青椒炒香"] },
  { id:"garlic_sprout_pork", title:"蒜苗炒肉", requiredIngredients:["蒜苗","猪肉"], optionalIngredients:["蒜"], tags:["下饭","家常"], steps:["猪肉炒香","加入蒜苗","大火翻炒调味"] },
  { id:"wood_ear_pork", title:"木耳炒肉", requiredIngredients:["木耳","猪肉"], optionalIngredients:["青椒","蒜"], tags:["家常","快手"], steps:["猪肉滑炒","加入木耳和青椒","调味翻炒"] },
  { id:"onion_pork", title:"洋葱炒肉", requiredIngredients:["洋葱","猪肉"], optionalIngredients:["青椒"], tags:["家常","快手"], steps:["猪肉炒熟","加入洋葱","翻炒至断生调味"] },
  { id:"potato_pork", title:"土豆炒肉片", requiredIngredients:["土豆","猪肉"], optionalIngredients:["青椒"], tags:["家常","下饭"], steps:["猪肉炒至变色","加入土豆片","炒熟后调味"] },
  { id:"braised_pork_ribs", title:"红烧排骨", requiredIngredients:["排骨"], optionalIngredients:["姜","葱"], tags:["经典","炖菜"], steps:["排骨焯水","炒糖色和调料","加水焖至软烂"] },
  { id:"sweet_sour_ribs", title:"糖醋排骨", requiredIngredients:["排骨"], optionalIngredients:["醋","糖"], tags:["经典","下饭"], steps:["排骨煎香或焯熟","加入糖醋汁","焖煮收汁"] },
  { id:"potato_ribs", title:"土豆烧排骨", requiredIngredients:["土豆","排骨"], optionalIngredients:["姜"], tags:["炖菜","下饭"], steps:["排骨炒香","加入土豆","加水焖至软烂"] },
  { id:"bean_pork_ribs", title:"豆角焖排骨", requiredIngredients:["四季豆","排骨"], optionalIngredients:["蒜"], tags:["炖菜","下饭"], steps:["排骨炒香","加入豆角","加水焖至熟透"] },
  { id:"braised_beef", title:"红烧牛肉", requiredIngredients:["牛肉"], optionalIngredients:["姜","葱"], tags:["经典","炖菜"], steps:["牛肉焯水","炒香调料","加水炖至软烂"] },
  { id:"beef_potato", title:"土豆炖牛肉", requiredIngredients:["土豆","牛肉"], optionalIngredients:["胡萝卜"], tags:["炖菜","经典"], steps:["牛肉炖至半熟","加入土豆胡萝卜","继续炖软调味"] },
  { id:"beef_radish", title:"萝卜炖牛肉", requiredIngredients:["白萝卜","牛肉"], optionalIngredients:["姜"], tags:["炖菜","清淡"], steps:["牛肉炖至半熟","加入白萝卜","继续炖至软烂"] },
  { id:"beef_onion", title:"洋葱炒牛肉", requiredIngredients:["洋葱","牛肉"], optionalIngredients:["青椒"], tags:["快手","下饭"], steps:["牛肉滑炒","加入洋葱","调味翻炒"] },
  { id:"beef_pepper", title:"青椒炒牛肉", requiredIngredients:["青椒","牛肉"], optionalIngredients:["蒜"], tags:["快手","下饭"], steps:["牛肉滑炒","加入青椒","调味快速翻炒"] },
  { id:"beef_celery", title:"芹菜炒牛肉", requiredIngredients:["芹菜","牛肉"], optionalIngredients:["蒜"], tags:["快手","家常"], steps:["牛肉滑炒","加入芹菜","大火翻炒调味"] },
  { id:"beef_cumin", title:"孜然牛肉", requiredIngredients:["牛肉"], optionalIngredients:["孜然","洋葱"], tags:["下饭","香辣"], steps:["牛肉煎炒","加入洋葱","撒孜然和调味料翻匀"] },
  { id:"beef_tomato_stew", title:"番茄炖牛腩", requiredIngredients:["西红柿","牛肉"], optionalIngredients:["土豆","洋葱"], tags:["炖菜","经典"], steps:["牛肉炖软","加入番茄炒出的汤汁","加入配菜继续炖煮"] },
  { id:"beef_mushroom", title:"蘑菇炒牛肉", requiredIngredients:["蘑菇","牛肉"], optionalIngredients:["黑胡椒"], tags:["快手","家常"], steps:["牛肉滑炒","蘑菇炒香","合炒调味"] },
  { id:"lettuce_oyster_sauce", title:"蚝油生菜", requiredIngredients:["生菜"], optionalIngredients:["蒜","蚝油"], tags:["素菜","快手"], steps:["生菜焯水或快炒","蒜末爆香","淋蚝油汁"] },
  { id:"garlic_lettuce", title:"蒜蓉生菜", requiredIngredients:["生菜"], optionalIngredients:["蒜"], tags:["素菜","快手"], steps:["蒜末爆香","下生菜大火快炒","调味后立即出锅"] },
  { id:"garlic_bok_choy", title:"蒜蓉小白菜", requiredIngredients:["小白菜"], optionalIngredients:["蒜"], tags:["素菜","快手"], steps:["蒜末爆香","下小白菜快炒","调味出锅"] },
  { id:"bok_choy_mushroom", title:"香菇小白菜", requiredIngredients:["小白菜","香菇"], optionalIngredients:["蒜"], tags:["素菜","家常"], steps:["香菇炒香","加入小白菜","调味炒熟"] },
  { id:"stir_fried_bean_sprouts", title:"清炒豆芽", requiredIngredients:["豆芽"], optionalIngredients:["韭菜","蒜"], tags:["素菜","快手"], steps:["蒜末爆香","豆芽大火快炒","加入韭菜调味"] },
  { id:"bean_sprouts_pork", title:"豆芽炒肉丝", requiredIngredients:["豆芽","猪肉"], optionalIngredients:["葱"], tags:["家常","快手"], steps:["肉丝滑炒","加入豆芽","大火翻炒调味"] },
  { id:"lotus_root_vinegar", title:"醋溜藕片", requiredIngredients:["莲藕"], optionalIngredients:["醋","蒜"], tags:["素菜","快手"], steps:["莲藕切片焯水","蒜末爆香","加醋快速翻炒调味"] },
  { id:"lotus_root_pork", title:"莲藕炒肉片", requiredIngredients:["莲藕","猪肉"], optionalIngredients:["青椒"], tags:["家常","快手"], steps:["肉片炒熟","加入莲藕片","调味翻炒"] },
  { id:"asparagus_shrimp", title:"芦笋炒虾仁", requiredIngredients:["芦笋","虾"], optionalIngredients:["蒜"], tags:["清淡","海鲜"], steps:["芦笋焯水","虾仁炒熟","合炒调味"] },
  { id:"asparagus_beef", title:"芦笋炒牛肉", requiredIngredients:["芦笋","牛肉"], optionalIngredients:["蒜"], tags:["清淡","下饭"], steps:["牛肉滑炒","芦笋焯水","合炒调味"] },
  { id:"cauliflower_pork", title:"花菜炒肉", requiredIngredients:["花菜","猪肉"], optionalIngredients:["蒜"], tags:["家常","下饭"], steps:["花菜焯水","猪肉炒香","加入花菜调味翻炒"] },
  { id:"dry_pot_cauli", title:"干锅花菜", requiredIngredients:["花菜"], optionalIngredients:["五花肉","干辣椒","蒜"], tags:["下饭","香辣"], steps:["花菜煸炒","五花肉炒香","加入花菜和调料翻匀"] },
  { id:"stir_fried_winter_melon", title:"清炒冬瓜", requiredIngredients:["冬瓜"], optionalIngredients:["葱"], tags:["素菜","清淡"], steps:["冬瓜切片","下锅翻炒","加少量水焖软调味"] },
  { id:"winter_melon_meatballs", title:"冬瓜丸子汤", requiredIngredients:["冬瓜","猪肉"], optionalIngredients:["姜","葱"], tags:["汤","家常"], steps:["猪肉调成肉馅做丸子","冬瓜煮开","下丸子煮熟调味"] },
  { id:"pumpkin_stir_fry", title:"清炒南瓜", requiredIngredients:["南瓜"], optionalIngredients:["蒜"], tags:["素菜","家常"], steps:["南瓜切片","蒜末爆香","翻炒并焖至熟软"] },
  { id:"pumpkin_rice", title:"南瓜焖饭", requiredIngredients:["南瓜","大米"], optionalIngredients:["猪肉","香菇"], tags:["主食","焖饭"], steps:["配料炒香","加入大米和南瓜","加水焖熟"] },
  { id:"corn_egg", title:"玉米炒鸡蛋", requiredIngredients:["玉米","鸡蛋"], optionalIngredients:["胡萝卜"], tags:["快手","家常"], steps:["鸡蛋炒熟","加入玉米翻炒","调味后合炒"] },
  { id:"corn_carrot_peas", title:"玉米胡萝卜豌豆", requiredIngredients:["玉米","胡萝卜","豌豆"], optionalIngredients:[], tags:["素菜","清淡"], steps:["三种食材焯水","少油翻炒","调味出锅"] },
  { id:"pea_pork", title:"豌豆炒肉末", requiredIngredients:["豌豆","猪肉"], optionalIngredients:["胡萝卜"], tags:["家常","下饭"], steps:["肉末炒香","加入豌豆","加少量水焖熟调味"] },
  { id:"edamame_pork", title:"毛豆炒肉丁", requiredIngredients:["毛豆","猪肉"], optionalIngredients:["青椒"], tags:["家常","下饭"], steps:["肉丁炒香","加入毛豆","焖熟后加青椒调味"] },
  { id:"snow_pea_pork", title:"荷兰豆炒肉片", requiredIngredients:["荷兰豆","猪肉"], optionalIngredients:["蒜"], tags:["快手","清淡"], steps:["肉片滑炒","加入荷兰豆","大火翻炒调味"] },
  { id:"snow_pea_shrimp", title:"荷兰豆炒虾仁", requiredIngredients:["荷兰豆","虾"], optionalIngredients:["蒜"], tags:["清淡","海鲜"], steps:["虾仁炒熟","加入荷兰豆","大火翻炒调味"] },
  { id:"scrambled_egg_shrimp_tomato", title:"番茄虾仁炒蛋", requiredIngredients:["西红柿","虾","鸡蛋"], optionalIngredients:["葱"], tags:["海鲜","快手"], steps:["鸡蛋炒熟","虾仁炒变色","加入番茄和鸡蛋合炒"] },
  { id:"tofu_egg", title:"豆腐炒鸡蛋", requiredIngredients:["豆腐","鸡蛋"], optionalIngredients:["葱"], tags:["快手","家常"], steps:["豆腐煎散","加入蛋液","炒熟调味"] },
  { id:"tofu_chives", title:"韭菜炒豆腐", requiredIngredients:["韭菜","豆腐"], optionalIngredients:["蒜"], tags:["素菜","家常"], steps:["豆腐煎香","加入韭菜","快速翻炒调味"] },
  { id:"dried_tofu_pepper", title:"青椒炒豆干", requiredIngredients:["青椒","豆干"], optionalIngredients:["蒜"], tags:["素菜","下饭"], steps:["豆干煎香","加入青椒","调味翻炒"] },
  { id:"dried_tofu_pork", title:"豆干炒肉", requiredIngredients:["豆干","猪肉"], optionalIngredients:["青椒"], tags:["家常","下饭"], steps:["猪肉炒香","加入豆干","调味翻炒"] },
  { id:"bean_curd_skin_pepper", title:"青椒炒豆皮", requiredIngredients:["青椒","豆皮"], optionalIngredients:["蒜"], tags:["素菜","快手"], steps:["豆皮焯水","青椒翻炒","合炒调味"] },
  { id:"bean_curd_skin_celery", title:"芹菜炒豆皮", requiredIngredients:["芹菜","豆皮"], optionalIngredients:["蒜"], tags:["素菜","家常"], steps:["豆皮焯水","芹菜翻炒","合炒调味"] },
  { id:"tofu_skin_cold", title:"凉拌豆皮", requiredIngredients:["豆皮"], optionalIngredients:["黄瓜","香菜","蒜"], tags:["凉菜","快手"], steps:["豆皮焯水","配菜切丝","加入调味汁拌匀"] },
  { id:"cucumber_cold", title:"凉拌黄瓜", requiredIngredients:["黄瓜"], optionalIngredients:["蒜","醋"], tags:["凉菜","快手"], steps:["黄瓜拍碎切段","加入蒜末","加醋和调味拌匀"] },
  { id:"tomato_sugar", title:"糖拌西红柿", requiredIngredients:["西红柿"], optionalIngredients:["糖"], tags:["凉菜","快手"], steps:["西红柿切块","撒糖","静置片刻即可"] },
  { id:"cold_wood_ear", title:"凉拌木耳", requiredIngredients:["木耳"], optionalIngredients:["蒜","香菜","醋"], tags:["凉菜","快手"], steps:["木耳焯熟","加入蒜香菜","加调味汁拌匀"] },
  { id:"cold_spinach", title:"凉拌菠菜", requiredIngredients:["菠菜"], optionalIngredients:["蒜","芝麻"], tags:["凉菜","清淡"], steps:["菠菜焯水挤干","切段","加入调味汁拌匀"] },
  { id:"cold_broccoli", title:"凉拌西兰花", requiredIngredients:["西兰花"], optionalIngredients:["蒜"], tags:["凉菜","清淡"], steps:["西兰花焯熟","过凉沥干","加入蒜和调味汁拌匀"] },
  { id:"cold_shredded_potato", title:"凉拌土豆丝", requiredIngredients:["土豆"], optionalIngredients:["青椒","醋"], tags:["凉菜","快手"], steps:["土豆切丝焯水","过凉沥干","加调味料拌匀"] },
  { id:"shredded_potato_pepper", title:"青椒土豆丝", requiredIngredients:["土豆","青椒"], optionalIngredients:["蒜"], tags:["素菜","快手"], steps:["土豆切丝泡水","青椒切丝","大火快炒调味"] },
  { id:"potato_eggplant_pepper", title:"地三鲜", requiredIngredients:["土豆","茄子","青椒"], optionalIngredients:["蒜"], tags:["经典","下饭"], steps:["土豆茄子煎熟","青椒翻炒","加入酱汁合炒"] },
  { id:"tomato_potato", title:"番茄炒土豆片", requiredIngredients:["西红柿","土豆"], optionalIngredients:["葱"], tags:["素菜","家常"], steps:["土豆片炒至半熟","加入番茄","炒软调味"] },
  { id:"potato_egg", title:"土豆炒鸡蛋", requiredIngredients:["土豆","鸡蛋"], optionalIngredients:["葱"], tags:["家常","快手"], steps:["鸡蛋炒熟","土豆丝或片炒熟","鸡蛋回锅调味"] },
  { id:"carrot_pork", title:"胡萝卜炒肉片", requiredIngredients:["胡萝卜","猪肉"], optionalIngredients:["蒜"], tags:["家常","快手"], steps:["肉片滑炒","加入胡萝卜","调味炒熟"] },
  { id:"carrot_beef", title:"胡萝卜炒牛肉", requiredIngredients:["胡萝卜","牛肉"], optionalIngredients:["洋葱"], tags:["家常","下饭"], steps:["牛肉滑炒","胡萝卜炒软","合炒调味"] },
  { id:"onion_beef_egg", title:"洋葱牛肉炒蛋", requiredIngredients:["洋葱","牛肉","鸡蛋"], optionalIngredients:[], tags:["家常","下饭"], steps:["牛肉滑炒","洋葱炒软","加入鸡蛋合炒调味"] },
  { id:"pepper_potato_beef", title:"青椒土豆炒牛肉", requiredIngredients:["青椒","土豆","牛肉"], optionalIngredients:["蒜"], tags:["下饭","家常"], steps:["牛肉滑炒","土豆片炒熟","加入青椒合炒调味"] },
  { id:"tomato_cabbage", title:"番茄炒白菜", requiredIngredients:["西红柿","大白菜"], optionalIngredients:["蒜"], tags:["素菜","家常"], steps:["番茄炒出汁","加入白菜","炒软调味"] },
  { id:"tomato_cauliflower", title:"番茄炒花菜", requiredIngredients:["西红柿","花菜"], optionalIngredients:["蒜"], tags:["素菜","家常"], steps:["花菜焯水","番茄炒出汁","加入花菜翻炒调味"] },
  { id:"tomato_zucchini", title:"番茄炒西葫芦", requiredIngredients:["西红柿","西葫芦"], optionalIngredients:["蒜"], tags:["素菜","家常"], steps:["番茄炒出汁","加入西葫芦","炒熟调味"] },
  { id:"tomato_mushroom", title:"番茄炒蘑菇", requiredIngredients:["西红柿","蘑菇"], optionalIngredients:["蒜"], tags:["素菜","家常"], steps:["蘑菇炒香","加入番茄","炒至出汁调味"] },
  { id:"mushroom_bok_choy", title:"蘑菇炒青菜", requiredIngredients:["蘑菇","青菜"], optionalIngredients:["蒜"], tags:["素菜","清淡"], steps:["蘑菇炒香","加入青菜","大火翻炒调味"] },
  { id:"mushroom_tofu_soup", title:"菌菇豆腐汤", requiredIngredients:["蘑菇","豆腐"], optionalIngredients:["葱"], tags:["汤","清淡"], steps:["蘑菇煮出鲜味","加入豆腐","调味撒葱"] },
  { id:"seafood_tofu_soup", title:"虾仁豆腐汤", requiredIngredients:["虾","豆腐"], optionalIngredients:["紫菜","葱"], tags:["汤","海鲜"], steps:["水烧开加豆腐","加入虾仁","煮熟后调味"] },
  { id:"cabbage_pork_dumpling", title:"白菜猪肉饺子", requiredIngredients:["大白菜","猪肉","饺子皮"], optionalIngredients:["葱","姜"], tags:["主食","饺子"], steps:["白菜切碎挤水","与肉馅拌匀","包入饺子皮后煮熟"] },
  { id:"chive_egg_dumpling", title:"韭菜鸡蛋饺子", requiredIngredients:["韭菜","鸡蛋","饺子皮"], optionalIngredients:[], tags:["主食","饺子"], steps:["鸡蛋炒碎","与韭菜拌馅","包好后煮熟"] },
  { id:"celery_pork_dumpling", title:"芹菜猪肉饺子", requiredIngredients:["芹菜","猪肉","饺子皮"], optionalIngredients:["葱"], tags:["主食","饺子"], steps:["芹菜切碎","与猪肉拌馅","包好后煮熟"] },
  { id:"pan_fried_dumpling", title:"煎饺", requiredIngredients:["饺子"], optionalIngredients:["葱","芝麻"], tags:["主食","快手"], steps:["平底锅煎饺子底部","加少量水焖熟","开盖收干煎脆"] },
  { id:"dumpling_soup", title:"酸汤水饺", requiredIngredients:["饺子"], optionalIngredients:["醋","辣椒油","葱"], tags:["主食","汤食"], steps:["调好酸汤底","饺子煮熟","连汤盛入碗中"] },
  { id:"fried_noodle_veg", title:"家常炒面", requiredIngredients:["面条"], optionalIngredients:["青菜","鸡蛋","猪肉"], tags:["主食","快手"], steps:["面条煮至八成熟","配菜炒香","加入面条和调味料翻炒"] },
  { id:"fried_noodle_beef", title:"牛肉炒面", requiredIngredients:["牛肉","面条"], optionalIngredients:["青椒","洋葱"], tags:["主食","下饭"], steps:["牛肉滑炒","加入配菜","放入煮好的面条翻炒调味"] },
  { id:"fried_noodle_shrimp", title:"虾仁炒面", requiredIngredients:["虾","面条"], optionalIngredients:["青菜","鸡蛋"], tags:["主食","海鲜"], steps:["虾仁炒熟","加入配菜","放入面条翻炒调味"] },
  { id:"rice_noodle_egg", title:"鸡蛋炒粉", requiredIngredients:["米粉","鸡蛋"], optionalIngredients:["青菜"], tags:["主食","快手"], steps:["鸡蛋炒散","加入泡软米粉","放青菜和调味料炒匀"] },
  { id:"fried_rice_shrimp", title:"虾仁炒饭", requiredIngredients:["熟米饭","虾"], optionalIngredients:["鸡蛋","豌豆"], tags:["主食","海鲜"], steps:["虾仁炒熟","加入鸡蛋和配菜","放米饭炒散调味"] },
  { id:"fried_rice_beef", title:"牛肉炒饭", requiredIngredients:["熟米饭","牛肉"], optionalIngredients:["鸡蛋","葱"], tags:["主食","下饭"], steps:["牛肉炒熟","加入鸡蛋","放米饭炒散调味"] },
  { id:"fried_rice_tomato", title:"番茄炒饭", requiredIngredients:["熟米饭","西红柿"], optionalIngredients:["鸡蛋"], tags:["主食","快手"], steps:["番茄炒出汁","加入米饭炒匀","可加鸡蛋调味"] },
  { id:"rice_bowl_beef", title:"洋葱牛肉盖饭", requiredIngredients:["熟米饭","牛肉","洋葱"], optionalIngredients:["鸡蛋"], tags:["主食","盖饭"], steps:["牛肉洋葱炒香","调味收汁","浇在米饭上"] },
  { id:"rice_bowl_tomato_egg", title:"番茄鸡蛋盖饭", requiredIngredients:["熟米饭","西红柿","鸡蛋"], optionalIngredients:[], tags:["主食","盖饭"], steps:["炒好番茄鸡蛋","留少量汤汁","浇在米饭上"] },
  { id:"rice_bowl_mapo_tofu", title:"麻婆豆腐盖饭", requiredIngredients:["熟米饭","豆腐","猪肉"], optionalIngredients:["豆瓣酱"], tags:["主食","盖饭"], steps:["做好麻婆豆腐","保留适量汤汁","浇在米饭上"] },
  { id:"rice_bowl_chicken", title:"鸡肉盖饭", requiredIngredients:["熟米饭","鸡肉"], optionalIngredients:["洋葱","鸡蛋"], tags:["主食","盖饭"], steps:["鸡肉与洋葱煮熟调味","可淋入蛋液","浇在米饭上"] },
  { id:"fried_egg_noodle", title:"荷包蛋汤面", requiredIngredients:["面条","鸡蛋"], optionalIngredients:["青菜","葱"], tags:["主食","汤面"], steps:["煎或煮荷包蛋","煮面和青菜","加汤调味后放蛋"] },
  { id:"tomato_potato_noodle", title:"番茄土豆面", requiredIngredients:["西红柿","土豆","面条"], optionalIngredients:["葱"], tags:["主食","汤面"], steps:["番茄炒出汁","加入土豆和水煮熟","下面条煮熟调味"] },
  { id:"mushroom_noodle", title:"香菇青菜面", requiredIngredients:["香菇","青菜","面条"], optionalIngredients:["葱"], tags:["主食","汤面"], steps:["香菇炒香","加水煮汤","下面条和青菜煮熟"] },
  { id:"beef_cabbage_soup", title:"白菜牛肉汤", requiredIngredients:["大白菜","牛肉"], optionalIngredients:["姜"], tags:["汤","清淡"], steps:["牛肉煮熟","加入白菜","煮软调味"] },
  { id:"tofu_cabbage_soup", title:"白菜豆腐汤", requiredIngredients:["大白菜","豆腐"], optionalIngredients:["葱"], tags:["汤","清淡"], steps:["白菜煮软","加入豆腐","继续煮几分钟调味"] },
  { id:"tomato_tofu_soup", title:"番茄豆腐汤", requiredIngredients:["西红柿","豆腐"], optionalIngredients:["鸡蛋","葱"], tags:["汤","清淡"], steps:["番茄炒出汁","加水煮开","加入豆腐调味"] },
  { id:"corn_egg_soup", title:"玉米蛋花汤", requiredIngredients:["玉米","鸡蛋"], optionalIngredients:["葱"], tags:["汤","快手"], steps:["玉米煮开","淋入蛋液","调味撒葱"] },
  { id:"mushroom_egg_soup", title:"蘑菇蛋花汤", requiredIngredients:["蘑菇","鸡蛋"], optionalIngredients:["葱"], tags:["汤","快手"], steps:["蘑菇煮出鲜味","淋入蛋液","调味撒葱"] },
  { id:"radish_beef_soup", title:"萝卜牛肉汤", requiredIngredients:["白萝卜","牛肉"], optionalIngredients:["姜"], tags:["汤","炖菜"], steps:["牛肉炖熟","加入白萝卜","继续炖软调味"] },
  { id:"pumpkin_soup", title:"南瓜汤", requiredIngredients:["南瓜"], optionalIngredients:["牛奶"], tags:["汤","清淡"], steps:["南瓜蒸熟","加水或牛奶打碎","加热调味"] },
  { id:"potato_egg_soup", title:"土豆鸡蛋汤", requiredIngredients:["土豆","鸡蛋"], optionalIngredients:["葱"], tags:["汤","家常"], steps:["土豆煮软","淋入蛋液","调味撒葱"] },
  { id:"steamed_egg", title:"蒸水蛋", requiredIngredients:["鸡蛋"], optionalIngredients:["葱"], tags:["蛋类","清淡"], steps:["鸡蛋加温水打匀","过滤后蒸熟","淋少量酱油"] },
  { id:"egg_tofu_steam", title:"鸡蛋蒸豆腐", requiredIngredients:["鸡蛋","豆腐"], optionalIngredients:["葱"], tags:["蛋类","清淡"], steps:["豆腐切块摆盘","倒入蛋液","蒸熟后调味"] },
  { id:"tomato_steamed_egg", title:"番茄蒸蛋", requiredIngredients:["西红柿","鸡蛋"], optionalIngredients:["葱"], tags:["蛋类","清淡"], steps:["番茄切丁","加入蛋液","蒸熟调味"] },
  { id:"meat_patty_steamed_egg", title:"肉饼蒸蛋", requiredIngredients:["猪肉","鸡蛋"], optionalIngredients:["葱"], tags:["蛋类","家常"], steps:["猪肉调味铺碗底","打入或倒入蛋液","蒸熟即可"] },
];

function ingredientKey(name) {
  const result = canonicalizeIngredientName(name);
  return String(result.canonicalName || result.normalizedName || '').trim().toLowerCase().replace(/\s+/g, '');
}

function inventoryRows(inventory) {
  return (Array.isArray(inventory) ? inventory : []).map(item => {
    const food = item && item.food ? item.food : item || {};
    const remainingDays = Number.isInteger(item && item.remainingDays)
      ? item.remainingDays
      : Number.isInteger(food.remainingDays) ? food.remainingDays : null;
    const status = String(food.computedStatus || food.status || '');
    const quantity = Number(food.quantity);
    return { food, key: ingredientKey(food.name), remainingDays, status, quantity };
  }).filter(item => item.key && String(item.food.unit || '').trim() && Number.isFinite(item.quantity) && item.quantity > 0 && Number.isInteger(item.remainingDays) && item.remainingDays >= 0 && !['expired', 'consumed', 'discarded'].includes(item.status));
}

function recipeIngredientKeys(recipe, field) {
  return (Array.isArray(recipe && recipe[field]) ? recipe[field] : []).map(ingredientKey).filter(Boolean);
}

function canMakeRecipe(recipe, inventory) {
  const available = new Set(inventoryRows(inventory).map(item => item.key));
  const required = recipeIngredientKeys(recipe, 'requiredIngredients');
  return required.length > 0 && required.every(key => available.has(key));
}

function urgencyScore(remainingDays) {
  if (!Number.isInteger(remainingDays) || remainingDays < 0) return 0;
  if (remainingDays === 0) return 24;
  if (remainingDays === 1) return 18;
  if (remainingDays === 2) return 12;
  if (remainingDays === 3) return 6;
  return remainingDays <= 5 ? 2 : 0;
}

function scoreRecipe(recipe, inventory) {
  const rows = inventoryRows(inventory);
  const available = new Set(rows.map(item => item.key));
  const required = recipeIngredientKeys(recipe, 'requiredIngredients');
  if (!required.length || !required.every(key => available.has(key))) return Number.NEGATIVE_INFINITY;

  const optional = recipeIngredientKeys(recipe, 'optionalIngredients');
  const optionalMatched = optional.filter(key => available.has(key));
  const usedKeys = new Set(required.concat(optionalMatched));
  const expiryBonus = rows.reduce((total, item) => total + (usedKeys.has(item.key) ? urgencyScore(item.remainingDays) : 0), 0);
  return 100 + required.length * 12 + usedKeys.size * 5 + optionalMatched.length * 3 + expiryBonus;
}

function toRecipeView(recipe, inventory, score) {
  const available = new Set(inventoryRows(inventory).map(item => item.key));
  const required = Array.isArray(recipe.requiredIngredients) ? recipe.requiredIngredients : [];
  const optional = Array.isArray(recipe.optionalIngredients) ? recipe.optionalIngredients : [];
  const stocked = required.concat(optional.filter(name => available.has(ingredientKey(name))));
  const additional = optional.filter(name => !available.has(ingredientKey(name)));
  return {
    id: recipe.id,
    source: 'classic',
    title: recipe.title,
    summary: `经典家常菜${Array.isArray(recipe.tags) && recipe.tags.length ? ` · ${recipe.tags.join(' · ')}` : ''}`,
    priorityIngredients: required.slice(0, 4),
    stockedIngredients: stocked.map(name => ({ name, amount: '' })),
    additionalIngredients: additional.map(name => ({ name, amount: '' })),
    steps: Array.isArray(recipe.steps) ? recipe.steps.slice() : [],
    estimatedMinutes: null,
    score,
  };
}

function findClassicRecipeCandidates(inventory) {
  return CLASSIC_RECIPES
    .filter(recipe => canMakeRecipe(recipe, inventory))
    .map(recipe => toRecipeView(recipe, inventory, scoreRecipe(recipe, inventory)))
    .sort((left, right) => right.score - left.score || String(left.id).localeCompare(String(right.id)));
}

function getRecipeBatch(candidates, page = 0, batchSize = 3) {
  const rows = Array.isArray(candidates) ? candidates : [];
  const safePage = Number.isInteger(page) && page >= 0 ? page : 0;
  const safeSize = Number.isInteger(batchSize) && batchSize > 0 ? batchSize : 3;
  const start = safePage * safeSize;
  const recipes = rows.slice(start, start + safeSize);
  return {
    recipes,
    page: safePage,
    nextPage: safePage + 1,
    hasMore: start + recipes.length < rows.length,
    total: rows.length,
  };
}

module.exports = {
  CLASSIC_RECIPES,
  canMakeRecipe,
  scoreRecipe,
  findClassicRecipeCandidates,
  getRecipeBatch,
};
