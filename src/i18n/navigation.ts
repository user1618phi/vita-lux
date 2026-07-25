import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Локале-осведомлённые Link / redirect / хуки навигации.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
