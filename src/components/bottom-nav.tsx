"use client";

import { useState } from "react";
import {
  Home,
  ArrowLeftRight,
  PieChart,
  Plus,
  MoreHorizontal,
  Target,
  Wallet,
  Users,
  Heart,
  BarChart3,
  GraduationCap,
  Settings,
  MessageSquareText,
  Sparkles,
  HandHeart,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AddTransactionModal } from "@/components/add-transaction-modal";

const NAV_ITEMS = [
  {
    label: "Início",
    icon: Home,
    href: "/painel",
  },
  {
    label: "Transacções",
    icon: ArrowLeftRight,
    href: "/transacoes",
  },
  // FAB placeholder (index 2)
  {
    label: "",
    icon: Plus,
    href: "#fab",
  },
  {
    label: "Orçamento",
    icon: PieChart,
    href: "/orcamento",
  },
  {
    label: "Mais",
    icon: MoreHorizontal,
    href: "#more",
  },
];

const MORE_MENU_ITEMS = [
  { label: "Parceiro", icon: HandHeart, href: "/parceiro", color: "bg-emerald-500" },
  { label: "Análise", icon: Sparkles, href: "/analise", color: "bg-emerald-500" },
  { label: "Importar", icon: MessageSquareText, href: "/importar", color: "bg-emerald-600" },
  { label: "Metas", icon: Target, href: "/metas", color: "bg-emerald-500" },
  { label: "Contas", icon: Wallet, href: "/contas", color: "bg-blue-500" },
  { label: "Xitique", icon: Users, href: "/xitique", color: "bg-amber-500" },
  { label: "Dívidas", icon: Heart, href: "/dividas", color: "bg-red-500" },
  { label: "Relatórios", icon: BarChart3, href: "/relatorios", color: "bg-purple-500" },
  { label: "Educação", icon: GraduationCap, href: "/educacao", color: "bg-teal-500" },
  { label: "Definições", icon: Settings, href: "/importar", color: "bg-gray-500" },
];

export function BottomNav() {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const isMoreActive = MORE_MENU_ITEMS.some(
    (item) => pathname.startsWith(item.href)
  );

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-xl border-t border-white/10 px-2 pb-[var(--safe-bottom)]">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
          {NAV_ITEMS.map((item, index) => {
            // FAB button (center)
            if (item.href === "#fab") {
              return (
                <button
                  key="fab"
                  onClick={() => setShowAddModal(true)}
                  className="relative -mt-6 w-14 h-14 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30 active:scale-95 transition-transform"
                >
                  <Plus className="w-7 h-7 text-white" />
                </button>
              );
            }

            // "Mais" button
            if (item.href === "#more") {
              return (
                <button
                  key="more"
                  onClick={() => setShowMore(!showMore)}
                  className={`relative flex flex-col items-center justify-center gap-0.5 w-16 py-1 rounded-xl transition-colors ${
                    isMoreActive || showMore
                      ? "text-emerald-400"
                      : "text-gray-500 hover:text-gray-400"
                  }`}
                >
                  {(isMoreActive || showMore) && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-emerald-400" />
                  )}
                  <div className="p-1 rounded-lg transition-colors">
                    <MoreHorizontal
                      className={`w-5 h-5 ${
                        isMoreActive || showMore
                          ? "text-emerald-400"
                          : "text-gray-500"
                      }`}
                      strokeWidth={isMoreActive || showMore ? 2.5 : 2}
                    />
                  </div>
                  <span
                    className={`text-2xs font-medium ${
                      isMoreActive || showMore
                        ? "text-emerald-400"
                        : "text-gray-500"
                    }`}
                  >
                    Mais
                  </span>
                </button>
              );
            }

            // Regular nav items
            const isActive =
              pathname === item.href ||
              (item.href !== "/painel" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setShowMore(false)}
                className={`relative flex flex-col items-center justify-center gap-0.5 w-16 py-1 rounded-xl transition-colors ${
                  isActive
                    ? "text-emerald-400"
                    : "text-gray-500 hover:text-gray-400"
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-emerald-400" />
                )}
                <div className="p-1 rounded-lg transition-colors">
                  <item.icon
                    className={`w-5 h-5 ${
                      isActive ? "text-emerald-400" : "text-gray-500"
                    }`}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                </div>
                <span
                  className={`text-2xs font-medium ${
                    isActive ? "text-emerald-400" : "text-gray-500"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* More Menu Overlay */}
      {showMore && (
        <div className="fixed inset-0 z-40">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowMore(false)}
          />

          {/* Menu Panel */}
          <div className="absolute bottom-20 left-4 right-4 max-w-lg mx-auto bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-xl border border-white/10 overflow-hidden animate-in">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">Mais opções</h3>
              <button
                onClick={() => setShowMore(false)}
                className="w-7 h-7 bg-white/10 rounded-full flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>

            {/* Menu Grid */}
            <div className="grid grid-cols-4 gap-1 p-3">
              {MORE_MENU_ITEMS.map((item) => {
                const isActive = pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setShowMore(false)}
                    className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl transition-colors ${
                      isActive
                        ? "bg-emerald-500/10"
                        : "hover:bg-white/5 active:bg-white/10"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 ${item.color} rounded-xl flex items-center justify-center`}
                    >
                      <item.icon className="w-5 h-5 text-white" />
                    </div>
                    <span
                      className={`text-2xs font-medium ${
                        isActive
                          ? "text-emerald-400"
                          : "text-gray-400"
                      }`}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {showAddModal && (
        <AddTransactionModal onClose={() => setShowAddModal(false)} />
      )}
    </>
  );
}
