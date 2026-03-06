"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UtensilsCrossed, BarChart3, Activity, Settings, Home } from "lucide-react";

const tabs = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/food", label: "Food Log", icon: UtensilsCrossed },
  { href: "/metrics", label: "Fitness", icon: BarChart3 },
  { href: "/body", label: "Body", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function TabNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border">
      <div className="max-w-2xl mx-auto flex">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors relative ${
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
              )}
              <tab.icon className={`h-5 w-5 ${isActive ? "stroke-[2.5]" : ""}`} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
