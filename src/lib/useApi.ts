"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

/**
 * Minimal data hook: fetch on mount (and whenever `path` changes), expose a
 * `reload` so an action can refresh the screen it just changed.
 */
export function useApi<T>(path: string | null, { pollMs }: { pollMs?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(Boolean(path));

  const load = useCallback(
    async (quiet = false) => {
      if (!path) return;
      if (!quiet) setLoading(true);
      try {
        setData(await api<T>(path));
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load this.");
      } finally {
        setLoading(false);
      }
    },
    [path],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!pollMs || !path) return;
    const id = setInterval(() => load(true), pollMs);
    return () => clearInterval(id);
  }, [pollMs, path, load]);

  return { data, error, loading, reload: () => load(true) };
}
