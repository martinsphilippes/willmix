import "server-only";

import { dataDir, dataMode, publicEnv, serverEnv } from "@/lib/env";
import { AppwriteStore } from "./appwrite-store";
import { MemoryStore } from "./memory-store";
import type { Store } from "./store";

const globalRef = globalThis as unknown as { __willmixStore?: Store };

/** Store único por processo (o dev server do Next recarrega módulos; o global evita reabrir). */
export function getStore(): Store {
  if (globalRef.__willmixStore) return globalRef.__willmixStore;
  const mode = dataMode();
  if (mode === "appwrite") {
    const env = serverEnv();
    if (!publicEnv || !env.success) {
      throw new Error("DATA_MODE=appwrite exige NEXT_PUBLIC_APPWRITE_* e APPWRITE_API_KEY.");
    }
    globalRef.__willmixStore = new AppwriteStore(
      publicEnv.NEXT_PUBLIC_APPWRITE_ENDPOINT,
      publicEnv.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
      env.data.APPWRITE_API_KEY,
    );
  } else {
    globalRef.__willmixStore = new MemoryStore(dataDir());
  }
  return globalRef.__willmixStore;
}

export type { Store } from "./store";
export * from "./schema";
