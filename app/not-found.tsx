import type { Metadata } from "next";
import { MapPinOff } from "lucide-react";

import { StatusScreen } from "@/components/layout/status-screen";

export const metadata: Metadata = { title: "Page nahi mila" };

export default function NotFound() {
  return (
    <StatusScreen
      icon={MapPinOff}
      code="404"
      title="Ye page nahi mila"
      description="Link purana ho sakta hai, ya address me kuch typo. Dono me se koi bhi ho, yahan kuch nahi hai."
      action={{ href: "/app/dashboard", label: "Dashboard par jaayein" }}
      secondary={{ href: "/", label: "Home" }}
    />
  );
}
