import { getRelativeLocaleUrl } from 'astro:i18n';
import { vi } from './vi';
import { zh } from './zh';

/**
 * The shared shape every locale dictionary must satisfy. `vi.ts` and `zh.ts`
 * are both typed against this interface, so a key that's missing (or has
 * the wrong shape) in either file is a compile-time `astro check` / `tsc`
 * error -- not a silent `undefined` at runtime.
 *
 * To add a new translatable string: add the key here, then add it to BOTH
 * src/i18n/vi.ts and src/i18n/zh.ts. Do not add another local `strings`
 * object inside a component.
 */
export interface TranslationSchema {
  common: {
    siteName: string;
    tagline: string;
  };
  productDetail: {
    breadcrumbLabel: string;
    breadcrumbHome: string;
    // Optional PDP section labels — only rendered once a product actually
    // has benefits/variant/ingredients/usage/description data attached.
    benefitsHeading: string;
    packSizeLabel: string;
    skuLabel: string;
    quantityLabel: string;
    addToCartLabel: string;
    ingredientsLabel: string;
    usageLabel: string;
    descriptionLabel: string;
    descriptionUsageTabLabel: string;
    warningsLabel: string;
    // Product/origin metadata + certifications — only rendered once a
    // product actually has botanicalName/countryOfOriginCode/
    // extractionMethod/manufacturerName/certifications data attached.
    botanicalNameLabel: string;
    originLabel: string;
    extractionMethodLabel: string;
    manufacturerLabel: string;
    certificationsHeading: string;
    // Add-to-cart interaction states + the price-on-request fallback CTA
    // (see ProductDetail.astro / src/lib/cart-client.ts). `{count}` is a
    // plain string token, same convention as elsewhere in this file.
    addingToCartLabel: string;
    addedToCartLabel: string;
    contactForPriceCta: string;
    insufficientStockError: string;
    noPriceError: string;
    genericAddToCartError: string;
  };
  header: {
    /** Rotates through each phrase (3s auto-advance, manual prev/next
     *  arrows) in the top announcement bar instead of a single string that
     *  truncates on narrow screens — see AnnouncementBar.astro. */
    announcement: string[];
    navSale: string;
    navShopBy: string;
    navOurStory: string;
    navHealthReads: string;
    findStoreLabel: string;
    searchPlaceholder: string;
    searchLabel: string;
    accountLabel: string;
    myAccountLabel: string;
    profileLabel: string;
    ordersLabel: string;
    addressesLabel: string;
    wishlistLabel: string;
    settingsLabel: string;
    accountMenuLabel: string;
    logoutLabel: string;
    cartLabel: string;
    menuLabel: string;
  };
  footer: {
    rights: string;
    aboutHeadingPrefix: string;
    aboutLinks: {
      story: string;
      reads: string;
      sustainability: string;
    };
    supportHeading: string;
    supportLinks: {
      contact: string;
      faqs: string;
      wholesale: string;
    };
    shopHeading: string;
    goals: {
      immunity: string;
      energy: string;
      beauty: string;
      sleep: string;
    };
    newsletter: {
      heading: string;
      subtext: string;
      emailPlaceholder: string;
      subscribeButton: string;
      privacyNote: string;
    };
    terms: string;
    privacy: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    description: string;
    ctaLabel: string;
    imageAlt: string;
  };
  healthGoals: {
    eyebrow: string;
    heading: string;
    sectionLabel: string;
    prev: string;
    next: string;
    items: {
      beauty: string;
      energy: string;
      generalWellness: string;
      immunity: string;
      mensWellness: string;
      jointHeart: string;
      mindFocus: string;
      sleepStress: string;
      womensHealth: string;
    };
    // One short descriptive paragraph per goal, for that goal's own
    // landing page hero (src/pages/{vi,zh}/health-goals/[slug].astro) --
    // distinct from `items` above, which is only the short label used on
    // the homepage carousel/grid tiles and in breadcrumbs. General
    // wellness-support framing throughout, deliberately no disease/cure
    // claims (same posture as trustCertifications.disclaimer).
    descriptions: {
      beauty: string;
      energy: string;
      generalWellness: string;
      immunity: string;
      mensWellness: string;
      jointHeart: string;
      mindFocus: string;
      sleepStress: string;
      womensHealth: string;
    };
    // Copy shared by every health-goals/[slug] page and the
    // health-goals/ index listing page (src/pages/{vi,zh}/health-goals/
    // index.astro) -- the goal-specific heading/description come from
    // `items`/`descriptions` above instead.
    page: {
      indexHeading: string; // heading for the health-goals/ listing page
      ctaHeading: string; // "explore matching products" section heading on a single goal's page
      ctaBody: string;
      ctaNaturalOils: string; // button label -> natural-oils collection
      ctaWholesale: string; // button label -> wholesale collection
    };
  };
  trust: {
    label: string;
    items: string[];
  };
  brandStory: {
    eyebrow: string;
    heading: string;
    body: string;
    imageAlt: string;
  };
  trustCertifications: {
    eyebrow: string;
    heading: string;
    ariaLabel: string;
    disclaimer: string;
    statLabel: string;
    ctaLabel: string;
    items: {
      tga: { title: string; subtitle: string; description: string };
      nsf: { title: string; subtitle: string; description: string };
      gmp: { title: string; subtitle: string; description: string };
      fda: { title: string; subtitle: string; description: string };
      fingerprinting: { title: string; subtitle: string; description: string };
    };
  };
  process: {
    eyebrow: string;
    heading: string;
    lede: string;
    steps: Array<{ title: string; description: string }>;
  };
  healthReads: {
    eyebrow: string;
    heading: string;
    ctaViewAll: string;
    basePath: string; // e.g., "blogs"
    items: {
      childrensHealth: { title: string; description: string; slug: string };
      chronicIllness: { title: string; description: string; slug: string };
      womensHealth: { title: string; description: string; slug: string };
      tcmBasics: { title: string; description: string; slug: string };
    };
  };
  expertCta: {
    eyebrow: string;
    heading: string;
    description: string;
    ctaLabel: string;
    imageAlt: string;
  };
  naturalOils: {
    eyebrow: string;
    heading: string;
    ctaViewAll: string;
    collectionPath: string; // e.g., "products/natural-oils"
  };
  // Bulk/wholesale line -- products packaged in large containers (e.g.
  // 20L drums) for B2B buyers; price is deliberately "contact us" rather
  // than a listed number (see product.priceOnRequest).
  wholesale: {
    eyebrow: string;
    heading: string;
    ctaViewAll: string;
    collectionPath: string; // e.g., "products/wholesale"
  };
  relatedProducts: {
    eyebrow: string;
    heading: string;
  };
  // Generic labels for the reusable `Pager.astro` component -- shared by
  // any paginated listing page (natural-oils today, more collections
  // later), so these live at the top level rather than nested under one
  // specific collection's translation key.
  pager: {
    prevLabel: string;
    nextLabel: string;
    pageLabel: string; // e.g., "Trang {page}" -- used with a page number
  };
  product: {
    ctaViewDetails: string;
    priceOnRequest: string;
  };
  // Pagefind-powered full-site search results page
  // (src/pages/{vi,zh}/search.astro), reached from the header search forms
  // (Header.astro -- action={localePath(lang, 'search')}). `{query}`/
  // `{count}` are plain string tokens substituted at render time (same
  // convention as auth.emails' `{siteName}`), not a template-engine
  // placeholder.
  search: {
    pageTitle: string; // <title>, e.g. "Tìm kiếm"
    heading: string;
    resultsFor: string; // e.g. 'Kết quả cho "{query}"'
    resultsCount: string; // e.g. "{count} kết quả"
    noResultsHeading: string;
    noResultsBody: string; // e.g. 'Không tìm thấy... "{query}"...'
    loadingLabel: string;
    backToShopping: string;
  };
  contact: {
    home: string;
    breadcrumb: string;
    title: string;
    formHeading: string;
    intro: string;
    nameLabel: string;
    emailLabel: string;
    phoneLabel: string;
    questionLabel: string;
    questionPlaceholder: string;
    questionOptions: {
      order: string;
      internationalDelivery: string;
      productRecommendation: string;
      giftRecommendation: string;
      supplier: string;
      sponsorship: string;
      other: string;
    };
    orderNumberLabel: string;
    messageLabel: string;
    messagePlaceholder: string;
    privacyAgreementPrefix: string;
    privacyPolicy: string;
    privacyAgreementSuffix: string;
    send: string;
    supportHeading: string;
    supportIntro: string;
    customerCare: string;
    email: string;
    openingHours: string;
    weekdays: string;
    hours: string;
  };
  home: {
    title: string;
  };
  seo: {
    description: string;
  };
  // Customer auth pages (src/pages/customer/*.astro). These pages are
  // localized by a `?lang=` query param, NOT by a /vi//zh/ path prefix like
  // the rest of the site -- src/middleware.ts's session gate matches on the
  // literal `/customer/*` prefix, and the password-reset/verify-email links
  // Better Auth emails (src/server/auth/customer-auth.ts) are hardcoded to
  // the unprefixed path, so introducing locale path segments here would
  // silently break both. See src/i18n/auth.ts.
  auth: {
    common: {
      logoAriaLabel: string;
      languageSwitcherLabel: string;
      orDivider: string;
      socialGoogle: string;
      socialFacebook: string;
      socialShop: string;
      socialComingSoon: string;
      privacyPolicy: string;
      showPassword: string;
      hidePassword: string;
      passwordHint: string;
      rateLimitError: string;
      serverError: string;
      genericError: string;
      emailRequired: string;
      emailInvalid: string;
      passwordRequired: string;
    };
    login: {
      title: string;
      metaDescription: string;
      heading: string;
      subtitle: string;
      emailLabel: string;
      passwordLabel: string;
      forgotPasswordLink: string;
      submit: string;
      submitLoading: string;
      invalidCredentials: string;
      noAccount: string;
      createAccount: string;
    };
    register: {
      title: string;
      metaDescription: string;
      heading: string;
      subtitle: string;
      nameLabel: string;
      emailLabel: string;
      passwordLabel: string;
      confirmPasswordLabel: string;
      submit: string;
      submitLoading: string;
      nameRequired: string;
      passwordTooShort: string;
      passwordMismatch: string;
      genericFailure: string;
      haveAccount: string;
      signIn: string;
    };
    forgotPassword: {
      title: string;
      metaDescription: string;
      heading: string;
      subtitle: string;
      emailLabel: string;
      submit: string;
      submitLoading: string;
      successMessage: string;
      backToSignIn: string;
    };
    resetPassword: {
      title: string;
      metaDescription: string;
      heading: string;
      subtitle: string;
      newPasswordLabel: string;
      confirmPasswordLabel: string;
      submit: string;
      submitLoading: string;
      passwordTooShort: string;
      passwordMismatch: string;
      missingToken: string;
      invalidOrExpired: string;
      successMessage: string;
      backToSignIn: string;
    };
    verifyEmail: {
      title: string;
      metaDescription: string;
      verifyingHeading: string;
      verifyingSubtitle: string;
      successHeading: string;
      successSubtitle: string;
      failedHeading: string;
      missingToken: string;
      invalidOrExpired: string;
      continueLabel: string;
      backToSignIn: string;
    };
    // Transactional email COPY (subject/heading/paragraph/CTA/ignore-note),
    // sent via src/server/email/customer-email.ts -- distinct from the
    // *.title/*.metaDescription strings above, which describe the web page
    // the email link lands on, not the email itself. `{siteName}` is a
    // plain string token substituted at send time (see customer-email.ts),
    // not a template-engine placeholder -- keeps the brand name defined
    // once (common.siteName) instead of baked into every locale's copy.
    emails: {
      common: {
        expiryNote: string;
        fallbackLinkNote: string;
      };
      verification: {
        subject: string;
        heading: string;
        paragraph: string;
        ctaLabel: string;
        ignoreNote: string;
      };
      passwordReset: {
        subject: string;
        heading: string;
        paragraph: string;
        ctaLabel: string;
        ignoreNote: string;
      };
    };
  };
  // Cart & Checkout (see src/server/commerce/*.ts). COD/bank-transfer
  // only -- no live payment gateway integration (see claude/project-
  // status.md's "Cart & Checkout" section for why). `{token}` markers
  // below are plain string tokens substituted at render time, same
  // convention as auth.emails' `{siteName}`.
  cart: {
    title: string;
    emptyHeading: string;
    emptyBody: string;
    continueShopping: string;
    itemCountLabel: string; // e.g. "{count} sản phẩm"
    quantityLabel: string;
    removeLabel: string;
    subtotalLabel: string;
    subtotalNote: string;
    viewCartButton: string;
    checkoutButton: string;
    updatingLabel: string;
    stockLimitNote: string; // "Chỉ còn {count} sản phẩm" -- {count} token
    errorGeneric: string;
    drawerCloseLabel: string;
    drawerAriaLabel: string;
  };
  checkout: {
    pageTitle: string;
    heading: string;
    emptyCartHeading: string;
    emptyCartBody: string;
    orderSummaryHeading: string;
    shippingHeading: string;
    contactHeading: string;
    fullNameLabel: string;
    emailLabel: string;
    phoneLabel: string;
    addressLabel: string;
    wardLabel: string;
    districtLabel: string;
    provinceLabel: string;
    noteLabel: string;
    notePlaceholder: string;
    paymentHeading: string;
    paymentCodLabel: string;
    paymentCodDescription: string;
    paymentBankTransferLabel: string;
    paymentBankTransferDescription: string;
    bankTransferInstructionsHeading: string;
    bankTransferPlaceholderNote: string;
    placeOrderButton: string;
    placingOrderLabel: string;
    subtotalLabel: string;
    shippingFeeLabel: string;
    shippingFeeFreeLabel: string;
    totalLabel: string;
    requiredFieldsNote: string;
    errorEmptyCart: string;
    errorInsufficientStock: string;
    errorInvalidEmail: string;
    errorGeneric: string;
  };
  orderConfirmation: {
    pageTitle: string;
    heading: string;
    thankYouBody: string; // "{orderNumber}" token
    orderNumberLabel: string;
    statusLabel: string;
    statusPendingLabel: string;
    paymentMethodLabel: string;
    codLabel: string;
    bankTransferLabel: string;
    bankTransferPlaceholderNote: string;
    itemsHeading: string;
    shippingToHeading: string;
    subtotalLabel: string;
    shippingFeeLabel: string;
    shippingFeeFreeLabel: string;
    totalLabel: string;
    continueShoppingButton: string;
    notFoundHeading: string;
    notFoundBody: string;
  };
}

export const translations = { vi, zh } as const;

/** The single source of truth for what a "locale" is across the app. Import
 * this instead of repeating the `'vi' | 'zh'` union in every component. */
export type Locale = keyof typeof translations;

/** URL locale. English currently has root-level routes and page-specific
 * copy, while the shared site dictionary remains intentionally VI/ZH. */
export type RouteLocale = Locale | 'en';

export const locales: Locale[] = ['vi', 'zh'];

export const defaultLocale: Locale = 'vi';

/** Locale-identifying metadata (switcher label + flag) -- NOT translated UI
 * copy, so it deliberately lives here rather than inside vi.ts/zh.ts. */
export const localeMeta: Record<Locale, { label: string; flag: string }> = {
  vi: { label: 'VI', flag: '🇻🇳' },
  zh: { label: 'ZH', flag: '🇨🇳' },
};

export function isLocale(value: string): value is Locale {
  return (locales as string[]).includes(value);
}

/** Returns the centralized translation dictionary for a locale. Falls back
 * to `defaultLocale` if an unrecognized value somehow reaches this at
 * runtime (the `Locale` union already prevents it at compile time). */
export function getTranslations(locale: Locale): TranslationSchema {
  return translations[locale] ?? translations[defaultLocale];
}

export function getOtherLocale(locale: Locale): Locale {
  return locale === 'vi' ? 'zh' : 'vi';
}

/** Path to a locale's homepage, e.g. localeHomePath('zh') -> "/zh/". Uses
 * Astro's native i18n routing helper instead of a hand-rolled template
 * string, so it stays correct if the routing strategy in astro.config.mjs
 * ever changes. */
export function localeHomePath(locale: Locale): string {
  return getRelativeLocaleUrl(locale, '/');
}

/** Path to an arbitrary page inside a locale, e.g.
 * localePath('zh', 'health-goals/beauty') -> "/zh/health-goals/beauty". */
export function localePath(locale: RouteLocale, path: string): string {
  return getRelativeLocaleUrl(locale, path);
}

/**
 * Given the current request's pathname and a target locale, returns the
 * equivalent path under that locale by swapping only the locale segment --
 * e.g. "/vi/health-goals/beauty" -> "/zh/health-goals/beauty". This assumes
 * routes mirror 1:1 across locales, which holds today (only the homepage
 * exists, under both /vi/ and /zh/) and continues to hold as long as future
 * pages are added with matching slugs in both locale folders.
 *
 * If a future page exists in only one locale, a component rendering on that
 * page should not rely on this blind swap -- it should pass an explicit
 * fallback (e.g. `localeHomePath(toLocale)`) instead, since there is no
 * page manifest here to verify the swapped path actually exists.
 */
export function swapLocaleInPath(pathname: string, toLocale: Locale): string {
  const segments = pathname.split('/').filter(Boolean);
  if (isLocale(segments[0] ?? '')) {
    segments[0] = toLocale;
  } else {
    segments.unshift(toLocale);
  }
  return `/${segments.join('/')}/`;
}
