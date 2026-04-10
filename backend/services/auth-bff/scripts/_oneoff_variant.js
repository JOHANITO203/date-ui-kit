import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const url = 'https://easlgfxfctpiyghluvcc.supabase.co';
const service = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhc2xnZnhmY3RwaXlnaGx1dmNjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTUwODI1MCwiZXhwIjoyMDkxMDg0MjUwfQ.YQChEGEoF9bxYH_-5YTxT0HL91CKcb4gOS5BIVHuqJg';
const supa = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
const sourceBucket = 'profile-photos';
const publicBucket = 'profile-photos-public';
const storagePath = '962a08ca-89f6-4245-8879-2aaef4c2fe29/1775527471686-d94a3825-6f42-4532-b388-f208362e6b92.jpg';
const presets = {
  card: { width: 720, height: 960, fit: 'inside', quality: 76 },
  avatar: { width: 256, height: 256, fit: 'cover', quality: 72 },
  profile: { width: 1080, height: 1440, fit: 'inside', quality: 78 },
};

const toVariantPath = (variant) => {
  const clean = storagePath.replace(/^\/+/, '');
  const withoutExt = clean.replace(/\.[^/.]+$/, '');
  return `variants/${variant}/${withoutExt}.jpg`;
};

const download = await supa.storage.from(sourceBucket).download(storagePath);
if (download.error) {
  console.error(download.error);
  process.exit(1);
}
const buf = Buffer.from(await download.data.arrayBuffer());

for (const [variant, preset] of Object.entries(presets)) {
  const optimized = await sharp(buf, { failOnError: false })
    .rotate()
    .resize({ width: preset.width, height: preset.height, fit: preset.fit, withoutEnlargement: true })
    .jpeg({ quality: preset.quality, mozjpeg: true })
    .toBuffer();
  const variantPath = toVariantPath(variant);
  const up = await supa.storage.from(publicBucket).upload(variantPath, optimized, {
    contentType: 'image/jpeg',
    cacheControl: 'public, max-age=31536000, immutable',
    upsert: true,
  });
  if (up.error) {
    console.error(variant, up.error);
  } else {
    console.log('uploaded', variantPath, optimized.length);
  }
}
