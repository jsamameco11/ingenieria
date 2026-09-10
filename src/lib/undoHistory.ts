import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sameState<T>(a: T, b: T): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

type Options = {
  max?: number;
  debounceMs?: number;
  onRestore?: () => void;
};

export function useUndoableState<T>(initial: T | (() => T), options?: Options) {
  const max = options?.max ?? 40;
  const debounceMs = options?.debounceMs ?? 450;
  const onRestoreRef = useRef(options?.onRestore);
  onRestoreRef.current = options?.onRestore;
  const [state, setStateRaw] = useState(initial);
  const [flags, setFlags] = useState({ canUndo: false, canRedo: false });
  const stateRef = useRef(state);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const pendingBase = useRef<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncFlags = () => {
    setFlags({
      canUndo: past.current.length > 0 || pendingBase.current !== null,
      canRedo: future.current.length > 0 && pendingBase.current === null,
    });
  };

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const base = pendingBase.current;
    if (base === null) return;
    pendingBase.current = null;
    if (!sameState(base, stateRef.current)) {
      past.current = [...past.current, base].slice(-max);
      future.current = [];
    }
  }, [max]);

  const setState = useCallback(
    (updater: SetStateAction<T>) => {
      const prev = stateRef.current;
      const next = typeof updater === "function" ? (updater as (value: T) => T)(prev) : updater;
      if (sameState(prev, next)) return;
      if (pendingBase.current === null) pendingBase.current = cloneState(prev);
      future.current = [];
      stateRef.current = next;
      setStateRaw(next);
      setFlags({ canUndo: true, canRedo: false });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        flush();
        syncFlags();
      }, debounceMs);
    },
    [debounceMs, flush],
  );

  const undo = useCallback(() => {
    if (pendingBase.current !== null) {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      const base = pendingBase.current;
      pendingBase.current = null;
      future.current = [cloneState(stateRef.current), ...future.current].slice(0, max);
      stateRef.current = base;
      setStateRaw(base);
      syncFlags();
      onRestoreRef.current?.();
      return;
    }
    const prev = past.current.pop();
    if (!prev) return;
    future.current = [cloneState(stateRef.current), ...future.current].slice(0, max);
    stateRef.current = prev;
    setStateRaw(prev);
    syncFlags();
    onRestoreRef.current?.();
  }, [max]);

  const redo = useCallback(() => {
    flush();
    const next = future.current.shift();
    if (!next) {
      syncFlags();
      return;
    }
    past.current = [...past.current, cloneState(stateRef.current)].slice(-max);
    stateRef.current = next;
    setStateRaw(next);
    syncFlags();
    onRestoreRef.current?.();
  }, [flush, max]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.isComposing) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest?.(".auth-modal, .auth-ui")) return;
      const key = e.key.toLowerCase();
      const wantRedo = key === "y" || (key === "z" && e.shiftKey);
      const wantUndo = key === "z" && !e.shiftKey;
      if (!wantUndo && !wantRedo) return;
      e.preventDefault();
      e.stopPropagation();
      if (wantUndo) undo();
      else redo();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [undo, redo]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return {
    state,
    setState,
    undo,
    redo,
    canUndo: flags.canUndo,
    canRedo: flags.canRedo,
  };
}
