"use client";

import { TabNav } from "@/components/layout/tab-nav";
import { ChatDrawer } from "@/components/input-bar/chat-drawer";

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background pb-[110px]">
      {children}
      <ChatDrawer />
      <TabNav />
    </div>
  );
}
