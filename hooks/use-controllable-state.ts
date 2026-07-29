"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseControllableStateParams<T> {
  prop?: T | undefined;
  defaultProp?: T | undefined;
  onChange?: ((state: T) => void) | undefined;
}

type SetStateFn<T> = (prevState: T) => T;

/**
 * Controlled/uncontrolled state helper (Radix-compatible API).
 * When `prop` is defined the value is controlled; otherwise it uses internal state.
 */
export function useControllableState<T>({
  prop,
  defaultProp,
  onChange = () => {},
}: UseControllableStateParams<T>): readonly [T, (next: T | SetStateFn<T>) => void] {
  const [uncontrolledProp, setUncontrolledProp] = useState(defaultProp as T);
  const isControlled = prop !== undefined;
  const value = (isControlled ? prop : uncontrolledProp) as T;
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const setValue = useCallback(
    (nextValue: T | SetStateFn<T>) => {
      const next =
        typeof nextValue === "function"
          ? (nextValue as SetStateFn<T>)(value)
          : nextValue;

      if (!Object.is(value, next)) {
        if (!isControlled) setUncontrolledProp(next);
        onChangeRef.current(next);
      }
    },
    [isControlled, value]
  );

  return [value, setValue] as const;
}
