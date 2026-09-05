const OFFICIAL_SOURCES = {
  currentLabel: {
    label: "GB 7718-2011（现行）",
    url: "https://www.nhc.gov.cn/zwgkzt/cybz/201106/a054a6affd0e489da150cf2b51a971a7.shtml"
  },
  currentNutrition: {
    label: "GB 28050-2011（现行）",
    url: "https://www.nhc.gov.cn/zwgk/zcjd/201402/6f68ec6692594cf28d190cb47b770c11.shtml"
  },
  newLabel: {
    label: "GB 7718-2025 官方问答",
    url: "https://www.nhc.gov.cn/sps/c100087/202509/bc824a504ec34c27883da73f14c20d44.shtml"
  },
  newNutrition: {
    label: "GB 28050-2025 官方问答",
    url: "https://www.nhc.gov.cn/sps/c100087/202509/470fa4ff5de14dd38619223cce9da4e7.shtml"
  }
};

window.FOOD_LABEL_RULES = [
  {
    id: "R01", title: "食品名称", track: "both", failSeverity: "high",
    test: text => /(产品名称|食品名称|品名)[：:]?\s*[^\n]{2,}/.test(text),
    failMessage: "未识别到明确的食品名称，请核对主展示面和识别文本。",
    passMessage: "已识别到食品名称。",
    basis: OFFICIAL_SOURCES.currentLabel,
    boundary: "仅检查字段是否出现，不判断名称真实性、醒目程度或与配料的一致性。"
  },
  {
    id: "R02", title: "配料表", track: "both", failSeverity: "high",
    test: text => /(配料表|配料)[：:]?/.test(text),
    failMessage: "未识别到配料表；是否适用豁免需结合产品类别人工确认。",
    passMessage: "已识别到配料表。",
    basis: OFFICIAL_SOURCES.currentLabel,
    boundary: "暂不判断配料顺序、复合配料展开和添加剂使用范围。"
  },
  {
    id: "R03", title: "净含量", track: "both", failSeverity: "high",
    test: text => /净含量[：:]?\s*\d+(\.\d+)?\s*(毫升|升|mL|ml|L|克|千克|g|kg)/i.test(text),
    failMessage: "未识别到同时包含数值和计量单位的净含量。",
    passMessage: "已识别到净含量及计量单位。",
    basis: OFFICIAL_SOURCES.currentLabel,
    boundary: "字符高度、位置及与食品名称同一展示面等视觉要求需看原图。"
  },
  {
    id: "R04", title: "生产者信息", track: "both", failSeverity: "high",
    test: text => /(生产者|制造商|委托方|被委托方|生产商)[：:]?\s*[^\n]{3,}/.test(text),
    failMessage: "未识别到生产者或委托生产相关主体信息。",
    passMessage: "已识别到生产主体信息。",
    basis: OFFICIAL_SOURCES.currentLabel,
    boundary: "主体真实性、委托关系完整性需人工或外部渠道核验。"
  },
  {
    id: "R05", title: "地址与联系方式", track: "both", failSeverity: "medium",
    test: text => /(地址[：:]?\s*[^\n]{4,})|(电话[：:]?\s*[0-9-]{7,})|(服务热线[：:]?\s*[0-9-]{7,})/.test(text),
    failMessage: "未完整识别到地址或联系方式，请对照包装原图。",
    passMessage: "已识别到地址或联系方式。",
    basis: OFFICIAL_SOURCES.currentLabel,
    boundary: "只检查文本存在性，不验证信息真实有效。"
  },
  {
    id: "R06", title: "生产日期", track: "both", failSeverity: "medium",
    test: text => /(生产日期|制造日期|见喷码|见包装)[：:]?/.test(text),
    failMessage: "未识别到生产日期或日期位置提示。",
    passMessage: "已识别到生产日期或位置提示。",
    basis: OFFICIAL_SOURCES.currentLabel,
    boundary: "喷码是否清晰、易查找及实际日期值需看原图。"
  },
  {
    id: "R07", title: "保质期", track: "both", failSeverity: "high",
    test: text => /保质期[：:]?\s*\d+\s*(天|日|个月|月|年)/.test(text),
    failMessage: "未识别到明确的保质期时长。",
    passMessage: "已识别到保质期。",
    basis: OFFICIAL_SOURCES.currentLabel,
    boundary: "日期组合能否确定保质期需结合生产日期和原图判断。"
  },
  {
    id: "R08", title: "贮存条件", track: "both", failSeverity: "medium",
    test: text => /(贮存|储存|保存条件|存放)[：:]?\s*[^\n]{2,}/.test(text),
    failMessage: "未识别到贮存条件；是否必须标示需结合产品特性复核。",
    passMessage: "已识别到贮存条件。",
    basis: OFFICIAL_SOURCES.currentLabel,
    boundary: "不判断条件是否足以保障产品质量。"
  },
  {
    id: "R09", title: "产品标准代号", track: "both", failSeverity: "medium",
    test: text => /(产品标准代号|执行标准)[：:]?\s*(GB|GB\/T|DB|DBS|LS|NY|SB|QB)[^\s，,；;]*/i.test(text),
    failMessage: "未识别到产品标准代号，请确认该产品是否需要标示。",
    passMessage: "已识别到产品标准代号。",
    basis: OFFICIAL_SOURCES.currentLabel,
    boundary: "标准是否现行、是否适用于该产品需专业复核。"
  },
  {
    id: "R10", title: "食品生产许可证编号", track: "both", failSeverity: "medium",
    test: text => /(生产许可证编号|食品生产许可证编号|许可证编号)[：:]?\s*SC\d{14}/i.test(text),
    failMessage: "未识别到SC开头的14位许可证编号，请结合生产属性复核。",
    passMessage: "已识别到许可证编号的文本格式。",
    basis: { label: "食品生产许可相关规定（条款待教师校核）", url: "https://www.samr.gov.cn/" },
    boundary: "只检查格式，不验证编号真实有效或是否属于该产品。"
  },
  {
    id: "R11", title: "营养成分表", track: "both", failSeverity: "high",
    test: text => /营养成分表/.test(text) && ["能量", "蛋白质", "脂肪", "碳水化合物", "钠"].every(item => text.includes(item)),
    failMessage: "未识别到营养成分表及现行核心项目；豁免情形需人工确认。",
    passMessage: "已识别到营养成分表及现行核心项目。",
    basis: OFFICIAL_SOURCES.currentNutrition,
    boundary: "暂不核算数值、修约、0界限值、声称条件和豁免情形。"
  },
  {
    id: "R12", title: "营养素参考值百分比", track: "both", failSeverity: "medium",
    test: text => /NRV\s*%|营养素参考值/i.test(text),
    failMessage: "未识别到NRV%或营养素参考值百分比表头。",
    passMessage: "已识别到营养素参考值百分比。",
    basis: OFFICIAL_SOURCES.currentNutrition,
    boundary: "暂不判断NRV%计算是否正确。"
  },
  {
    id: "R13", title: "致敏物质提示", track: "new", failSeverity: "manual",
    test: text => {
      const hasAllergen = /(小麦|麸质|大豆|花生|乳粉|牛奶|乳制品|鸡蛋|蛋液|鱼类|虾|蟹|坚果)/.test(text);
      const hasNotice = /(致敏物质|过敏原|含有[^\n]*(小麦|大豆|花生|牛奶|乳|蛋|鱼|虾|蟹|坚果)|可能含有)/.test(text);
      return !hasAllergen || hasNotice;
    },
    failMessage: "识别到常见致敏配料，但未识别到独立提示；强调方式仍需查看原图。",
    passMessage: "未发现需提示的常见致敏配料，或已识别到提示语。",
    basis: OFFICIAL_SOURCES.newLabel,
    boundary: "2027换版关注项；具体适用范围、列举清单和醒目标示方式待教师逐条校核。"
  },
  {
    id: "R14", title: "饱和脂肪和糖", track: "new", failSeverity: "medium",
    test: text => /饱和脂肪/.test(text) && /(^|\n|\s)糖(\s|[:：]|\d)/.test(text),
    failMessage: "营养成分表中未同时识别到“饱和脂肪”和“糖”，请列入2027换版清单。",
    passMessage: "已识别到新版营养标签新增核心项目“饱和脂肪”和“糖”。",
    basis: OFFICIAL_SOURCES.newNutrition,
    boundary: "2027换版关注项；不判断含量、顺序、单位、修约或豁免情形。"
  },
  {
    id: "R15", title: "盐油糖提示语", track: "new", failSeverity: "medium",
    test: text => /儿童青少年应避免过量摄入盐油糖/.test(text),
    failMessage: "未识别到新版营养标签要求的盐油糖提示语，请列入2027换版清单。",
    passMessage: "已识别到盐油糖提示语。",
    basis: OFFICIAL_SOURCES.newNutrition,
    boundary: "2027换版关注项；营养标签豁免产品可相应豁免，需人工确认。"
  }
];

window.STANDARD_TRACKS = {
  current: {
    title: "现行规则预审",
    caption: "执行12条共轨原型检查，侧重当前标签完整性。"
  },
  new: {
    title: "新标换版预审",
    caption: "执行12条共轨检查及3条2027换版关注项。"
  },
  dual: {
    title: "新旧国标双轨预审",
    caption: "将当前风险与2027换版任务分开呈现。"
  }
};

window.DEMO_LABEL_TEXT = `【团队自编演示样本｜非真实企业或产品】
产品名称：湘味香辣豆干（演示）
配料表：大豆、水、植物油、辣椒、食用盐、白砂糖、味精、食品添加剂（山梨酸钾）
净含量：80g
生产者：某某食品厂（演示主体）
地址：湖南省怀化市某产业园（演示地址）
服务热线：0745-0000000
生产日期：见包装背面喷码
保质期：9个月
贮存条件：阴凉干燥处保存，开封后请尽快食用
产品标准代号：GB/T 23494
食品生产许可证编号：SC00000000000000
营养成分表 每100克 NRV%
能量 1250kJ 15%
蛋白质 16.0g 27%
脂肪 12.0g 20%
碳水化合物 18.0g 6%
钠 780mg 39%`;
