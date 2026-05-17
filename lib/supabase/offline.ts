"use client";

let isOffline = false;

export function setSupabaseOffline(value: boolean) {
  isOffline = value;
}

export function getSupabaseOffline() {
  return isOffline;
}
