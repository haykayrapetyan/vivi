import "server-only";

/** Sanitizes an app-generated object key (defence-in-depth against traversal). */
export function sanitizeKey(key: string): string {
  return key.replace(/\.\.+/g, "").replace(/^\/+/, "");
}

/* --------------------------------- R2 ---------------------------------- */
// Cloudflare R2 (S3-compatible) is the only storage backend.

type S3Module = typeof import("@aws-sdk/client-s3");

let cachedClient: import("@aws-sdk/client-s3").S3Client | null = null;
let cachedModule: S3Module | null = null;

async function r2() {
  if (!cachedModule) cachedModule = await import("@aws-sdk/client-s3");
  if (!cachedClient) {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "R2 storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET in .env.local.",
      );
    }
    cachedClient = new cachedModule.S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error("R2_BUCKET is not set");
  return { mod: cachedModule, client: cachedClient, bucket };
}

/* ------------------------------- public -------------------------------- */

/** Generic R2 object write (videos, logos, …). */
export async function saveObject(
  key: string,
  data: Buffer,
  contentType: string,
): Promise<string> {
  const { mod, client, bucket } = await r2();
  await client.send(
    new mod.PutObjectCommand({
      Bucket: bucket,
      Key: sanitizeKey(key),
      Body: data,
      ContentType: contentType,
    }),
  );
  return key;
}

export async function saveVideo(
  key: string,
  data: Buffer,
  contentType = "video/webm",
): Promise<string> {
  return saveObject(key, data, contentType);
}

export async function readVideo(key: string): Promise<Buffer> {
  const { mod, client, bucket } = await r2();
  const res = await client.send(
    new mod.GetObjectCommand({ Bucket: bucket, Key: sanitizeKey(key) }),
  );
  const bytes = await res.Body!.transformToByteArray();
  return Buffer.from(bytes);
}

export async function videoSize(key: string): Promise<number> {
  const { mod, client, bucket } = await r2();
  const res = await client.send(
    new mod.HeadObjectCommand({ Bucket: bucket, Key: sanitizeKey(key) }),
  );
  return res.ContentLength ?? 0;
}

/** A short-lived signed GET URL so the browser streams directly from R2. */
export async function getReadUrl(key: string): Promise<string> {
  const { mod, client, bucket } = await r2();
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  return getSignedUrl(
    client,
    new mod.GetObjectCommand({ Bucket: bucket, Key: sanitizeKey(key) }),
    { expiresIn: 60 * 60 },
  );
}
