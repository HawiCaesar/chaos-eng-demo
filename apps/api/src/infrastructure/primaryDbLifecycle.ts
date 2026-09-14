import { env } from "../env.js";
import { railwayClient } from "../railway.js";

/** Same Railway call as POST /infrastructure/primary-db/stop */
export const stopPrimaryDatabase = async (): Promise<void> => {
  await railwayClient.stopService(env.RAILWAY_PRIMARY_DB_SERVICE_ID);
};

/** Same Railway call as POST /infrastructure/primary-db/restart */
export const restartPrimaryDatabase = async (): Promise<void> => {
  await railwayClient.restartService(env.RAILWAY_PRIMARY_DB_SERVICE_ID);
};
