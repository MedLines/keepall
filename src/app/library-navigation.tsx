"use client";

import {
  createContext,
  useContext,
  type ReactNode,
  type RefObject,
} from "react";

const LibraryNavigationGenerationContext = createContext(0);
const LibraryNavigationGenerationRefContext =
  createContext<RefObject<number> | null>(null);

type ProviderProps = {
  generation: number;
  generationRef: RefObject<number>;
  children: ReactNode;
};

export function LibraryNavigationProvider({
  generation,
  generationRef,
  children,
}: ProviderProps) {
  return (
    <LibraryNavigationGenerationRefContext.Provider value={generationRef}>
      <LibraryNavigationGenerationContext.Provider value={generation}>
        {children}
      </LibraryNavigationGenerationContext.Provider>
    </LibraryNavigationGenerationRefContext.Provider>
  );
}

export function useLibraryNavigationGeneration(): number {
  return useContext(LibraryNavigationGenerationContext);
}

export function useLibraryNavigationGenerationRef(): RefObject<number> | null {
  return useContext(LibraryNavigationGenerationRefContext);
}

/** True when navigation moved on since `captured` was read (async work should bail). */
export function isLibraryNavigationStale(
  generationRef: RefObject<number>,
  captured: number,
): boolean {
  return generationRef.current !== captured;
}
