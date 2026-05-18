"use client";

import { ReactNode } from "react";
import { createPortal } from "react-dom";

export function BodyPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(children, document.body);
}
