"use client";

import { useState } from "react";
import {
  Users,
  Plus,
  Star,
  Clock,
  CheckCircle2,
  CircleDollarSign,
  Wallet,
} from "lucide-react";
import { useXitiqueGroups } from "@/hooks/use-supabase-data";
import type { XitiqueGroup } from "@/lib/supabase/types";

function GroupCard({ group }: { group: XitiqueGroup }) {
  const isMyTurn = group.my_turn === group.current_round;
  const totalPot = group.total_members * group.contribution_amount;
  const progress = (group.current_round / group.total_members) * 100;

  return (
    <div className="card p-4 w-full text-left">
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isMyTurn ? "bg-amber-500" : "bg-primary-500"}`}>
          <Users className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold truncate">{group.name}</h3>
            {isMyTurn && (
              <span className="text-2xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md font-bold flex-shrink-0">
                Minha vez!
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-[var(--color-text-muted)]">{group.total_members} membros</span>
            <span className="w-1 h-1 bg-gray-300 rounded-full" />
            <span className="text-xs text-[var(--color-text-muted)]">{group.frequency}</span>
            <span className="w-1 h-1 bg-gray-300 rounded-full" />
            <span className="text-xs text-[var(--color-text-muted)]">Ronda {group.current_round}/{group.total_members}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-primary-600">{group.contribution_amount.toLocaleString("pt-MZ")}</p>
          <p className="text-2xs text-[var(--color-text-muted)]">MZN/{group.frequency === "Quinzenal" ? "quinzena" : "mês"}</p>
        </div>
      </div>

      <div className="mt-3">
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-primary-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className="text-2xs text-[var(--color-text-muted)]">
          Minha posição: #{group.my_turn ?? "?"}
        </span>
        <span className="text-2xs text-[var(--color-text-muted)]">
          Pote: {totalPot.toLocaleString("pt-MZ")} MZN
        </span>
      </div>
    </div>
  );
}

export default function XitiquePage() {
  const { data: groups, loading } = useXitiqueGroups();

  const allGroups = groups ?? [];
  const myTurnGroups = allGroups.filter((g) => g.my_turn === g.current_round);
  const totalContributed = allGroups.reduce((sum, g) => sum + g.contribution_amount * Math.min(g.current_round, g.total_members), 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-12 h-12 bg-primary-200 rounded-full mx-auto mb-3" />
          <p className="text-sm text-gray-400">A carregar xitiques...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary-500 to-primary-700 text-white px-4 pt-12 pb-6 rounded-b-3xl">
        <h1 className="text-xl font-bold mb-4">Xitique</h1>
        <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-primary-100 text-xs">Total Investido</p>
              <p className="text-xl font-bold">{totalContributed.toLocaleString("pt-MZ")} MZN</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/20">
            <div className="text-center">
              <p className="text-primary-200 text-2xs">Grupos Activos</p>
              <p className="text-sm font-bold">{allGroups.length}</p>
            </div>
            <div className="text-center">
              <p className="text-primary-200 text-2xs">Minha Vez</p>
              <p className="text-sm font-bold">{myTurnGroups.length}</p>
            </div>
            <div className="text-center">
              <p className="text-primary-200 text-2xs">Contribuição</p>
              <p className="text-sm font-bold text-2xs">
                {allGroups.reduce((s, g) => s + g.contribution_amount, 0).toLocaleString("pt-MZ")}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 pt-4 space-y-6">
        {/* My Turn Alert */}
        {myTurnGroups.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <Star className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">Minha vez de receber!</p>
              {myTurnGroups.map((g) => (
                <p key={g.id} className="text-xs text-amber-600 mt-0.5">
                  {g.name} - {(g.total_members * g.contribution_amount).toLocaleString("pt-MZ")} MZN
                </p>
              ))}
            </div>
          </div>
        )}

        {allGroups.length === 0 ? (
          <div className="card p-8 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-1">Sem grupos de xitique</p>
            <p className="text-xs text-gray-400">Cria um grupo para acompanhar as tuas poupanças rotativas</p>
          </div>
        ) : (
          <div className="space-y-4">
            {allGroups.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>
        )}

        {/* Summary stats */}
        {allGroups.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-3 text-center">
              <CircleDollarSign className="w-5 h-5 text-primary-500 mx-auto mb-1" />
              <p className="text-2xs text-[var(--color-text-muted)]">Total Contribuído</p>
              <p className="text-sm font-bold">{totalContributed.toLocaleString("pt-MZ")} MZN</p>
            </div>
            <div className="card p-3 text-center">
              <Wallet className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
              <p className="text-2xs text-[var(--color-text-muted)]">Grupos</p>
              <p className="text-sm font-bold">{allGroups.length}</p>
            </div>
          </div>
        )}
      </main>

      <button className="fab">
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
