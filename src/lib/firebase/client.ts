"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";
import {
  connectStorageEmulator,
  getStorage,
  type FirebaseStorage,
} from "firebase/storage";
import { publicEnv, useEmulators } from "@/lib/env";

/**
 * SDK Web do Firebase, inicializado uma única vez no browser.
 * Lança erro claro se as variáveis NEXT_PUBLIC_FIREBASE_* não estiverem definidas.
 */
export function getFirebaseApp(): FirebaseApp {
  if (!publicEnv) {
    throw new Error(
      "Firebase não configurado: defina as variáveis NEXT_PUBLIC_FIREBASE_* (veja .env.example).",
    );
  }
  if (getApps().length) return getApp();

  const app = initializeApp({
    apiKey: publicEnv.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: publicEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: publicEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: publicEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: publicEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: publicEnv.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: publicEnv.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  });

  if (useEmulators) {
    connectAuthEmulator(getAuth(app), "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
    connectFirestoreEmulator(getFirestore(app), "127.0.0.1", 8080);
    connectStorageEmulator(getStorage(app), "127.0.0.1", 9199);
  }

  return app;
}

export function firebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export function firestore(): Firestore {
  return getFirestore(getFirebaseApp());
}

export function firebaseStorage(): FirebaseStorage {
  return getStorage(getFirebaseApp());
}

/** Analytics só existe no browser e só quando suportado (não em SSR/iframes). */
export async function firebaseAnalytics() {
  if (typeof window === "undefined") return null;
  const { getAnalytics, isSupported } = await import("firebase/analytics");
  return (await isSupported()) ? getAnalytics(getFirebaseApp()) : null;
}
