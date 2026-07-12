export interface BrandingSettings {
  productName: string;
  tagline: string;
  logoUrl: string;
  supportUrl: string;
  docsUrl: string;
}

export const DEFAULT_BRANDING: BrandingSettings = {
  productName: 'WASH PRO CRM',
  tagline: 'Enterprise SCADA',
  logoUrl: '',
  supportUrl: 'https://github.com/WASH-PRO/WASH-PRO-CRM/issues',
  docsUrl: 'https://wash-pro.github.io/WASH-PRO-CRM/en/',
};

export function parseBranding(raw: unknown): BrandingSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_BRANDING };
  const v = raw as Record<string, unknown>;
  return {
    productName: String(v.productName ?? DEFAULT_BRANDING.productName).trim() || DEFAULT_BRANDING.productName,
    tagline: String(v.tagline ?? DEFAULT_BRANDING.tagline).trim() || DEFAULT_BRANDING.tagline,
    logoUrl: String(v.logoUrl ?? '').trim(),
    supportUrl: String(v.supportUrl ?? DEFAULT_BRANDING.supportUrl).trim() || DEFAULT_BRANDING.supportUrl,
    docsUrl: String(v.docsUrl ?? DEFAULT_BRANDING.docsUrl).trim() || DEFAULT_BRANDING.docsUrl,
  };
}
