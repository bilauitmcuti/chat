interface ZarazClient {
  track: (
    eventName: string,
    eventProperties?: Record<string, unknown>
  ) => Promise<void>;
  set?: (
    key: string,
    value: unknown,
    options?: { scope?: string }
  ) => Promise<void>;
}

interface Window {
  zaraz?: ZarazClient;
}
