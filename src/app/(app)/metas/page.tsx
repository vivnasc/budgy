"use client";

import { useState } from "react";
import {
  Plus,
  PiggyBank,
  Trophy,
  Target,
  Wallet,
} from "lucide-react";
import { GoalCard } from "@/components/goal-card";
import { QuickCreateModal } from "@/components/quick-create-modal";
import { GoalManageModal } from "@/components/goal-manage-modal";
import { useGoals } from "@/hooks/use-supabase-data";

const GOAL_COLORS = ["bg-emerald-500", "bg-blue-500", "bg-amber-500", "bg-purple-500", "bg-rose-500", "bg-teal-500", "bg-indigo-500"];

export default function MetasPage() {
  const { data: goals, loading, refetch } = useGoals();
  const [creating, setCreating] = useState(false);
  const [managingId, setManagingId] = useState<string | null>(null);

  const allGoals = goals ?? [];
  const activeGoals = allGoals.filter((g) => !g.is_completed);
  const completedGoals = allGoals.filter((g) => g.is_completed);

  const totalSaved = activeGoals.reduce((sum, g) => sum + g.current_amount, 0);
  const totalTarget = activeGoals.reduce((sum, g) => sum + g.target_amount, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-12 h-12 bg-primary-200 rounded-full mx-auto mb-3" />
          <p className="text-sm text-gray-400">A carregar metas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-4">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary-500 to-primary-700 text-white px-4 pt-12 pb-6 rounded-b-3xl">
        <div className="flex items-center justify-between mb-4 gap-3">
          <h1 className="text-xl font-bold">Metas Financeiras</h1>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-xl bg-white/20 hover:bg-white/30 px-3 py-2 text-sm font-semibold text-white active:scale-95 transition-all flex-shrink-0"
          >
            <Plus className="w-4 h-4" /> Criar meta
          </button>
        </div>

        <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <p className="text-primary-100 text-xs">Total Poupado</p>
              <p className="text-lg font-bold">
                {totalSaved.toLocaleString("pt-MZ")} MZN
              </p>
            </div>
          </div>

          {totalTarget > 0 && (
            <>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-white rounded-full transition-all duration-700"
                  style={{ width: `${Math.min((totalSaved / totalTarget) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-primary-100">
                  {Math.round((totalSaved / totalTarget) * 100)}% do objectivo total
                </span>
                <span className="font-medium">
                  {totalTarget.toLocaleString("pt-MZ")} MZN
                </span>
              </div>
            </>
          )}
        </div>
      </header>

      <main className="px-4 pt-6 space-y-6">
        {allGoals.length === 0 ? (
          <div className="card p-8 text-center">
            <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-1">Sem metas ainda</p>
            <p className="text-xs text-gray-400 mb-4">Cria metas para acompanhar a tua poupança</p>
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-500/20 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" /> Criar primeira meta
            </button>
          </div>
        ) : (
          <>
            {/* Active Goals */}
            {activeGoals.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold">
                    Metas Activas{" "}
                    <span className="text-xs text-[var(--color-text-muted)] font-normal">
                      ({activeGoals.length})
                    </span>
                  </h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {activeGoals.map((goal, i) => (
                    <GoalCard
                      key={goal.id}
                      name={goal.name}
                      icon={Wallet}
                      current={goal.current_amount}
                      target={goal.target_amount}
                      deadline={goal.deadline ?? ""}
                      color={goal.color ?? GOAL_COLORS[i % GOAL_COLORS.length]!}
                      onClick={() => setManagingId(goal.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Completed Goals */}
            {completedGoals.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <h2 className="font-semibold">
                    Concluídas{" "}
                    <span className="text-xs text-[var(--color-text-muted)] font-normal">
                      ({completedGoals.length})
                    </span>
                  </h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {completedGoals.map((goal, i) => (
                    <GoalCard
                      key={goal.id}
                      name={goal.name}
                      icon={Wallet}
                      current={goal.current_amount}
                      target={goal.target_amount}
                      deadline={goal.deadline ?? ""}
                      color={goal.color ?? GOAL_COLORS[i % GOAL_COLORS.length]!}
                      completed
                      onClick={() => setManagingId(goal.id)}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* Motivation */}
        {totalSaved > 0 && (
          <div className="card p-4 bg-gradient-to-r from-primary-50 to-emerald-50 border-primary-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                <PiggyBank className="w-5 h-5 text-primary-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-primary-800">Continua assim!</p>
                <p className="text-xs text-primary-600">
                  Já poupaste {totalSaved.toLocaleString("pt-MZ")} MZN para as tuas metas
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      <button onClick={() => setCreating(true)} className="fab">
        <Plus className="w-6 h-6" />
      </button>

      {creating && (
        <QuickCreateModal kind="goal" onClose={() => setCreating(false)} onCreated={() => refetch()} />
      )}

      {managingId && (() => {
        const goal = allGoals.find((g) => g.id === managingId);
        if (!goal) return null;
        return (
          <GoalManageModal
            goal={goal}
            onClose={() => setManagingId(null)}
            onSaved={() => refetch()}
          />
        );
      })()}
    </div>
  );
}
