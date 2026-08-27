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
 * Teaches React Query what "offline" means on a phone.
 *
 * Without this the online manager assumes the app is always online: queries fire into a
 * dead socket and surface as "The internet connection appears to be offline", and mutations
 * fail outright instead of pausing until there is a connection to replay them over.
 */
export function startNetworkSync(): () => void {
  onlineManager.setEventListener((setOnline) => {
    Network.getNetworkStateAsync()
      .then((state) => setOnline(isReachable(state)))
      // A platform that will not answer is not evidence of being offline.
      .catch(() => setOnline(true));

    const subscription = Network.addNetworkStateListener((state) => {
      setOnline(isReachable(state));
    });

    return () => subscription.remove();
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
