"use client";
import { useEffect } from "react";

export function LeaderboardScroller() {
  useEffect(() => {
    const el = document.getElementById("me-row");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);
  return null;
}
