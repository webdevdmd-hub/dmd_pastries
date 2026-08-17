"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type JSX,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { ApiError } from "@/lib/api/client";

/**
 * Connectivity for the Counter register. Plan item E5; design in
 * docs/design/preview-states.html.
 *
 * The stated failure this exists to prevent: "a cashier who does not know the till
 * is offline will keep ringing sales." There was no offline handling in the app at
 * all before this — the plan's claim that 25 files already referenced
 * onLine/offline was wrong; the real count was zero.
 *
 * TWO SIGNALS, BECAUSE navigator.onLine IS NOT ENOUGH
 *
 * `navigator.onLine` is true whenever any network interface is up. On bakery wifi
 * the common failure is the router or the uplink dying while the access point
 * keeps serving DHCP — so the browser reports online, the banner stays hidden, and
 * every charge fails. Relying on it alone would miss the exact case this is for.
 *
 * So reachability is tracked separately, from real traffic:
 *
 *   browserOffline  navigator.onLine === false. A definite negative, instant.
 *   unreachable     a real request failed with a network-class error (fetch threw
 *                   rather than returning a status). Set by evidence, cleared by
 *                   the next successful request.
 *
 * WHY NOT A HEALTH PROBE
 *
 * Two reasons. E5 is presentation-only, and the only health route the backend
 * exposes is `/api/v1/system/api-routes` behind `settings.view` — a permission a
 * cashier does not have, so it cannot be probed from a till session. Adding
 * `/healthz` is a backend contract change and belongs in its own decision.
 *
 * More importantly a probe would be *worse*: it can succeed while the endpoint
 * that actually matters fails, which produces confident green while charges break.
 * Driving off real traffic means the first failed request is the signal, which is
 * both earlier and truthful.
 *
 * The tradeoff, stated plainly: with wifi up and the server dead, the till only
 * learns it is unreachable once *something* has failed. Usually that is a
 * background query, so the bar appears before the cashier reaches Charge. In the
 * worst case the first failure IS the charge — which is exactly why C0.7's failed
 * charge state has to say "No payment was taken" and why Charge disables
 * afterwards rather than letting a second attempt through.
 */
type ConnectivityState = {
  /** True when the till should not be taking payment. */
  isOffline: boolean;
  /** Why, so the UI can say the accurate thing rather than a generic "offline". */
  reason: "browser-offline" | "server-unreachable" | null;
  /** Manual retry. Refetches active queries; a success clears the state. */
  recheck: () => void;
  isRechecking: boolean;
};

const ConnectivityContext = createContext<ConnectivityState | null>(null);

/**
 * A network-class failure, as opposed to a server that answered with an error.
 *
 * `ApiError` means the request reached the server and came back with a status, so
 * the connection is fine and this is not our concern. A thrown `TypeError` is what
 * `fetch` produces when it cannot complete the request at all. Message matching
 * covers the engine differences: Chrome "Failed to fetch", Firefox
 * "NetworkError when attempting to fetch resource", Safari "Load failed".
 */
function isNetworkError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return false;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    error instanceof TypeError ||
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("load failed") ||
    message.includes("network request failed")
  );
}

export function ConnectivityProvider({ children }: Readonly<{ children: ReactNode }>): JSX.Element {
  const queryClient = useQueryClient();
  // Start optimistic. Rendering an offline bar during hydration, before anything
  // has been tried, would cry wolf on every page load.
  const [browserOffline, setBrowserOffline] = useState(false);
  const [unreachable, setUnreachable] = useState(false);
  const [isRechecking, setIsRechecking] = useState(false);

  useEffect(() => {
    const sync = (): void => {
      setBrowserOffline(!navigator.onLine);
    };

    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);

    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  // Watch real traffic. Every query and mutation the app already makes is a
  // reachability test we do not have to pay for.
  useEffect(() => {
    const queryCache = queryClient.getQueryCache();
    const mutationCache = queryClient.getMutationCache();

    const handle = (status: unknown, error: unknown): void => {
      if (status === "error" && isNetworkError(error)) {
        setUnreachable(true);
        return;
      }

      // Any completed round trip proves the server is reachable, including one
      // that answered 4xx or 5xx — the connection worked.
      if (status === "success" || (status === "error" && error instanceof ApiError)) {
        setUnreachable(false);
      }
    };

    const unsubscribeQueries = queryCache.subscribe((event) => {
      if (event.type === "updated") {
        handle(event.query.state.status, event.query.state.error);
      }
    });

    const unsubscribeMutations = mutationCache.subscribe((event) => {
      if (event.type === "updated") {
        handle(event.mutation.state.status, event.mutation.state.error);
      }
    });

    return () => {
      unsubscribeQueries();
      unsubscribeMutations();
    };
  }, [queryClient]);

  const recheck = useCallback(() => {
    setIsRechecking(true);
    void queryClient.refetchQueries({ type: "active" }).finally(() => {
      setIsRechecking(false);
    });
  }, [queryClient]);

  const value = useMemo<ConnectivityState>(
    () => ({
      isOffline: browserOffline || unreachable,
      isRechecking,
      reason: browserOffline ? "browser-offline" : unreachable ? "server-unreachable" : null,
      recheck,
    }),
    [browserOffline, isRechecking, recheck, unreachable],
  );

  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
}

/**
 * Read connectivity. Returns a safe default outside a provider so a Ledger route
 * that has not adopted E5 yet renders normally rather than throwing.
 */
export function useConnectivity(): ConnectivityState {
  return (
    useContext(ConnectivityContext) ?? {
      isOffline: false,
      isRechecking: false,
      reason: null,
      recheck: () => undefined,
    }
  );
}
