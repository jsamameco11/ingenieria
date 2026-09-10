import type { UsageEvent, UserProfile } from "../auth/types";
import { extractFromEvent, extractFromProfile } from "./extract";
import { extractionDebugEnabled, pushDebugFrame } from "./debug";
import { recordWorkRole, submitExtraction } from "./client";
import type { ExtractionPacket } from "./types";

const lastEventKey = new Map<string, number>();

function remember(key: string, ms: number): boolean {
  const now = Date.now();
  const prev = lastEventKey.get(key) || 0;
  if (now - prev < ms) return false;
  lastEventKey.set(key, now);
  return true;
}

async function send(packet: ExtractionPacket): Promise<Record<string, unknown> | null> {
  if (!packet.answers.length && !packet.evidence.length) return null;
  try {
    const result = await submitExtraction(packet);
    if (extractionDebugEnabled()) {
      pushDebugFrame({
        at: new Date().toISOString(),
        input: packet.debug.input,
        normalized: packet.debug.normalized,
        extracted: packet.debug.extracted,
        matched: packet.debug.matched,
        confidence: packet.debug.confidence,
        evidence: packet.evidence,
        signals: packet.debug.signals,
        result,
      });
    }
    return result;
  } catch (err) {
    if (extractionDebugEnabled()) {
      pushDebugFrame({
        at: new Date().toISOString(),
        input: packet.debug.input,
        normalized: packet.debug.normalized,
        extracted: packet.debug.extracted,
        matched: packet.debug.matched,
        confidence: packet.debug.confidence,
        evidence: packet.evidence,
        signals: packet.debug.signals,
        result: { error: err instanceof Error ? err.message : "fallo" },
      });
    }
    return null;
  }
}

export async function ingestOnboarding(profile: UserProfile): Promise<void> {
  if (!profile.user_id) return;
  const packet = extractFromProfile(profile);
  await send(packet);
  if (profile.workplace_role) {
    try {
      await recordWorkRole(profile.workplace_role, profile.organization);
    } catch {
      /* RPC aún no aplicada */
    }
  }
}

export async function ingestObservedEvent(ev: UsageEvent): Promise<void> {
  const packet = extractFromEvent(ev);
  if (!packet) return;
  const key = `${ev.event_type}:${ev.module_slug}:${String(ev.meta?.tool || "")}`;
  const windowMs = ev.event_type === "view_module" ? 6 * 3600 * 1000 : 30 * 60 * 1000;
  if (!remember(key, windowMs)) return;
  await send(packet);
}
