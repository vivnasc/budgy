"use client";

import { useState } from "react";
import {
  Users,
  Plus,
  ChevronRight,
  Calendar,
  CircleDollarSign,
  Star,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Wallet,
  ArrowRight,
  UserCircle,
} from "lucide-react";

interface XitiqueMember {
  id: string;
  name: string;
  position: number;
  hasReceived: boolean;
  isCurrent: boolean;
  isMe: boolean;
}

interface XitiqueGroup {
  id: string;
  name: string;
  totalMembers: number;
  contributionAmount: number;
  frequency: string;
  currentRound: number;
  totalRounds: number;
  myPosition: number;
  myTurn: boolean;
  nextPayment: string;
  totalPot: number;
  members: XitiqueMember[];
  status: "active" | "completed";
  contributions: { date: string; amount: number; paid: boolean }[];
}

const MOCK_GROUPS: XitiqueGroup[] = [
  {
    id: "1",
    name: "Xitique da Família",
    totalMembers: 8,
    contributionAmount: 5000,
    frequency: "Mensal",
    currentRound: 3,
    totalRounds: 8,
    myPosition: 5,
    myTurn: false,
    nextPayment: "1 Março 2026",
    totalPot: 40000,
    status: "active",
    members: [
      { id: "m1", name: "Maria", position: 1, hasReceived: true, isCurrent: false, isMe: false },
      { id: "m2", name: "João", position: 2, hasReceived: true, isCurrent: false, isMe: false },
      { id: "m3", name: "Ana", position: 3, hasReceived: false, isCurrent: true, isMe: false },
      { id: "m4", name: "Pedro", position: 4, hasReceived: false, isCurrent: false, isMe: false },
      { id: "m5", name: "Eu", position: 5, hasReceived: false, isCurrent: false, isMe: true },
      { id: "m6", name: "Rosa", position: 6, hasReceived: false, isCurrent: false, isMe: false },
      { id: "m7", name: "Carlos", position: 7, hasReceived: false, isCurrent: false, isMe: false },
      { id: "m8", name: "Fátima", position: 8, hasReceived: false, isCurrent: false, isMe: false },
    ],
    contributions: [
      { date: "2026-01-01", amount: 5000, paid: true },
      { date: "2026-02-01", amount: 5000, paid: true },
      { date: "2026-03-01", amount: 5000, paid: false },
    ],
  },
  {
    id: "2",
    name: "Xitique do Trabalho",
    totalMembers: 5,
    contributionAmount: 10000,
    frequency: "Mensal",
    currentRound: 1,
    totalRounds: 5,
    myPosition: 1,
    myTurn: true,
    nextPayment: "15 Março 2026",
    totalPot: 50000,
    status: "active",
    members: [
      { id: "w1", name: "Eu", position: 1, hasReceived: false, isCurrent: true, isMe: true },
      { id: "w2", name: "Luísa", position: 2, hasReceived: false, isCurrent: false, isMe: false },
      { id: "w3", name: "Miguel", position: 3, hasReceived: false, isCurrent: false, isMe: false },
      { id: "w4", name: "Teresa", position: 4, hasReceived: false, isCurrent: false, isMe: false },
      { id: "w5", name: "André", position: 5, hasReceived: false, isCurrent: false, isMe: false },
    ],
    contributions: [
      { date: "2026-03-15", amount: 10000, paid: false },
    ],
  },
  {
    id: "3",
    name: "Xitique das Amigas",
    totalMembers: 6,
    contributionAmount: 3000,
    frequency: "Quinzenal",
    currentRound: 5,
    totalRounds: 6,
    myPosition: 6,
    myTurn: false,
    nextPayment: "10 Março 2026",
    totalPot: 18000,
    status: "active",
    members: [
      { id: "a1", name: "Sónia", position: 1, hasReceived: true, isCurrent: false, isMe: false },
      { id: "a2", name: "Graça", position: 2, hasReceived: true, isCurrent: false, isMe: false },
      { id: "a3", name: "Lúcia", position: 3, hasReceived: true, isCurrent: false, isMe: false },
      { id: "a4", name: "Helena", position: 4, hasReceived: true, isCurrent: false, isMe: false },
      { id: "a5", name: "Diana", position: 5, hasReceived: false, isCurrent: true, isMe: false },
      { id: "a6", name: "Eu", position: 6, hasReceived: false, isCurrent: false, isMe: true },
    ],
    contributions: [
      { date: "2025-12-15", amount: 3000, paid: true },
      { date: "2026-01-01", amount: 3000, paid: true },
      { date: "2026-01-15", amount: 3000, paid: true },
      { date: "2026-02-01", amount: 3000, paid: true },
      { date: "2026-02-15", amount: 3000, paid: true },
      { date: "2026-03-01", amount: 3000, paid: false },
    ],
  },
];

function MemberCircle({ group }: { group: XitiqueGroup }) {
  const members = group.members;
  const radius = 65;
  const centerX = 90;
  const centerY = 90;

  return (
    <div className="flex justify-center py-4">
      <svg width="180" height="180" viewBox="0 0 180 180">
        {/* Background circle */}
        <circle cx={centerX} cy={centerY} r={radius + 10} fill="none" stroke="#E5E7EB" strokeWidth="1" strokeDasharray="4 4" />

        {/* Members around the circle */}
        {members.map((member, i) => {
          const angle = (i / members.length) * 2 * Math.PI - Math.PI / 2;
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);

          const fillColor = member.isMe
            ? "#10B981"
            : member.isCurrent
              ? "#F59E0B"
              : member.hasReceived
                ? "#6B7280"
                : "#E5E7EB";

          const strokeColor = member.isMe
            ? "#059669"
            : member.isCurrent
              ? "#D97706"
              : member.hasReceived
                ? "#9CA3AF"
                : "#D1D5DB";

          return (
            <g key={member.id}>
              {/* Connection line to center */}
              <line
                x1={centerX}
                y1={centerY}
                x2={x}
                y2={y}
                stroke="#E5E7EB"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              {/* Member circle */}
              <circle
                cx={x}
                cy={y}
                r={16}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth="2"
              />
              {/* Position number */}
              <text
                x={x}
                y={y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="10"
                fontWeight="bold"
                fill="white"
              >
                {member.position}
              </text>
              {/* Name label */}
              <text
                x={x}
                y={y + 28}
                textAnchor="middle"
                fontSize="8"
                fill="#6B7280"
                fontWeight={member.isMe ? "bold" : "normal"}
              >
                {member.name}
              </text>
              {/* Checkmark for received */}
              {member.hasReceived && (
                <text
                  x={x + 10}
                  y={y - 10}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#10B981"
                >
                  ✓
                </text>
              )}
              {/* Current indicator */}
              {member.isCurrent && (
                <circle cx={x + 12} cy={y - 12} r="4" fill="#F59E0B" stroke="white" strokeWidth="1" />
              )}
            </g>
          );
        })}

        {/* Center label */}
        <text
          x={centerX}
          y={centerY - 6}
          textAnchor="middle"
          fontSize="10"
          fontWeight="bold"
          fill="#374151"
        >
          Ronda
        </text>
        <text
          x={centerX}
          y={centerY + 8}
          textAnchor="middle"
          fontSize="14"
          fontWeight="bold"
          fill="#10B981"
        >
          {group.currentRound}/{group.totalRounds}
        </text>
      </svg>
    </div>
  );
}

export default function XitiquePage() {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"groups" | "history">("groups");

  const totalInvested = MOCK_GROUPS.reduce(
    (sum, g) => sum + g.contributions.filter((c) => c.paid).reduce((s, c) => s + c.amount, 0),
    0
  );
  const myTurnGroups = MOCK_GROUPS.filter((g) => g.myTurn);
  const activeGroups = MOCK_GROUPS.filter((g) => g.status === "active");

  const expandedGroup = MOCK_GROUPS.find((g) => g.id === selectedGroup);

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary-500 to-primary-700 text-white px-4 pt-12 pb-6 rounded-b-3xl">
        <h1 className="text-xl font-bold mb-4">Xitique</h1>

        {/* Summary Card */}
        <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-primary-100 text-xs">Total Investido</p>
              <p className="text-xl font-bold">
                {totalInvested.toLocaleString("pt-MZ")} MZN
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/20">
            <div className="text-center">
              <p className="text-primary-200 text-2xs">Grupos Activos</p>
              <p className="text-sm font-bold">{activeGroups.length}</p>
            </div>
            <div className="text-center">
              <p className="text-primary-200 text-2xs">Minha Vez</p>
              <p className="text-sm font-bold">{myTurnGroups.length}</p>
            </div>
            <div className="text-center">
              <p className="text-primary-200 text-2xs">Próximo Pgto</p>
              <p className="text-sm font-bold text-2xs">1 Mar</p>
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
              <p className="text-sm font-semibold text-amber-800">
                Minha vez de receber!
              </p>
              {myTurnGroups.map((g) => (
                <p key={g.id} className="text-xs text-amber-600 mt-0.5">
                  {g.name} - {g.totalPot.toLocaleString("pt-MZ")} MZN
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("groups")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              activeTab === "groups"
                ? "bg-primary-500 text-white"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            Grupos ({activeGroups.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              activeTab === "history"
                ? "bg-primary-500 text-white"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            Histórico
          </button>
        </div>

        {activeTab === "groups" && (
          <div className="space-y-4">
            {/* Group Cards */}
            {MOCK_GROUPS.map((group) => (
              <div key={group.id}>
                <button
                  onClick={() =>
                    setSelectedGroup(
                      selectedGroup === group.id ? null : group.id
                    )
                  }
                  className="card p-4 w-full text-left hover:shadow-soft transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        group.myTurn
                          ? "bg-amber-500"
                          : "bg-primary-500"
                      }`}
                    >
                      <Users className="w-6 h-6 text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold truncate">
                          {group.name}
                        </h3>
                        {group.myTurn && (
                          <span className="text-2xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md font-bold flex-shrink-0">
                            Minha vez!
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {group.totalMembers} membros
                        </span>
                        <span className="w-1 h-1 bg-gray-300 rounded-full" />
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {group.frequency}
                        </span>
                        <span className="w-1 h-1 bg-gray-300 rounded-full" />
                        <span className="text-xs text-[var(--color-text-muted)]">
                          Ronda {group.currentRound}/{group.totalRounds}
                        </span>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-primary-600">
                        {group.contributionAmount.toLocaleString("pt-MZ")}
                      </p>
                      <p className="text-2xs text-[var(--color-text-muted)]">
                        MZN/{group.frequency === "Quinzenal" ? "quinzena" : "mês"}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full transition-all duration-500"
                        style={{
                          width: `${(group.currentRound / group.totalRounds) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* My position indicator */}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-2xs text-[var(--color-text-muted)]">
                      Minha posição: #{group.myPosition}
                    </span>
                    <span className="text-2xs text-[var(--color-text-muted)]">
                      Pote: {group.totalPot.toLocaleString("pt-MZ")} MZN
                    </span>
                  </div>
                </button>

                {/* Expanded View */}
                {selectedGroup === group.id && (
                  <div className="card mt-2 p-4 space-y-4 animate-in">
                    {/* Member Circle Visualization */}
                    <div>
                      <h4 className="text-sm font-semibold mb-1 text-center">
                        Ordem de Rotação
                      </h4>
                      <MemberCircle group={group} />
                      <div className="flex justify-center gap-4 text-2xs text-[var(--color-text-muted)]">
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded-full bg-gray-400" />
                          <span>Recebeu</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded-full bg-amber-500" />
                          <span>Actual</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded-full bg-emerald-500" />
                          <span>Eu</span>
                        </div>
                      </div>
                    </div>

                    {/* Members List */}
                    <div>
                      <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2">
                        Membros
                      </h4>
                      <div className="space-y-1.5">
                        {group.members.map((member) => (
                          <div
                            key={member.id}
                            className={`flex items-center gap-2.5 p-2 rounded-xl ${
                              member.isMe
                                ? "bg-primary-50"
                                : member.isCurrent
                                  ? "bg-amber-50"
                                  : ""
                            }`}
                          >
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-2xs font-bold ${
                                member.isMe
                                  ? "bg-primary-500"
                                  : member.isCurrent
                                    ? "bg-amber-500"
                                    : member.hasReceived
                                      ? "bg-gray-400"
                                      : "bg-gray-300"
                              }`}
                            >
                              {member.position}
                            </div>
                            <span
                              className={`text-xs flex-1 ${
                                member.isMe ? "font-bold text-primary-700" : "font-medium"
                              }`}
                            >
                              {member.name}
                              {member.isMe && " (Eu)"}
                            </span>
                            {member.hasReceived && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            )}
                            {member.isCurrent && (
                              <Star className="w-4 h-4 text-amber-500" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Contribution History */}
                    <div>
                      <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2">
                        Minhas Contribuições
                      </h4>
                      <div className="space-y-1.5">
                        {group.contributions.map((c, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between py-1.5 px-2"
                          >
                            <div className="flex items-center gap-2">
                              {c.paid ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Clock className="w-4 h-4 text-amber-500" />
                              )}
                              <span className="text-xs text-[var(--color-text-secondary)]">
                                {new Date(c.date + "T00:00:00").toLocaleDateString("pt-MZ", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold">
                                {c.amount.toLocaleString("pt-MZ")} MZN
                              </span>
                              <span
                                className={`text-2xs px-1.5 py-0.5 rounded-md font-medium ${
                                  c.paid
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-amber-50 text-amber-700"
                                }`}
                              >
                                {c.paid ? "Pago" : "Pendente"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-3">
            {/* All contributions history */}
            <div className="card p-4">
              <h3 className="font-semibold text-sm mb-3">Histórico de Contribuições</h3>
              <div className="space-y-2">
                {MOCK_GROUPS.flatMap((g) =>
                  g.contributions.map((c, i) => ({
                    ...c,
                    groupName: g.name,
                    key: `${g.id}-${i}`,
                  }))
                )
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            item.paid ? "bg-emerald-50" : "bg-amber-50"
                          }`}
                        >
                          {item.paid ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Clock className="w-4 h-4 text-amber-500" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-medium">{item.groupName}</p>
                          <p className="text-2xs text-[var(--color-text-muted)]">
                            {new Date(item.date + "T00:00:00").toLocaleDateString("pt-MZ", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold">
                          {item.amount.toLocaleString("pt-MZ")} MZN
                        </p>
                        <span
                          className={`text-2xs ${
                            item.paid ? "text-emerald-600" : "text-amber-600"
                          }`}
                        >
                          {item.paid ? "Pago" : "Pendente"}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="card p-3 text-center">
                <CircleDollarSign className="w-5 h-5 text-primary-500 mx-auto mb-1" />
                <p className="text-2xs text-[var(--color-text-muted)]">Total Contribuído</p>
                <p className="text-sm font-bold">{totalInvested.toLocaleString("pt-MZ")} MZN</p>
              </div>
              <div className="card p-3 text-center">
                <TrendingUp className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                <p className="text-2xs text-[var(--color-text-muted)]">A Receber</p>
                <p className="text-sm font-bold">
                  {MOCK_GROUPS.filter((g) => !g.members.find((m) => m.isMe && m.hasReceived))
                    .reduce((sum, g) => sum + g.totalPot, 0)
                    .toLocaleString("pt-MZ")}{" "}
                  MZN
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FAB to add new group */}
      <button className="fab">
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
