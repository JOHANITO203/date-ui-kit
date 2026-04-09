const PLACEHOLDER_SRC = '/placeholder.svg';

export type ImageVariant = 'avatar' | 'card' | 'profile' | 'full';

type ImageOptions = {
  width: number;
  quality: number;
};

const VARIANT_OPTIONS: Record<ImageVariant, ImageOptions> = {
  avatar: { width: 96, quality: 72 },
  card: { width: 420, quality: 74 },
  profile: { width: 720, quality: 78 },
  full: { width: 1280, quality: 80 },
};

const clampWidth = (value: number) => Math.max(48, Math.round(value));
const clampQuality = (value: number) => Math.max(45, Math.min(90, Math.round(value)));

const isTransformableSupabaseUrl = (url: URL) =>
  url.pathname.includes('/storage/v1/object/sign/') || url.pathname.includes('/storage/v1/object/public/');

const withSupabaseTransform = (input: URL, options: ImageOptions) => {
  const url = new URL(input.toString());
  url.searchParams.set('width', String(clampWidth(options.width)));
  url.searchParams.set('quality', String(clampQuality(options.quality)));
  url.searchParams.set('format', 'webp');
  return url.toString();
};

const withUnsplashTransform = (input: URL, options: ImageOptions) => {
  const url = new URL(input.toString());
  url.searchParams.set('auto', 'format');
  url.searchParams.set('fit', 'crop');
  url.searchParams.set('w', String(clampWidth(options.width)));
  url.searchParams.set('q', String(clampQuality(options.quality)));
  return url.toString();
};

export const buildOptimizedImageUrl = (
  rawUrl: string | null | undefined,
  variant: ImageVariant,
  overrides?: Partial<ImageOptions>,
) => {
  const normalized = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (!normalized || normalized === PLACEHOLDER_SRC) return PLACEHOLDER_SRC;

  const base = VARIANT_OPTIONS[variant];
  const options: ImageOptions = {
    width: clampWidth(overrides?.width ?? base.width),
    quality: clampQuality(overrides?.quality ?? base.quality),
  };

  try {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const url = new URL(normalized, baseUrl);
    if (url.hostname.includes('images.unsplash.com')) {
      return withUnsplashTransform(url, options);
    }
    if (isTransformableSupabaseUrl(url)) {
      return withSupabaseTransform(url, options);
    }
    return normalized;
  } catch {
    return normalized;
  }
};

export const buildResponsiveImageAttrs = (
  rawUrl: string | null | undefined,
  variant: ImageVariant,
  sizes: string,
) => {
  const base = VARIANT_OPTIONS[variant];
  const src1x = buildOptimizedImageUrl(rawUrl, variant, { width: base.width });
  const src2x = buildOptimizedImageUrl(rawUrl, variant, { width: base.width * 2 });
  const srcSet = src1x === PLACEHOLDER_SRC ? undefined : `${src1x} 1x, ${src2x} 2x`;

  return {
    src: src1x,
    srcSet,
    sizes,
  };
};
