"use client";

import { FeedbackButton } from "@/components/shared/feedback-button";
import { BottomNav } from "@/components/bottom-nav";
import { Sidebar } from "@/components/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      {/* Desktop sidebar — hidden on mobile */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <Sidebar />
      </aside>

      {/* Main content — offset on desktop, bottom padding for mobile nav */}
      <main className="pb-20 lg:pb-0 lg:pl-64">
        <div className="mx-auto max-w-5xl px-4 lg:px-8 py-4">
          {children}
        </div>
      </main>

      <FeedbackButton appName="BUDGY" appColor="#10B981" />

      {/* Mobile bottom nav — hidden on desktop */}
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
