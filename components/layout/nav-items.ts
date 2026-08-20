import { CalendarDays, Heart, History, Home, Settings } from "lucide-react";

/** Primary navigation, shared by the phone bottom bar and the desktop header. */
export const NAV_ITEMS = [
  { href: "/app/dashboard", label: "Home", icon: Home },
  { href: "/app/history", label: "History", icon: History },
  { href: "/app/partner", label: "Partner", icon: Heart },
  { href: "/app/leave", label: "Leave", icon: CalendarDays },
  { href: "/app/settings", label: "Settings", icon: Settings },
] as const;

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
