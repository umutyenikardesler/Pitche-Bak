import { supabase } from "@/services/supabase";
import Constants from "expo-constants";

type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

type AnalyticsEventName =
  | "app_open"
  | "screen_view"
  | "sign_in"
  | "sign_out"
  | "sign_up"
  | "create_match"
  | "message_send"
  | "error";

type AnalyticsContext = {
  language?: string | null;
  locale?: string | null;
  platform?: string | null;
  appVersion?: string | null;
};

let initialized = false;
let deviceId: string | null = null;
let sessionId: string | null = null;
let userId: string | null = null;
let ctx: AnalyticsContext = {};
let traits: Record<string, Json> = {};

const isBrowser = typeof window !== "undefined" && typeof window.localStorage !== "undefined";

function uuidV4Fallback() {
  // RFC4122-ish fallback (good enough for client ids)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getAppVersion(): string | null {
  const v = (Constants.expoConfig as any)?.version ?? (Constants.manifest as any)?.version ?? null;
  return typeof v === "string" ? v : null;
}

function getPlatform(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Platform } = require("react-native");
    return Platform?.OS ?? null;
  } catch {
    return isBrowser ? "web" : null;
  }
}

function getLocale(): string | null {
  try {
    const loc = Intl.DateTimeFormat().resolvedOptions().locale;
    return typeof loc === "string" ? loc : null;
  } catch {
    return null;
  }
}

async function getStorage() {
  if (isBrowser) return window.localStorage;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Platform } = require("react-native");
    if (Platform?.OS && Platform.OS !== "web") {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require("@react-native-async-storage/async-storage");
      return mod?.default ?? mod;
    }
  } catch {
    // ignore
  }
  return null;
}

async function getOrCreateDeviceId() {
  if (deviceId) return deviceId;
  const storage = await getStorage();
  const key = "analytics_device_id";
  if (storage?.getItem) {
    const existing = await storage.getItem(key);
    if (existing) {
      deviceId = existing;
      return deviceId;
    }
  }
  const newId = (globalThis as any)?.crypto?.randomUUID?.() ?? uuidV4Fallback();
  deviceId = newId;
  if (storage?.setItem) await storage.setItem(key, newId);
  return deviceId;
}

async function getOrCreateSessionId() {
  if (sessionId) return sessionId;
  const newId = (globalThis as any)?.crypto?.randomUUID?.() ?? uuidV4Fallback();
  sessionId = newId;
  return sessionId;
}

export async function analyticsInit() {
  if (initialized) return;
  initialized = true;

  ctx = {
    language: ctx.language ?? null,
    locale: ctx.locale ?? getLocale(),
    platform: ctx.platform ?? getPlatform(),
    appVersion: ctx.appVersion ?? getAppVersion(),
  };

  await getOrCreateDeviceId();
  await getOrCreateSessionId();
}

export function analyticsSetUser(id: string | null) {
  userId = id;
}

export function analyticsSetContext(next: Partial<AnalyticsContext>) {
  ctx = { ...ctx, ...next };
}

export function analyticsSetTraits(next: Record<string, Json>) {
  traits = { ...traits, ...next };
}

export async function analyticsTrack(eventName: AnalyticsEventName, props: Record<string, Json> = {}) {
  await analyticsInit();

  const payload: any = {
    action: eventName,
    user_id: userId,
    device_id: deviceId,
    session_id: sessionId,
    platform: ctx.platform,
    app_version: ctx.appVersion,
    locale: ctx.locale,
    language: ctx.language,
    meta: { ...traits, ...props },
  };

  // Optional convenience field for screen views
  if (eventName === "screen_view" && typeof props.screen === "string") {
    payload.screen = props.screen;
  }

  try {
    const { error } = await supabase.from("activity_logs").insert(payload);
    if (error) {
      // Analytics must never crash the app.
      console.log("[Analytics] insert error:", error.message);
    }
  } catch (e: any) {
    console.log("[Analytics] unexpected error:", e?.message ?? String(e));
  }
}

