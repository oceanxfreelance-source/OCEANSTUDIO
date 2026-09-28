/** Run one delivery-expiration sweep manually (idempotent). */
import { db } from "@/lib/db";
import { runDeliveryCleanup } from "@/server/cleanup";

runDeliveryCleanup(500)
  .then((r) => console.log(JSON.stringify(r, null, 2)))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
