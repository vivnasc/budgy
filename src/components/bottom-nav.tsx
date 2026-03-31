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
  X,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AddTransactionModal } from "@/components/add-transaction-modal";

const MAIN_NAV = [
  { label: "Início", icon: Home, href: "/painel" },
  { label: "Transacções", icon: ArrowLeftRight, href: "/transacoes" },
  { label: "Orçamento", icon: PieChart, href: "/orcamento" },
  { label: "Relatórios", icon: BarChart3, href: "/relatorios" },
];

const SECONDARY_NAV = [
  { label: "Importar", icon: MessageSquareText, href: "/importar", color: "text-emerald-500" },
  { label: "Metas", icon: Target, href: "/metas", color: "text-emerald-500" },
  { label: "Contas", icon: Wallet, href: "/contas", color: "text-blue-500" },
  { label: "Xitique", icon: Users, href: "/xitique", color: "text-amber-500" },
  { label: "Dívidas", icon: Heart, href: "/dividas", color: "text-red-500" },
  { label: "Educação", icon: GraduationCap, href: "/educacao", color: "text-teal-500" },
];

const MORE_MENU_ITEMS = [
  { label: "Importar", icon: MessageSquareText, href: "/importar", color: "bg-emerald-600" },
  { label: "Metas", icon: Target, href: "/metas", color: "bg-emerald-500" },
  { label: "Contas", icon: Wallet, href: "/contas", color: "bg-blue-500" },
  { label: "Xitique", icon: Users, href: "/xitique", color: "bg-amber-500" },
  { label: "Dívidas", icon: Heart, href: "/dividas", color: "bg-red-500" },
  { label: "Relatórios", icon: BarChart3, href: "/relatorios", color: "bg-purple-500" },
  { label: "Educação", icon: GraduationCap, href: "/educacao", color: "bg-teal-500" },
];

export function BottomNav() {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const isMoreActive = MORE_MENU_ITEMS.some(
    (item) => pathname.startsWith(item.href)
  );

  return (
    <>
      {/* ─── Desktop Sidebar (hidden on mobile) ─── */}
      <aside className={`hidden lg:flex fixed left-0 top-0 bottom-0 z-50 flex-col bg-white border-r border-gray-100 transition-all duration-200 ${sidebarCollapsed ? "w-[68px]" : "w-56"}`}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-16 border-b border-gray-50">
          <img src="/Budgy-favicon.jpeg" alt="BUDGY" className="w-9 h-9 rounded-xl shadow-sm flex-shrink-0" />
          {!sidebarCollapsed && <span className="text-lg font-black text-gray-900">BUDGY</span>}
        </div>

        {/* Add button */}
        <div className="px-3 pt-4 pb-2">
          <button
            onClick={() => setShowAddModal(true)}
            className={`w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-emerald-500/25 ${sidebarCollapsed ? "h-10 w-10 mx-auto" : "h-10 px-4"}`}
          >
            <Plus className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-sm">Nova</span>}
          </button>
        </div>

        {/* Main nav */}
        <nav className="flex-1 px-2 py-2 space-y-1">
          {MAIN_NAV.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/painel" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                }`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-emerald-600" : ""}`} strokeWidth={isActive ? 2.5 : 2} />
                {!sidebarCollapsed && <span>{item.label}</span>}
                {isActive && sidebarCollapsed && <div className="absolute left-0 w-1 h-6 bg-emerald-500 rounded-r-full" />}
              </Link>
            );
          })}

          {/* Divider */}
          {!sidebarCollapsed && <div className="border-t border-gray-100 my-3" />}
          {sidebarCollapsed && <div className="border-t border-gray-100 my-3 mx-2" />}

          {/* Secondary nav */}
          {SECONDARY_NAV.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${
                  isActive
                    ? "bg-gray-100 text-gray-900 font-medium"
                    : "text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                }`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <item.icon className={`w-4.5 h-4.5 flex-shrink-0 ${isActive ? item.color : ""}`} />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="flex items-center justify-center gap-2 px-3 py-3 border-t border-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ChevronRight className={`w-4 h-4 transition-transform ${sidebarCollapsed ? "" : "rotate-180"}`} />
          {!sidebarCollapsed && <span className="text-xs">Recolher</span>}
        </button>
      </aside>

      {/* ─── Mobile Bottom Nav (hidden on desktop) ─── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--color-surface)] border-t border-[var(--color-border)] px-2 pb-[var(--safe-bottom)]">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
          {[
            { label: "Início", icon: Home, href: "/painel" },
            { label: "Transacções", icon: ArrowLeftRight, href: "/transacoes" },
            { label: "", icon: Plus, href: "#fab" },
            { label: "Orçamento", icon: PieChart, href: "/orcamento" },
            { label: "Mais", icon: MoreHorizontal, href: "#more" },
          ].map((item) => {
            if (item.href === "#fab") {
              return (
                <button
                  key="fab"
                  onClick={() => setShowAddModal(true)}
                  className="relative -mt-6 w-14 h-14 bg-primary-500 rounded-full flex items-center justify-center shadow-lg shadow-primary-500/30 active:scale-95 transition-transform"
                >
                  <Plus className="w-7 h-7 text-white" />
                </button>
              );
            }

            if (item.href === "#more") {
              return (
                <button
                  key="more"
                  onClick={() => setShowMore(!showMore)}
                  className={`flex flex-col items-center justify-center gap-0.5 w-16 py-1 rounded-xl transition-colors ${
                    isMoreActive || showMore ? "text-primary-600" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <div className={`p-1 rounded-lg transition-colors ${isMoreActive || showMore ? "bg-primary-50" : ""}`}>
                    <MoreHorizontal className={`w-5 h-5 ${isMoreActive || showMore ? "text-primary-600" : "text-gray-400"}`} strokeWidth={isMoreActive || showMore ? 2.5 : 2} />
                  </div>
                  <span className={`text-2xs font-medium ${isMoreActive || showMore ? "text-primary-600" : "text-gray-400"}`}>Mais</span>
                </button>
              );
            }

            const isActive = pathname === item.href || (item.href !== "/painel" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setShowMore(false)}
                className={`flex flex-col items-center justify-center gap-0.5 w-16 py-1 rounded-xl transition-colors ${
                  isActive ? "text-primary-600" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <div className={`p-1 rounded-lg transition-colors ${isActive ? "bg-primary-50" : ""}`}>
                  <item.icon className={`w-5 h-5 ${isActive ? "text-primary-600" : "text-gray-400"}`} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={`text-2xs font-medium ${isActive ? "text-primary-600" : "text-gray-400"}`}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* More Menu Overlay (mobile only) */}
      {showMore && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowMore(false)} />
          <div className="absolute bottom-20 left-4 right-4 max-w-lg mx-auto bg-[var(--color-surface)] rounded-2xl shadow-xl border border-[var(--color-border)] overflow-hidden animate-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <h3 className="text-sm font-bold">Mais opções</h3>
              <button onClick={() => setShowMore(false)} className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1 p-3">
              {MORE_MENU_ITEMS.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowMore(false)}
                    className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl transition-colors ${
                      isActive ? "bg-primary-50" : "hover:bg-gray-50 active:bg-gray-100"
                    }`}
                  >
                    <div className={`w-10 h-10 ${item.color} rounded-xl flex items-center justify-center`}>
                      <item.icon className="w-5 h-5 text-white" />
                    </div>
                    <span className={`text-2xs font-medium ${isActive ? "text-primary-600" : "text-[var(--color-text-secondary)]"}`}>{item.label}</span>
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
