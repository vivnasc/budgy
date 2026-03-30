"use client";

import {
  Plus,
  Plane,
  Car,
  Home,
  GraduationCap,
  Laptop,
  Smartphone,
  PiggyBank,
  Shield,
  Trophy,
  Target,
} from "lucide-react";
import { GoalCard } from "@/components/goal-card";

interface Goal {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  current: number;
  target: number;
  deadline: string;
  color: string;
  completed: boolean;
}

const MOCK_GOALS: Goal[] = [
  {
    id: "1",
    name: "Fundo de Emergência",
    icon: Shield,
    current: 45000,
    target: 100000,
    deadline: "2026-06-30",
    color: "bg-emerald-500",
    completed: false,
  },
  {
    id: "2",
    name: "Viagem a Lisboa",
    icon: Plane,
    current: 28000,
    target: 80000,
    deadline: "2026-12-15",
    color: "bg-blue-500",
    completed: false,
  },
  {
    id: "3",
    name: "Carro Novo",
    icon: Car,
    current: 120000,
    target: 800000,
    deadline: "2027-06-01",
    color: "bg-amber-500",
    completed: false,
  },
  {
    id: "4",
    name: "Laptop Novo",
    icon: Laptop,
    current: 35000,
    target: 45000,
    deadline: "2026-04-01",
    color: "bg-purple-500",
    completed: false,
  },
  {
    id: "5",
    name: "Entrada Casa",
    icon: Home,
    current: 200000,
    target: 1500000,
    deadline: "2028-12-31",
    color: "bg-rose-500",
    completed: false,
  },
  {
    id: "6",
    name: "Smartphone",
    icon: Smartphone,
    current: 25000,
    target: 25000,
    deadline: "2026-01-15",
    color: "bg-teal-500",
    completed: true,
  },
  {
    id: "7",
    name: "Curso Online",
    icon: GraduationCap,
    current: 8000,
    target: 8000,
    deadline: "2025-12-01",
    color: "bg-indigo-500",
    completed: true,
  },
];

export default function MetasPage() {
  const activeGoals = MOCK_GOALS.filter((g) => !g.completed);
  const completedGoals = MOCK_GOALS.filter((g) => g.completed);

  const totalSaved = activeGoals.reduce((sum, g) => sum + g.current, 0);
  const totalTarget = activeGoals.reduce((sum, g) => sum + g.target, 0);

  return (
    <div className="min-h-screen pb-4">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary-500 to-primary-700 text-white px-4 pt-12 pb-6 rounded-b-3xl">
        <h1 className="text-xl font-bold mb-4">Metas Financeiras</h1>

        {/* Summary */}
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

          <div className="h-2 bg-white/20 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-white rounded-full transition-all duration-700"
              style={{
                width: `${Math.min((totalSaved / totalTarget) * 100, 100)}%`,
              }}
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
        </div>
      </header>

      <main className="px-4 pt-6 space-y-6">
        {/* Active Goals */}
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
            {activeGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                name={goal.name}
                icon={goal.icon}
                current={goal.current}
                target={goal.target}
                deadline={goal.deadline}
                color={goal.color}
              />
            ))}
          </div>
        </section>

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
              {completedGoals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  name={goal.name}
                  icon={goal.icon}
                  current={goal.current}
                  target={goal.target}
                  deadline={goal.deadline}
                  color={goal.color}
                  completed
                />
              ))}
            </div>
          </section>
        )}

        {/* Motivation */}
        <div className="card p-4 bg-gradient-to-r from-primary-50 to-emerald-50 border-primary-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
              <PiggyBank className="w-5 h-5 text-primary-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-primary-800">
                Continua assim!
              </p>
              <p className="text-xs text-primary-600">
                Já poupaste {totalSaved.toLocaleString("pt-MZ")} MZN para as tuas metas
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* FAB */}
      <button className="fab">
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
