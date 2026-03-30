"use client";

import { useState, useEffect } from "react";
import { Download, X, Wifi, WifiOff } from "lucide-react";
import { syncPendingItems, offlineStorage } from "@/lib/offline-storage";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      // Show banner after a delay (don't show immediately on load)
      setTimeout(() => setShowBanner(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Online/offline detection
    setIsOnline(navigator.onLine);
    const onOnline = () => {
      setIsOnline(true);
      // Auto-sync when back online
      handleSync();
    };
    const onOffline = () => setIsOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    // Check pending sync items
    offlineStorage.getPendingSyncItems().then((items) => {
      setPendingCount(items.length);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === "accepted") {
      setShowBanner(false);
      setInstallPrompt(null);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncPendingItems();
      setPendingCount((prev) => Math.max(0, prev - result.synced));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      {/* Offline indicator */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-500 text-white py-1.5 px-4 flex items-center justify-center gap-2 text-xs font-medium">
          <WifiOff className="w-3.5 h-3.5" />
          Sem internet — modo offline activo
          {pendingCount > 0 && (
            <span className="bg-amber-600 px-2 py-0.5 rounded-full text-[10px]">
              {pendingCount} pendente{pendingCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* Sync indicator when back online */}
      {isOnline && pendingCount > 0 && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-primary-500 text-white py-1.5 px-4 flex items-center justify-center gap-2 text-xs font-medium">
          <Wifi className="w-3.5 h-3.5" />
          {syncing ? "A sincronizar..." : `${pendingCount} transação(ões) por sincronizar`}
          {!syncing && (
            <button onClick={handleSync} className="underline ml-1">
              Sincronizar agora
            </button>
          )}
        </div>
      )}

      {/* Install prompt banner */}
      {showBanner && installPrompt && (
        <div className="fixed bottom-24 left-4 right-4 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 animate-in">
          <button
            onClick={() => setShowBanner(false)}
            className="absolute top-3 right-3 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center"
          >
            <X className="w-3.5 h-3.5 text-gray-500" />
          </button>

          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-primary-100 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Download className="w-6 h-6 text-primary-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-gray-900">Instalar BUDGY</h3>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                Adiciona à tela inicial para acesso rápido e funcionamento offline.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleInstall}
                  className="flex-1 bg-primary-500 text-white text-xs font-semibold py-2.5 rounded-xl hover:bg-primary-600 transition-colors"
                >
                  Instalar
                </button>
                <button
                  onClick={() => setShowBanner(false)}
                  className="px-4 bg-gray-100 text-gray-600 text-xs font-semibold py-2.5 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Agora não
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
