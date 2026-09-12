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
    // "{percent}" token, same convention as elsewhere in this file --
    // shown next to the price when a variant's compareAtMinor is a real,
    // higher price than priceMinor (see ProductDetail.astro's savingsPercent).
    savingsBadgeLabel: string;
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
    shopByMenuLabel: string;
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
    ctaSecondaryLabel: string;
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
    // Links to the dedicated /our-story page (src/pages/{vi,zh}/our-story.astro,
    // added 2026-09-12). Before that page existed, this homepage teaser had
    // nowhere to send an interested reader -- see ExpertConsultation.astro's
    // own doc comment, which flagged exactly this gap when it was written.
    readMoreLabel: string;
  };
  // Dedicated "Our Story" page (src/pages/{vi,zh}/our-story.astro, added
  // 2026-09-12 -- previously `header.navOurStory` pointed nowhere, see
  // Header.astro). Deliberately evergreen/philosophy-and-values copy, NOT
  // fabricated specific history (a founding year, a named founder, a
  // specific farm/location) -- this is a demo storefront with no real
  // corporate history yet to draw on, and inventing one would repeat the
  // exact mistake the 2026-09-12 demo-readiness audit flagged elsewhere
  // (a real competitor's privacy policy/email presented as this store's
  // own). `values` reuses the same `{ title, description }` shape as
  // `process.steps` above.
  ourStory: {
    eyebrow: string;
    heading: string;
    lede: string;
    heroImageAlt: string;
    philosophyHeading: string;
    philosophyBody1: string;
    philosophyBody2: string;
    valuesEyebrow: string;
    valuesHeading: string;
    values: Array<{ title: string; description: string }>;
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
    // Small "Featured"-style eyebrow label shown on the lead article in
    // the featured+list layout (see HealthReads.astro) -- distinct from
    // the section-level `eyebrow` above.
    featuredLabel: string;
    // Static "read the article" affordance shown on the lead/featured
    // card only (see HealthReads.astro's .hr-feature-cta) -- the list
    // rows below it rely on the inline title arrow instead, since the
    // lead card's larger footprint benefits from a more explicit CTA.
    readMore: string;
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
    prev: string;
    next: string;
  };
  account: {
    metaTitle: string;
    welcomeHeading: string; // "{name}" token
    navDashboard: string;
    navAccountInfo: string;
    navAddresses: string;
    navOrders: string;
    navSettings: string;
    navLogout: string;
    // Shown next to sidebar items that don't have a real destination yet
    // (Account Information edit, Address Book management, Settings) --
    // same honesty convention as the header's own still-unwired account-
    // menu items (Profile/Addresses/Wishlist/Settings all `href="#"`
    // there too) rather than linking to a page that doesn't exist.
    comingSoonLabel: string;
    contactInfoHeading: string;
    emailLabel: string;
    // Shown only when locals.customerUser.emailVerified is false --
    // informational only, no resend action wired here (that flow already
    // exists on its own at /customer/verify-email).
    emailUnverifiedNote: string;
    addressBookHeading: string;
    // Honest empty state -- there is no address-book table/feature yet
    // (orders capture shipping details directly on the order itself, see
    // schema.ts's own doc comment on `orders.shippingAddressLine1` etc.),
    // so this can never show fabricated saved addresses.
    addressBookEmpty: string;
    recentOrdersHeading: string;
    ordersEmptyHeading: string;
    ordersEmptyBody: string;
    continueShoppingButton: string;
    orderNumberColumn: string;
    dateColumn: string;
    itemsColumn: string;
    totalColumn: string;
    statusColumn: string;
    viewOrderLabel: string;
    // --- Order-detail page (src/pages/customer/orders/[orderNumber].astro) ---
    // Everything else that page needs (items heading, shipping-to
    // heading, payment method + cod/bank-transfer labels, subtotal/
    // shipping/total labels, the order note label) is deliberately
    // REUSED from `orderConfirmation` below rather than duplicated here
    // -- both pages show the same order shape, just to a guest vs. a
    // signed-in customer.
    backToOrdersLabel: string;
    printOrderButton: string;
    orderNotFoundHeading: string;
    orderNotFoundBody: string;
    skuLabel: string;
    qtyLabel: string;
    unitPriceLabel: string;
    lineTotalLabel: string;
    // --- Full order-history page (src/pages/customer/orders/index.astro,
    // modeled on Magento's own sales/order/history) ---
    shipToColumn: string;
    // Dashboard "recent orders" card's link to the full history page below.
    viewAllOrdersLabel: string;
    ordersCountLabel: string; // "{count}" token
    previousPageLabel: string;
    nextPageLabel: string;
    pageOfLabel: string; // "{current}" and "{total}" tokens
    perPageLabel: string;
    backToAccountLabel: string;
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
    // "{start}", "{end}", "{total}" tokens -- e.g. "{start}-{end} trong
    // {total} sản phẩm". Only shown when there's at least one item (see
    // Pager.astro's own guard) -- a listing that renders zero items never
    // reaches this at all, so there's no "0-0 of 0" case to word for.
    itemsRangeLabel: string;
  };
  // Generic labels for the reusable `ProductToolbar.astro` component --
  // the Grid/List view toggle and the Sort By / direction control shown
  // above a paginated listing's product grid, shared by any category
  // that offers sorting (natural-oils, wholesale today). Split out at
  // the top level for the same reason as `pager` above.
  toolbar: {
    viewGridLabel: string; // aria-label for the "grid view" button
    viewListLabel: string; // aria-label for the "list view" button
    sortByLabel: string; // visible label before the sort <select>
    sortPositionLabel: string;
    sortNameLabel: string;
    sortPriceLabel: string; // never shown on a category where every
    // product is price-on-request (see ProductToolbar's own
    // `showPriceSort` prop) -- still translated here so any category
    // that DOES have real prices can use it.
    // aria-labels for the direction toggle button, describing the
    // CURRENT direction (screen readers announce what clicking will do
    // is the opposite -- these describe state, not the action, matching
    // this button's aria-pressed-less toggle-via-navigation behavior).
    sortDirectionAscLabel: string;
    sortDirectionDescLabel: string;
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
  // Site-wide 404 page (src/pages/404.astro -- added 2026-09-12 per
  // the demo-readiness audit, which flagged the missing custom error
  // page). Locale is best-effort-detected from the requested path, not
  // a real /vi//zh/ prefixed route, so this lives at the top level
  // rather than nested under any single section.
  notFound: {
    title: string;
    heading: string;
    message: string;
    homeCta: string;
    searchCta: string;
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
      // Shared copy for the decorative image panel's overlay text
      // (badge + heading reuse hero.eyebrow/hero.title directly instead of
      // duplicating them here -- only the auth-specific body line needs
      // its own key). Same wording shown on all 5 customer auth pages.
      imagePanelBody: string;
    };
    login: {
      title: string;
      metaDescription: string;
      heading: string;
      eyebrow: string;
      subtitle: string;
      emailLabel: string;
      passwordLabel: string;
      forgotPasswordLink: string;
      rememberMe: string;
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
      eyebrow: string;
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
    // Generic inline message shown under any required field left empty on
    // blur/submit (see CheckoutPage.astro's client-side inline validation) --
    // distinct from errorInvalidEmail, which is specifically about format.
    errorRequiredField: string;
    // Honest reassurance shown near the submit button: this project has no
    // order-confirmation EMAIL (see src/server/email/customer-email.ts --
    // that module is auth-only), so this only promises what's real: an
    // order number, usable to look up order status later via the
    // confirmation route's own guest lookup (order-service.ts).
    orderLookupReassurance: string;
  };
  orderConfirmation: {
    pageTitle: string;
    heading: string;
    thankYouBody: string; // "{orderNumber}" token
    orderNumberLabel: string;
    statusLabel: string;
    statusPendingLabel: string;
    statusConfirmedLabel: string;
    statusProcessingLabel: string;
    statusShippedLabel: string;
    statusCompletedLabel: string;
    statusCancelledLabel: string;
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
    // Order-number "hero" box (see OrderConfirmationPage.astro) --
    // pulls the order number out of the plain info panel into its own
    // prominent, copy-able element, since there is no confirmation EMAIL
    // in this project (see src/server/email/customer-email.ts -- auth
    // only) and this page is the one place the customer can grab it from.
    copyOrderNumberLabel: string;
    orderNumberCopiedLabel: string;
    saveOrderNumberNote: string;
    copyAddressLabel: string;
    addressCopiedLabel: string;
    orderStatusPanelHeading: string;
    // Short, honest 2-step "what happens next" list -- generic order
    // lifecycle wording only (processing, then delivery); deliberately
    // does NOT mention an email, a tracking link, or a delivery date,
    // none of which this project actually sends/has.
    nextStepsHeading: string;
    nextStepProcessingTitle: string;
    nextStepProcessingBody: string;
    nextStepDeliveryTitle: string;
    nextStepDeliveryBody: string;
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
