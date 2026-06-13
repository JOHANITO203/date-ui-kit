import { env } from "../config/env";

type UploadResult = { path: string };

const getS3Client = async () => {
  if (!env.hasS3) throw new Error("S3_NOT_CONFIGURED");
  const { S3Client } = await import("@aws-sdk/client-s3");
  return new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT || undefined,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: Boolean(env.S3_ENDPOINT),
  });
};

export const uploadToPrivateBucket = async (
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<UploadResult> => {
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const s3 = await getS3Client();
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET_PRIVATE,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
  return { path: key };
};

export const uploadToPublicBucket = async (
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<UploadResult> => {
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const s3 = await getS3Client();
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET_PUBLIC,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return { path: key };
};

export const deleteFromPrivateBucket = async (keys: string[]): Promise<void> => {
  if (keys.length === 0) return;
  const { DeleteObjectsCommand } = await import("@aws-sdk/client-s3");
  const s3 = await getS3Client();
  await s3.send(
    new DeleteObjectsCommand({
      Bucket: env.S3_BUCKET_PRIVATE,
      Delete: { Objects: keys.map((k) => ({ Key: k })) },
    }),
  );
};

export const deleteFromPublicBucket = async (keys: string[]): Promise<void> => {
  if (keys.length === 0) return;
  const { DeleteObjectsCommand } = await import("@aws-sdk/client-s3");
  const s3 = await getS3Client();
  await s3.send(
    new DeleteObjectsCommand({
      Bucket: env.S3_BUCKET_PUBLIC,
      Delete: { Objects: keys.map((k) => ({ Key: k })) },
    }),
  );
};

export const downloadFromPrivateBucket = async (key: string): Promise<Buffer> => {
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const s3 = await getS3Client();
  const response = await s3.send(
    new GetObjectCommand({ Bucket: env.S3_BUCKET_PRIVATE, Key: key }),
  );
  const stream = response.Body;
  if (!stream) throw new Error("S3_EMPTY_BODY");
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

export const createSignedUrls = async (
  keys: string[],
  ttlSeconds: number,
): Promise<Map<string, string>> => {
  const out = new Map<string, string>();
  if (keys.length === 0) return out;
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const s3 = await getS3Client();
  await Promise.all(
    keys.map(async (key) => {
      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: env.S3_BUCKET_PRIVATE, Key: key }),
        { expiresIn: ttlSeconds },
      );
      out.set(key, url);
    }),
  );
  return out;
};

export const buildPublicUrl = (key: string, versionMs?: number): string => {
  const base = `${env.S3_PUBLIC_URL}/${key}`;
  return versionMs ? `${base}?v=${versionMs}` : base;
};
