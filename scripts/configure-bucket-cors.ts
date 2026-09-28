/**
 * Apply the CORS rules browsers need for direct multipart uploads (PUT with
 * ETag exposed) and signed GET previews. The bucket must stay PRIVATE.
 *   npm run storage:cors
 */
import { PutBucketCorsCommand, S3Client, CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";

async function main() {
  const e = env();
  const client = new S3Client({
    region: e.STORAGE_REGION,
    endpoint: e.STORAGE_ENDPOINT,
    forcePathStyle: e.STORAGE_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId: e.STORAGE_ACCESS_KEY, secretAccessKey: e.STORAGE_SECRET_KEY },
  });
  if (process.argv.includes("--create")) {
    try {
      await client.send(new HeadBucketCommand({ Bucket: e.STORAGE_BUCKET }));
    } catch {
      await client.send(new CreateBucketCommand({ Bucket: e.STORAGE_BUCKET }));
      console.log(`Created bucket ${e.STORAGE_BUCKET}`);
    }
  }
  await client.send(
    new PutBucketCorsCommand({
      Bucket: e.STORAGE_BUCKET,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: [new URL(e.APP_URL).origin],
            AllowedMethods: ["PUT", "GET", "HEAD"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );
  console.log(`CORS configured for ${e.STORAGE_BUCKET} (origin ${new URL(e.APP_URL).origin})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
