import type {
  ApiMonitorEvent,
  ApiMonitorRecordInput,
  ApiMonitorStatus,
  ApiRouteCatalogItem,
} from "@/types/api-monitor";

const maxEvents = 200;
const slowThresholdMs = 1_000;
const channelName = "pastries-pos-api-monitor";

type ApiMonitorListener = () => void;
type ChannelMessage =
  | {
      event: ApiMonitorEvent;
      type: "event";
    }
  | {
      type: "clear";
    };

let events: ApiMonitorEvent[] = [];
let catalog: ApiRouteCatalogItem[] = [];
let channel: BroadcastChannel | null = null;
let channelInitialized = false;

const listeners = new Set<ApiMonitorListener>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

function hasBroadcastChannel(): boolean {
  return typeof window !== "undefined" && "BroadcastChannel" in window;
}

function ensureChannel(): BroadcastChannel | null {
  if (!hasBroadcastChannel()) {
    return null;
  }

  channel ??= new BroadcastChannel(channelName);

  if (!channelInitialized) {
    channel.onmessage = (message: MessageEvent<ChannelMessage>) => {
      if (message.data.type === "clear") {
        events = [];
        notify();
        return;
      }

      const channelEvent = message.data.event;
      events = [channelEvent, ...events.filter((event) => event.id !== channelEvent.id)].slice(
        0,
        maxEvents,
      );
      notify();
    };
    channelInitialized = true;
  }

  return channel;
}

function publish(message: ChannelMessage): void {
  ensureChannel()?.postMessage(message);
}

function eventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${String(Date.now())}-${Math.random().toString(36).slice(2)}`;
}

function endpointPath(endpoint: string): string {
  try {
    if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
      return new URL(endpoint).pathname;
    }
  } catch {
    return endpoint.split("?")[0] ?? endpoint;
  }

  return endpoint.split("?")[0] ?? endpoint;
}

function matchesRoute(routePath: string, concretePath: string): boolean {
  const routeSegments = routePath.split("/").filter(Boolean);
  const concreteSegments = concretePath.split("/").filter(Boolean);

  if (routeSegments.length !== concreteSegments.length) {
    return false;
  }

  return routeSegments.every((segment, index) => {
    return segment.startsWith(":") || segment === concreteSegments[index];
  });
}

function findRoute(method: string, endpoint: string): ApiRouteCatalogItem | null {
  const normalizedPath = endpointPath(endpoint);
  const upperMethod = method.toUpperCase();
  const exact = catalog.find(
    (route) => route.method.toUpperCase() === upperMethod && route.path === normalizedPath,
  );

  if (exact) {
    return exact;
  }

  return (
    catalog.find(
      (route) =>
        route.method.toUpperCase() === upperMethod && matchesRoute(route.path, normalizedPath),
    ) ?? null
  );
}

function moduleForEndpoint(endpoint: string): string {
  const path = endpointPath(endpoint);

  if (path === "/health") {
    return "System";
  }

  const [firstSegment] = path.replace(/^\/api\/v1\//, "").split("/");

  switch (firstSegment) {
    case "accounting":
      return "Accounting";
    case "activity-logs":
      return "Audit Logs";
    case "auth":
      return "Auth";
    case "bakery-orders":
      return "Bakery Orders";
    case "business":
    case "master-data":
    case "settings":
      return "Settings";
    case "inventory":
    case "stock-movements":
      return "Inventory";
    case "payments":
    case "sales-returns":
      return "Payments";
    case "permissions":
    case "roles":
    case "users":
      return "User / Role";
    case "pos":
      return "POS";
    case "products":
      return "Products";
    case "purchasing":
      return "Purchase";
    case "system":
      return "System";
    default:
      return firstSegment
        ? firstSegment
            .split("-")
            .map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
            .join(" ")
        : "System";
  }
}

function apiNameForEndpoint(method: string, endpoint: string): string {
  const path = endpointPath(endpoint);

  if (path === "/health") {
    return "Backend Health";
  }

  const label = path
    .replace(/^\/api\/v1\//, "")
    .replace(/:\w+/g, "detail")
    .replace(/[/_-]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
    .join(" ");

  return label ? `${method.toUpperCase()} ${label}` : method.toUpperCase();
}

export function classifyApiMonitorStatus(
  statusCode: number,
  responseTimeMs: number,
  success: boolean,
): ApiMonitorStatus {
  if (statusCode === 401 || statusCode === 403) {
    return "unauthorized";
  }

  if (statusCode >= 500) {
    return "server_error";
  }

  if (!success) {
    return "failed";
  }

  if (responseTimeMs > slowThresholdMs) {
    return "slow";
  }

  return "healthy";
}

export function setApiMonitorCatalog(routes: ApiRouteCatalogItem[]): void {
  catalog = routes;
}

export function recordApiMonitorEvent(input: ApiMonitorRecordInput): ApiMonitorEvent {
  const route = findRoute(input.method, input.endpoint);
  const status =
    input.status ?? classifyApiMonitorStatus(input.statusCode, input.responseTimeMs, input.success);
  const event: ApiMonitorEvent = {
    apiName: route?.apiName ?? apiNameForEndpoint(input.method, input.endpoint),
    checkedAt: input.checkedAt ?? new Date().toISOString(),
    endpoint: endpointPath(input.endpoint),
    errorMessage: input.errorMessage ?? null,
    id: eventId(),
    method: input.method.toUpperCase(),
    module: route?.module ?? moduleForEndpoint(input.endpoint),
    responseTimeMs: Math.max(0, Math.round(input.responseTimeMs)),
    routePath: route?.path ?? null,
    source: input.source,
    status,
    statusCode: input.statusCode,
    success: input.success,
  };

  events = [event, ...events].slice(0, maxEvents);
  notify();
  publish({ event, type: "event" });

  return event;
}

export function clearApiMonitorEvents(): void {
  events = [];
  notify();
  publish({ type: "clear" });
}

export function getApiMonitorSnapshot(): ApiMonitorEvent[] {
  ensureChannel();
  return events;
}

export function subscribeApiMonitor(listener: ApiMonitorListener): () => void {
  ensureChannel();
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
