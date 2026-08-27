import type { TranslationSchema } from './utils';

/**
 * Simplified Chinese translation dictionary. Structure must stay identical
 * to src/i18n/vi.ts -- both are typed against `TranslationSchema`, so a
 * missing or mismatched key here is a compile-time error, not a runtime
 * `undefined`.
 */
export const zh: TranslationSchema = {
  common: {
    siteName: '草药',
    tagline: '传统健康呵护',
  },
  header: {
    announcement: ['传统智慧', '天然原料', '品质保证'],
    navSale: '特惠',
    navShopBy: '按分类选购',
    navOurStory: '品牌故事',
    navHealthReads: '本草与健康',
    searchPlaceholder: '搜索产品...',
    searchLabel: '搜索',
    accountLabel: '账户',
    myAccountLabel: '我的账户',
    logoutLabel: '退出登录',
    cartLabel: '购物车',
    menuLabel: '菜单',
  },
  footer: {
    rights: '版权所有。',
    aboutHeadingPrefix: '关于',
    aboutLinks: {
      story: '我们的故事',
      reads: '本草与健康阅读',
      sustainability: '可持续发展',
    },
    supportHeading: '支持',
    supportLinks: {
      contact: '联系我们',
      faqs: '常见问题',
      wholesale: '批发咨询',
    },
    shopHeading: '按健康目标选购',
    goals: {
      immunity: '免疫力',
      energy: '能量与活力',
      beauty: '美颜与抗衰',
      sleep: '睡眠与减压',
    },
    newsletter: {
      heading: '加入我们的社区',
      subtext: '获取新品资讯与传统养生提示。',
      emailPlaceholder: '电子邮箱',
      subscribeButton: '订阅',
      privacyNote: '我们尊重您的隐私。',
    },
    terms: '条款',
    privacy: '隐私',
  },
  hero: {
    eyebrow: '147周年庆典',
    title: '年度最大周年庆典特卖',
    description: '全新第二件享61%折扣优惠，加上全场即时返现活动...',
    ctaLabel: '立即选购',
    imageAlt: '草药周年庆典宣传背景，饰以典雅草本叶片纹样',
  },
  healthGoals: {
    eyebrow: '按分类选购',
    heading: '健康目标',
    sectionLabel: '按健康目标选购',
    prev: '上一项',
    next: '下一项',
    items: {
      beauty: '美容抗衰老',
      energy: '活力能量',
      generalWellness: '整体保健',
      immunity: '增强免疫力',
      mensWellness: '男士保健',
      jointHeart: '骨关节与心脏健康',
      mindFocus: '专注与精神健康',
      sleepStress: '睡眠与舒压',
      womensHealth: '女性保健',
    },
  },
  trust: {
    label: '品牌信息',
    items: ['传承品牌', '传统智慧', '天然原料', '品质保证'],
  },
  brandStory: {
    eyebrow: '品牌故事',
    heading: '传承与匠心',
    body: '我们的配方植根于传统智慧，秉承历经时间考验的养生之道，同时符合现代品质标准。我们精心甄选天然原料，用心呵护您的日常健康。',
    imageAlt: '承载草本灵感的品牌形象照片',
  },
  trustCertifications: {
    eyebrow: '品质与承诺',
    heading: '始终坚持卓越品质',
    ariaLabel: '品质认证与价值主张',
    disclaimer: '不同产品的认证与注册情况可能有所不同。我们始终坚持严格的品质标准。',
    items: {
      tga: {
        title: 'TGA 注册产品',
        subtitle: '合规标准',
        description: '符合全球严格的质量与监管标准之一。',
      },
      nsf: {
        title: 'NSF 成分认证',
        subtitle: '独立认证',
        description: '经独立机构验证，确保原料品质与标签信息准确。',
      },
      gmp: {
        title: 'GMP 认证生产',
        subtitle: '卓越制造',
        description: '确保产品符合严格的质量与安全标准。',
      },
      fda: {
        title: 'FDA 注册设施',
        subtitle: '品质与合规',
        description: '在 FDA 注册设施中生产，并执行严格的质量控制。',
      },
      fingerprinting: {
        title: '草本指纹鉴定',
        subtitle: '科学验证',
        description: '通过科学方法验证草本原料的身份、品质与一致性。',
      },
    },
  },
  healthReads: {
    eyebrow: '健康知识',
    heading: '健康阅读',
    ctaViewAll: '查看全部',
    basePath: 'blogs',
    items: {
      childrensHealth: {
        title: '儿童健康',
        description:
          '以温和实用的方式呵护孩子日常健康与天然防护力。',
        slug: 'childrens-health',
      },
      chronicIllness: {
        title: '慢性疾病管理',
        description:
          '结合草本调理与健康生活方式，支持日常管理与稳步改善。',
        slug: 'chronic-illness',
      },
      womensHealth: {
        title: '女性健康',
        description:
          '关注内分泌平衡、美丽与耐力的实用基础指南。',
        slug: 'women-health',
      },
      tcmBasics: {
        title: '传统养生系列',
        description:
          '从阴阳五行到日常调养，简明理解与应用中医养生法。',
        slug: 'tcm-basics',
      },
    },
  },
  home: {
    title: '草药 - 首页',
  },
  expertCta: {
    eyebrow: '有健康问题？',
    heading: '向我们的传统医学专家咨询',
    description:
      '无论是健康、草药还是日常养生，都可以向我们提问，获取传统医学专家的实用建议。',
    ctaLabel: '开始咨询',
    imageAlt: '传统医学专家提供健康咨询',
  },
  naturalOils: {
    eyebrow: '天然植物油',
    heading: '精选天然植物油',
    ctaViewAll: '查看全部天然植物油',
    collectionPath: 'products/natural-oils',
  },
  pager: {
    prevLabel: '上一页',
    nextLabel: '下一页',
    pageLabel: '第 {page} 页',
  },
  product: {
    ctaViewDetails: '查看详情',
  },
  contact: {
    home: '首页',
    breadcrumb: '联系我们',
    title: '联系我们',
    formHeading: '联系我们',
    intro: '如有一般咨询，请填写以下表单。我们期待尽快收到您的消息。',
    nameLabel: '姓名',
    emailLabel: '电子邮箱',
    phoneLabel: '联系电话',
    questionLabel: '咨询类型',
    questionPlaceholder: '请选择咨询类型',
    questionOptions: {
      order: '订单相关',
      internationalDelivery: '国际配送',
      productRecommendation: '产品推荐',
      giftRecommendation: '礼品推荐',
      supplier: '供应商合作',
      sponsorship: '赞助合作',
      other: '其他',
    },
    orderNumberLabel: '订单编号',
    messageLabel: '留言',
    messagePlaceholder: '请输入您的留言',
    privacyAgreementPrefix: '我同意本网站的',
    privacyPolicy: '隐私政策',
    privacyAgreementSuffix: '。',
    send: '发送',
    supportHeading: '客户支持',
    supportIntro: '如有疑问，请通过以下客户支持渠道与我们联系。',
    customerCare: '客户服务',
    email: '电子邮箱',
    openingHours: '服务时间',
    weekdays: '星期一至星期五',
    hours: '上午 9:00 – 下午 6:00（新加坡时间，GMT+8）',
  },
  productDetail: {
    breadcrumbLabel: '面包屑导航',
    breadcrumbHome: '首页',
    backToCollection: '天然植物油',
    benefitsHeading: '产品亮点',
    packSizeLabel: '规格',
    skuLabel: '商品编号',
    quantityLabel: '数量',
    addToCartLabel: '加入购物车',
    ingredientsLabel: '成分',
    usageLabel: '使用方法',
    descriptionLabel: '产品说明',
    warningsLabel: '安全提示',
    botanicalNameLabel: '植物学名',
    originLabel: '产地',
    extractionMethodLabel: '萃取方式',
    manufacturerLabel: '生产商',
    certificationsHeading: '认证',
  },
  seo: {
    description: '草药甄选天然本草原料，融合传统养生智慧与现代品质标准，为您带来值得信赖的健康呵护产品。',
  },
};
