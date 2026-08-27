import source from '../content/privacy-policy-en.html?raw';

export interface PrivacyPolicyContent {
  title: string;
  breadcrumb: string;
  home: string;
  bodyHtml: string;
}

const bodyMatch = source.match(/<div class="rte">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/main>/);

if (!bodyMatch) {
  throw new Error('Unable to extract the Privacy Policy body from src/content/privacy-policy-en.html');
}

export const privacyPolicyEn: PrivacyPolicyContent = {
  title: 'Privacy Policy',
  breadcrumb: 'Privacy Policy',
  home: 'Home',
  // The supplied file remains the sole source of truth. Only the two Part
  // headings are lowered so the rendered page has exactly one h1.
  bodyHtml: bodyMatch[1]
    .replaceAll('<h1>', '<h2>')
    .replaceAll('</h1>', '</h2>')
    .replace(
      'https://stripe.com/privacy.',
      '<a href="https://stripe.com/privacy">https://stripe.com/privacy</a>.',
    ),
};
