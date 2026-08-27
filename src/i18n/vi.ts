import type { TranslationSchema } from './utils';

/**
 * Vietnamese translation dictionary. Structure must stay identical to
 * src/i18n/zh.ts -- both are typed against `TranslationSchema`, so a
 * missing or mismatched key here is a compile-time error, not a runtime
 * `undefined`.
 */
export const vi: TranslationSchema = {
  common: {
    siteName: 'Thảo Dược',
    tagline: 'Chăm sóc sức khỏe truyền thống',
  },
  header: {
    announcement: ['Trí tuệ truyền thống', 'Nguyên liệu tự nhiên', 'Chất lượng đảm bảo'],
    navSale: 'Khuyến Mãi',
    navShopBy: 'Mua theo',
    navOurStory: 'Câu chuyện',
    navHealthReads: 'Thảo dược & Sức khỏe',
    searchPlaceholder: 'Tìm kiếm sản phẩm...',
    searchLabel: 'Tìm kiếm',
    accountLabel: 'Tài khoản',
    cartLabel: 'Giỏ hàng',
    menuLabel: 'Menu',
  },
  footer: {
    rights: 'Bản quyền đã được bảo lưu.',
    aboutHeadingPrefix: 'Về',
    aboutLinks: {
      story: 'Câu chuyện của chúng tôi',
      reads: 'Thảo dược / Bài viết sức khỏe',
      sustainability: 'Phát triển bền vững',
    },
    supportHeading: 'Hỗ trợ',
    supportLinks: {
      contact: 'Liên hệ',
      faqs: 'Câu hỏi thường gặp',
      wholesale: 'Hợp tác sỉ',
    },
    shopHeading: 'Mua theo mục tiêu sức khỏe',
    goals: {
      immunity: 'Miễn dịch',
      energy: 'Năng lượng & Sức sống',
      beauty: 'Làm đẹp & Chống lão hóa',
      sleep: 'Giấc ngủ & Căng thẳng',
    },
    newsletter: {
      heading: 'Tham gia cộng đồng',
      subtext: 'Nhận thông tin sản phẩm mới và bí quyết chăm sóc sức khỏe truyền thống.',
      emailPlaceholder: 'Email của bạn',
      subscribeButton: 'Đăng ký',
      privacyNote: 'Chúng tôi tôn trọng quyền riêng tư của bạn.',
    },
    terms: 'Điều khoản',
    privacy: 'Quyền riêng tư',
  },
  hero: {
    eyebrow: 'Kỷ Niệm 147 Năm',
    title: 'Đại Tiệc Sale Kỷ Niệm Lớn Nhất',
    description:
      'Ưu đãi MỚI giảm 61% cho sản phẩm thứ 2, cùng chương trình Hoàn Tiền Tức Thì trên toàn cửa hàng...',
    ctaLabel: 'Mua Ngay',
    imageAlt: 'Hình nền quảng bá Đại Tiệc Kỷ Niệm Thảo Dược với họa tiết lá thảo mộc trang nhã',
  },
  healthGoals: {
    eyebrow: 'Mua theo',
    heading: 'Mục tiêu sức khỏe',
    sectionLabel: 'Mua sắm theo mục tiêu sức khỏe',
    prev: 'Mục trước',
    next: 'Mục tiếp theo',
    items: {
      beauty: 'Làm đẹp & Chống lão hóa',
      energy: 'Năng lượng & Sức sống',
      generalWellness: 'Sức khỏe tổng thể',
      immunity: 'Tăng cường miễn dịch',
      mensWellness: 'Sức khỏe nam giới',
      jointHeart: 'Xương khớp & Tim mạch',
      mindFocus: 'Tinh thần & Tập trung',
      sleepStress: 'Giấc ngủ & Giảm căng thẳng',
      womensHealth: 'Sức khỏe nữ giới',
    },
  },
  trust: {
    label: 'Thông tin thương hiệu',
    items: [
      'THƯƠNG HIỆU DI SẢN',
      'TINH HOA Y HỌC CỔ TRUYỀN',
      'NGUYÊN LIỆU TỰ NHIÊN',
      'KIỂM ĐỊNH CHẤT LƯỢNG',
    ],
  },
  brandStory: {
    eyebrow: 'Câu chuyện thương hiệu',
    heading: 'Di sản và Tay nghề của chúng tôi',
    body:
      'Bắt nguồn từ trí tuệ y học cổ truyền, các công thức của chúng tôi tôn vinh những bài thuốc đã được kiểm chứng qua thời gian, đồng thời đáp ứng tiêu chuẩn chất lượng hiện đại. Chúng tôi tuyển chọn nguyên liệu tự nhiên một cách tỉ mỉ để hỗ trợ sức khỏe mỗi ngày.',
    imageAlt: 'Hình ảnh thương hiệu mang cảm hứng thảo dược',
  },
  trustCertifications: {
    eyebrow: 'Chất lượng & Cam kết',
    heading: 'Cam kết chất lượng vượt trội',
    ariaLabel: 'Chứng nhận chất lượng và giá trị',
    disclaimer:
      'Chứng nhận và đăng ký có thể khác nhau tùy theo từng sản phẩm. Tiêu chuẩn chất lượng nghiêm ngặt được duy trì trên toàn bộ danh mục.',
    items: {
      tga: {
        title: 'Sản phẩm được TGA liệt kê',
        subtitle: 'Tuân thủ quy định',
        description:
          'Đáp ứng một trong những tiêu chuẩn chất lượng và quy định nghiêm ngặt hàng đầu thế giới.',
      },
      nsf: {
        title: 'Chứng nhận NSF',
        subtitle: 'Chứng nhận độc lập',
        description:
          'Được kiểm chứng độc lập về chất lượng nguyên liệu và độ chính xác của nhãn.',
      },
      gmp: {
        title: 'Sản xuất đạt chuẩn GMP',
        subtitle: 'Tiêu chuẩn sản xuất',
        description:
          'Đảm bảo sản phẩm đáp ứng các tiêu chuẩn nghiêm ngặt về chất lượng và an toàn.',
      },
      fda: {
        title: 'Cơ sở đăng ký FDA',
        subtitle: 'Chất lượng & Tuân thủ',
        description:
          'Sản xuất tại các cơ sở đăng ký FDA với quy trình kiểm soát chất lượng nghiêm ngặt.',
      },
      fingerprinting: {
        title: 'Định danh thảo dược',
        subtitle: 'Xác thực khoa học',
        description:
          'Thảo dược được xác minh khoa học về danh tính, chất lượng và tính nhất quán.',
      },
    },
  },
  healthReads: {
    eyebrow: 'Góc Sức Khỏe',
    heading: 'Kiến Thức Sức Khỏe',
    ctaViewAll: 'Xem tất cả',
    basePath: 'blogs',
    items: {
      childrensHealth: {
        title: 'Sức khỏe trẻ em',
        description:
          'Những gợi ý nhẹ nhàng, dễ áp dụng để chăm sóc sức khỏe và đề kháng tự nhiên cho trẻ.',
        slug: 'childrens-health',
      },
      chronicIllness: {
        title: 'Chăm sóc bệnh mạn tính',
        description:
          'Cách kết hợp thảo dược và lối sống khoa học để hỗ trợ kiểm soát bệnh mạn tính hằng ngày.',
        slug: 'chronic-illness',
      },
      womensHealth: {
        title: 'Sức khỏe phụ nữ',
        description:
          'Từ cân bằng nội tiết đến sắc đẹp và sức bền – những kiến thức nền tảng, dễ thực hành.',
        slug: 'women-health',
      },
      tcmBasics: {
        title: 'Chuỗi kiến thức Y học cổ truyền',
        description:
          'Hiểu về nguyên lý âm dương – ngũ hành và cách ứng dụng tinh gọn trong chăm sóc hằng ngày.',
        slug: 'tcm-basics',
      },
    },
  },
  home: {
    title: 'Thảo Dược - Trang chủ',
  },
  expertCta: {
    eyebrow: 'Hãy hỏi chúng tôi',
    heading: 'Chuyên gia Y học cổ truyền luôn sẵn sàng hỗ trợ.',
    description:
      'Bạn có câu hỏi về sức khỏe, thảo dược hoặc thói quen chăm sóc hằng ngày? Hãy gửi câu hỏi và nhận những chia sẻ hữu ích từ các chuyên gia Y học cổ truyền.',
    ctaLabel: 'Bắt đầu trò chuyện',
    imageAlt: 'Chuyên gia Y học cổ truyền tư vấn sức khỏe',
  },
  naturalOils: {
    eyebrow: 'Dầu thực vật tự nhiên',
    heading: 'Tinh hoa từ thiên nhiên',
    ctaViewAll: 'Xem tất cả dầu thực vật',
    collectionPath: 'products/natural-oils',
  },
  pager: {
    prevLabel: 'Trang trước',
    nextLabel: 'Trang sau',
    pageLabel: 'Trang {page}',
  },
  product: {
    ctaViewDetails: 'Xem chi tiết',
  },
  contact: {
    home: 'Trang chủ',
    breadcrumb: 'Liên hệ',
    title: 'Liên hệ với chúng tôi',
    formHeading: 'Liên hệ',
    intro: 'Vui lòng gửi các câu hỏi chung qua biểu mẫu dưới đây. Chúng tôi mong sớm nhận được thông tin từ bạn.',
    nameLabel: 'Họ và tên',
    emailLabel: 'Email',
    phoneLabel: 'Số điện thoại',
    questionLabel: 'Nội dung cần hỗ trợ',
    questionPlaceholder: 'Chọn một nội dung',
    questionOptions: {
      order: 'Liên quan đến đơn hàng',
      internationalDelivery: 'Giao hàng quốc tế',
      productRecommendation: 'Tư vấn sản phẩm',
      giftRecommendation: 'Tư vấn quà tặng',
      supplier: 'Tôi là nhà cung cấp',
      sponsorship: 'Tài trợ',
      other: 'Khác',
    },
    orderNumberLabel: 'Mã đơn hàng',
    messageLabel: 'Tin nhắn',
    messagePlaceholder: 'Nhập nội dung tin nhắn',
    privacyAgreementPrefix: 'Tôi đồng ý với',
    privacyPolicy: 'Chính sách quyền riêng tư',
    privacyAgreementSuffix: 'của trang web.',
    send: 'Gửi',
    supportHeading: 'Hỗ trợ khách hàng',
    supportIntro: 'Bạn có câu hỏi? Vui lòng liên hệ với chúng tôi qua các kênh hỗ trợ khách hàng dưới đây.',
    customerCare: 'Chăm sóc khách hàng',
    email: 'Email',
    openingHours: 'Giờ làm việc',
    weekdays: 'Thứ Hai – Thứ Sáu',
    hours: '9:00 – 18:00 (giờ Singapore, GMT+8)',
  },
  productDetail: {
    breadcrumbLabel: 'Đường dẫn',
    breadcrumbHome: 'Trang chủ',
    backToCollection: 'Dầu thực vật tự nhiên',
    benefitsHeading: 'Điểm nổi bật',
    packSizeLabel: 'Dung tích',
    skuLabel: 'Mã sản phẩm',
    quantityLabel: 'Số lượng',
    addToCartLabel: 'Thêm vào giỏ hàng',
    ingredientsLabel: 'Thành phần',
    usageLabel: 'Cách sử dụng',
    descriptionLabel: 'Mô tả sản phẩm',
    warningsLabel: 'Lưu ý an toàn',
    botanicalNameLabel: 'Tên khoa học',
    originLabel: 'Xuất xứ',
    extractionMethodLabel: 'Phương pháp chiết xuất',
    manufacturerLabel: 'Nhà sản xuất',
    certificationsHeading: 'Chứng nhận',
  },
  seo: {
    description:
      'Thảo Dược mang đến các sản phẩm chăm sóc sức khỏe từ thảo dược thiên nhiên, kết hợp trí tuệ y học cổ truyền với tiêu chuẩn chất lượng hiện đại.',
  },
};
