module.exports = {
  // 云函数部署时不会包含 miniprogram/config.js，因此需在此同步同一个模板 ID。
  // 模板 ID 不是密钥；AppSecret 等敏感配置绝不能写入前端或此文件。
  templateId: 'p_FZi2LNq8gd0umgMpW2zlG_UZisTKLgymy27lyLBRE',
  // “保质期到期提醒”模板的真实字段，字段编号必须与公众平台完全一致。
  dataKeys: {
    foodName: 'thing6',
    remainingDays: 'number2',
    expireTime: 'time16',
    location: 'thing10',
    note: 'thing3'
  },
  // 当前用于开发版联调；正式发布并重新部署云函数前改为 formal。
  miniprogramState: 'developer'
}
