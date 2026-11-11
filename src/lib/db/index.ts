import "server-only";

import {
  dataDir,
  dataMode,
  publicEnv,
  serverEnv,
  supabaseEnv,
} from "@/lib/env";
import { AppwriteStore } from "./appwrite-store";
import { CachedStore } from "./cached-store";
import { MemoryStore } from "./memory-store";
import { SupabaseStore } from "./supabase-store";
import type { Store } from "./store";

const globalRef = globalThis as unknown as { __wellmixStore?: Store };

/** Store único por processo (o dev server do Next recarrega módulos; o global evita reabrir). */
export function getStore(): Store {
  if (globalRef.__wellmixStore) return globalRef.__wellmixStore;
  const mode = dataMode();
  if (mode === "appwrite") {
    const env = serverEnv();
    if (!publicEnv || !env.success) {
      throw new Error(
        "DATA_MODE=appwrite exige NEXT_PUBLIC_APPWRITE_* e APPWRITE_API_KEY.",
      );
    }
    globalRef.__wellmixStore = new CachedStore(
      new AppwriteStore(
        publicEnv.NEXT_PUBLIC_APPWRITE_ENDPOINT,
        publicEnv.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
        env.data.APPWRITE_API_KEY,
      ),
    );
  } else if (mode === "supabase") {
    const env = supabaseEnv();
    if (!env)
      throw new Error(
        "DATA_MODE=supabase exige SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.",
      );
    globalRef.__wellmixStore = new CachedStore(
      new SupabaseStore(env.url, env.key),
    );
  } else {
    globalRef.__wellmixStore = new CachedStore(new MemoryStore(dataDir()));
  }
  return globalRef.__wellmixStore;
}

export type { Store } from "./store";
export * from "./schema";
