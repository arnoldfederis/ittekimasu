import { onlineManager } from "@tanstack/react-query";
import * as Network from "expo-network";
import { useSyncExternalStore } from "react";

/**
 * Whether the device can actually reach the internet.
 *
 * `isInternetReachable` is the honest answer and `isConnected` is only "a network exists" —
 * an aeroplane's wifi, a captive portal or a hotel splash page all report connected while
 * nothing gets through. Undefined means the platform has not decided yet, and treating that
 * as offline would flash the banner on every cold start.
 */
function isReachable(state: Network.NetworkState): boolean {
  return state.isInternetReachable ?? state.isConnected ?? true;
}

/**
 * The probe target, and why this file reads the env var instead of importing BASE_URL from
 * `api/client.ts`: the client imports THIS module to report failures, so importing back
 * would be a cycle.
 *
 * `/users/me` unauthenticated answers 401, and a 401 is proof the server is reachable —
 * which is all the probe is asking. There is no cheaper endpoint and adding one would be a
 * public route for the sake of a ping.
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api";
const PROBE_URL = `${BASE_URL}/users/me`;
const PROBE_INTERVAL = 5_000;

let probeTimer: ReturnType<typeof setInterval> | null = null;

/**
 * A request that never reached the server is GROUND TRUTH, and it outranks the platform's
 * opinion.
 *
 * `expo-network` reports reachable in cases where nothing actually gets through: the iOS
 * Simulator with the host's wifi off, captive portals, hotel splash pages, plane wifi. The
 * app claimed to handle those and did not — it asked a signal that lies about exactly them.
 * A failed fetch does not lie.
 */
export function reportTransportFailure(): void {
  if (!onlineManager.isOnline()) return;

  onlineManager.setOnline(false);
  startProbing();
}

/** Any answer from the server, including a 401, means we are back. */
export function reportTransportSuccess(): void {
  stopProbing();
  if (!onlineManager.isOnline()) {
    onlineManager.setOnline(true);
  }
}

/**
 * While offline, ask the server every few seconds whether it is there yet.
 *
 * Needed because React Query PAUSES its queries when offline: with nothing firing, a failed
 * request can never prove the connection is back, and the app would sit in offline mode
 * until something else happened to trigger a fetch.
 */
function startProbing(): void {
  if (probeTimer) return;

  probeTimer = setInterval(async () => {
    try {
      await fetch(PROBE_URL, { method: "GET" });
      reportTransportSuccess();
    } catch {
      // Still down. The interval keeps asking.
    }
  }, PROBE_INTERVAL);
}

function stopProbing(): void {
  if (!probeTimer) return;
  clearInterval(probeTimer);
  probeTimer = null;
}

/**
 * Teaches React Query what "offline" means on a phone.
 *
 * Without this the online manager assumes the app is always online: queries fire into a
 * dead socket and surface as "The internet connection appears to be offline", and mutations
 * fail outright instead of pausing until there is a connection to replay them over.
 *
 * The platform signal is the fast half — it flips the moment the OS notices — and
 * `reportTransportFailure` is the truthful half, for everything the OS gets wrong.
 */
export function startNetworkSync(): () => void {
  onlineManager.setEventListener((setOnline) => {
    Network.getNetworkStateAsync()
      .then((state) => setOnline(isReachable(state)))
      // A platform that will not answer is not evidence of being offline.
      .catch(() => setOnline(true));

    const subscription = Network.addNetworkStateListener((state) => {
      // Only ever used to go OFFLINE, or to come back when the probe agrees. Letting the
      // platform declare us online would undo a failure we just proved by trying.
      if (!isReachable(state)) {
        setOnline(false);
        startProbing();
      }
    });

    return () => {
      subscription.remove();
      stopProbing();
    };
  });

  return () => onlineManager.setEventListener(() => () => undefined);
}

/** Subscribes to the same signal the query cache uses, so the two can never disagree. */
export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (callback) => onlineManager.subscribe(callback),
    () => onlineManager.isOnline(),
    () => true,
  );
}
