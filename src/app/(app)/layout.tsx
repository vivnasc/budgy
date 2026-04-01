"use client";

import { FeedbackButton } from "@/components/shared/feedback-button";
import { BottomNav } from "@/components/bottom-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      <main className="max-w-5xl mx-auto">{children}</main>
      <FeedbackButton appName="BUDGY" appColor="#10B981" />
      <BottomNav />
    </div>
  );
}
