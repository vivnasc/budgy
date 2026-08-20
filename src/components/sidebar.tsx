"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  ArrowLeftRight,
  PieChart,
  Wallet,
  Target,
  BarChart3,
  Sparkles,
  Upload,
  Users,
  Heart,
  GraduationCap,
  Plus,
  Settings,
} from "lucide-react";
import { AddTransactionModal } from "@/components/add-transaction-modal";

interface NavItem {
  label: string;
  icon: typeof Home;
  href: string;
}

const PRINCIPAL_ITEMS: NavItem[] = [
  { label: "Início", icon: Home, href: "/painel" },
  { label: "Transacções", icon: ArrowLeftRight, href: "/transacoes" },
  { label: "Orçamento", icon: PieChart, href: "/orcamento" },
];

const GESTAO_ITEMS: NavItem[] = [
  { label: "Contas", icon: Wallet, href: "/contas" },
  { label: "Metas", icon: Target, href: "/metas" },
  { label: "Análise", icon: Sparkles, href: "/analise" },
  { label: "Relatórios", icon: BarChart3, href: "/relatorios" },
];

const MAIS_ITEMS: NavItem[] = [
  { label: "Importar", icon: Upload, href: "/importar" },
  { label: "Xitique", icon: Users, href: "/xitique" },
  { label: "Dívidas", icon: Heart, href: "/dividas" },
  { label: "Educação", icon: GraduationCap, href: "/educacao" },
];

function NavSection({ label, items, pathname }: { label: string; items: NavItem[]; pathname: string }) {
  return (
    <div>
      <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <ul className="space-y-1">
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/painel" && pathname.startsWith(item.href));

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-400 -ml-px"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <item.icon
                  className={`h-[18px] w-[18px] flex-shrink-0 ${
                    isActive ? "text-emerald-400" : "text-gray-500 group-hover:text-gray-300"
                  }`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <>
      <div className="flex h-full flex-col bg-slate-900/95 border-r border-white/10">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-6 border-b border-white/5">
          <img
            src="/budgy-logo-64.webp"
            alt="BUDGY"
            className="w-9 h-9 rounded-xl shadow-lg ring-1 ring-white/20"
          />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">BUDGY</h1>
            <p className="text-[11px] text-gray-500">Finanças pessoais</p>
          </div>
        </div>

        {/* Add Transaction Button */}
        <div className="px-4 pt-5 pb-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/30 hover:brightness-110 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Nova transacção
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          <NavSection label="Principal" items={PRINCIPAL_ITEMS} pathname={pathname} />
          <NavSection label="Gestão" items={GESTAO_ITEMS} pathname={pathname} />
          <NavSection label="Mais" items={MAIS_ITEMS} pathname={pathname} />
        </nav>

        {/* Bottom — Settings + build version */}
        <div className="border-t border-white/5 px-3 py-3 space-y-2">
          <Link
            href="/painel"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Settings className="h-[18px] w-[18px]" />
            Definições
          </Link>
          <p className="px-3 text-[10px] text-gray-600 font-mono select-all">
            build {process.env.NEXT_PUBLIC_BUILD_COMMIT ?? "dev"}
          </p>
        </div>
      </div>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <AddTransactionModal onClose={() => setShowAddModal(false)} />
      )}
    </>
  );
}
