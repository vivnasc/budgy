"use client";

import { useState } from "react";
import {
  GraduationCap,
  Star,
  Trophy,
  Flame,
  BookOpen,
  Clock,
  ChevronRight,
  Lightbulb,
  Target,
  Wallet,
  PiggyBank,
  TrendingUp,
  Users,
  Briefcase,
  Lock,
  CheckCircle2,
  Play,
  Sparkles,
} from "lucide-react";

type Level = "beginner" | "intermediate" | "advanced";

interface Course {
  id: string;
  title: string;
  level: Level;
  totalLessons: number;
  completedLessons: number;
  estimatedMinutes: number;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  locked: boolean;
}

const LEVEL_CONFIG: Record<Level, { label: string; color: string; bg: string; border: string }> = {
  beginner: {
    label: "Iniciante",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  intermediate: {
    label: "Intermédio",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  advanced: {
    label: "Avançado",
    color: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-200",
  },
};

const MOCK_COURSES: Course[] = [
  {
    id: "1",
    title: "Orçamento que Funciona",
    level: "beginner",
    totalLessons: 5,
    completedLessons: 3,
    estimatedMinutes: 25,
    icon: Wallet,
    description: "Aprende a criar e manter um orçamento pessoal eficaz",
    locked: false,
  },
  {
    id: "2",
    title: "Dominar Dívidas",
    level: "beginner",
    totalLessons: 4,
    completedLessons: 4,
    estimatedMinutes: 20,
    icon: Target,
    description: "Estratégias para eliminar dívidas e manter-se livre delas",
    locked: false,
  },
  {
    id: "3",
    title: "Poupar com Inteligência",
    level: "beginner",
    totalLessons: 6,
    completedLessons: 1,
    estimatedMinutes: 30,
    icon: PiggyBank,
    description: "Técnicas práticas de poupança adaptadas à realidade moçambicana",
    locked: false,
  },
  {
    id: "4",
    title: "Investir em Moçambique",
    level: "intermediate",
    totalLessons: 8,
    completedLessons: 0,
    estimatedMinutes: 45,
    icon: TrendingUp,
    description: "Conheça as opções de investimento disponíveis em Moçambique",
    locked: false,
  },
  {
    id: "5",
    title: "Xitique Digital",
    level: "intermediate",
    totalLessons: 3,
    completedLessons: 0,
    estimatedMinutes: 15,
    icon: Users,
    description: "Como modernizar e gerir xitiques de forma digital",
    locked: false,
  },
  {
    id: "6",
    title: "Empreender",
    level: "advanced",
    totalLessons: 10,
    completedLessons: 0,
    estimatedMinutes: 60,
    icon: Briefcase,
    description: "Do plano de negócio à execução: guia completo para empreendedores",
    locked: true,
  },
];

const WEEKLY_TIPS = [
  "Regra 50/30/20: 50% necessidades, 30% desejos, 20% poupança. Começa hoje!",
  "Antes de comprar algo, espera 24 horas. Se ainda quiseres, provavelmente precisas.",
  "O xitique pode ser o teu primeiro passo para uma poupança regular e disciplinada.",
  "Mantém um fundo de emergência equivalente a 3-6 meses de despesas.",
];

function CourseCard({ course }: { course: Course }) {
  const levelConfig = LEVEL_CONFIG[course.level];
  const progress =
    course.totalLessons > 0
      ? (course.completedLessons / course.totalLessons) * 100
      : 0;
  const isCompleted = course.completedLessons === course.totalLessons;
  const Icon = course.icon;

  return (
    <div
      className={`card p-4 relative overflow-hidden transition-all ${
        course.locked ? "opacity-60" : "hover:shadow-soft"
      }`}
    >
      {course.locked && (
        <div className="absolute top-3 right-3">
          <Lock className="w-4 h-4 text-gray-400" />
        </div>
      )}

      {isCompleted && (
        <div className="absolute top-3 right-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        </div>
      )}

      {/* Icon & Level Badge */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isCompleted
              ? "bg-emerald-500"
              : course.level === "beginner"
                ? "bg-emerald-500"
                : course.level === "intermediate"
                  ? "bg-blue-500"
                  : "bg-purple-500"
          }`}
        >
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold leading-tight">{course.title}</h3>
          <p className="text-2xs text-[var(--color-text-muted)] mt-0.5 line-clamp-2">
            {course.description}
          </p>
        </div>
      </div>

      {/* Level Badge */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`text-2xs font-bold px-2 py-0.5 rounded-full ${levelConfig.bg} ${levelConfig.color}`}
        >
          {levelConfig.label}
        </span>
        <span className="text-2xs text-[var(--color-text-muted)] flex items-center gap-1">
          <BookOpen className="w-3 h-3" />
          {course.totalLessons} lições
        </span>
        <span className="text-2xs text-[var(--color-text-muted)] flex items-center gap-1">
          <Clock className="w-3 h-3" />
          ~{course.estimatedMinutes} min
        </span>
      </div>

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isCompleted
                ? "bg-emerald-500"
                : progress > 0
                  ? "bg-primary-500"
                  : "bg-gray-200"
            }`}
            style={{ width: `${Math.max(progress, 0)}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-2xs text-[var(--color-text-muted)]">
            {course.completedLessons}/{course.totalLessons} lições
          </span>
          {!course.locked && !isCompleted && (
            <button className="flex items-center gap-1 text-2xs font-semibold text-primary-600 hover:text-primary-700">
              {progress > 0 ? "Continuar" : "Começar"}
              <Play className="w-3 h-3" />
            </button>
          )}
          {isCompleted && (
            <span className="text-2xs font-semibold text-emerald-600">
              Concluído!
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EducacaoPage() {
  const [selectedLevel, setSelectedLevel] = useState<Level | "all">("all");

  const completedCourses = MOCK_COURSES.filter(
    (c) => c.completedLessons === c.totalLessons
  ).length;
  const totalLessonsCompleted = MOCK_COURSES.reduce(
    (sum, c) => sum + c.completedLessons,
    0
  );
  const totalLessons = MOCK_COURSES.reduce(
    (sum, c) => sum + c.totalLessons,
    0
  );
  const overallProgress = (totalLessonsCompleted / totalLessons) * 100;

  const streak = 7; // Mock streak
  const weeklyTip = WEEKLY_TIPS[0]!;

  const filteredCourses =
    selectedLevel === "all"
      ? MOCK_COURSES
      : MOCK_COURSES.filter((c) => c.level === selectedLevel);

  // Determine user level
  const userLevel: Level =
    completedCourses >= 4
      ? "advanced"
      : completedCourses >= 2
        ? "intermediate"
        : "beginner";
  const userLevelConfig = LEVEL_CONFIG[userLevel];

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary-500 to-primary-700 text-white px-4 pt-12 pb-6 rounded-b-3xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold">Academia Financeira</h1>
            <p className="text-primary-100 text-sm">
              Aprende. Cresce. Prospera.
            </p>
          </div>
          <div className="flex items-center gap-1 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-xl">
            <Flame className="w-4 h-4 text-amber-300" />
            <span className="text-sm font-bold">{streak}</span>
          </div>
        </div>

        {/* Level & Progress */}
        <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-primary-100">Nível Actual</span>
                <span
                  className={`text-2xs font-bold px-2 py-0.5 rounded-full bg-white/20`}
                >
                  {userLevelConfig.label}
                </span>
              </div>
              <p className="text-sm font-bold">
                {totalLessonsCompleted} de {totalLessons} lições concluídas
              </p>
            </div>
          </div>

          <div className="h-2.5 bg-white/20 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-white rounded-full transition-all duration-700"
              style={{ width: `${overallProgress}%` }}
            />
          </div>

          <div className="flex justify-between text-xs text-primary-200">
            <span>{Math.round(overallProgress)}% completo</span>
            <span>{completedCourses} cursos concluídos</span>
          </div>
        </div>
      </header>

      <main className="px-4 pt-4 space-y-6">
        {/* Streak Counter */}
        <div className="card p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <Flame className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-800">
                {streak} dias consecutivos de aprendizagem!
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                Continua assim para manter a tua sequência
              </p>
            </div>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                <div
                  key={day}
                  className={`w-4 h-4 rounded-full ${
                    day <= streak
                      ? "bg-amber-500"
                      : "bg-amber-200"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Weekly Tip */}
        <div className="card p-4 bg-gradient-to-r from-primary-50 to-emerald-50 border-primary-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Lightbulb className="w-5 h-5 text-primary-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs font-bold text-primary-800">
                  Dica da Semana
                </p>
                <Sparkles className="w-3 h-3 text-primary-500" />
              </div>
              <p className="text-sm text-primary-700 leading-relaxed">
                {weeklyTip}
              </p>
            </div>
          </div>
        </div>

        {/* Level Badges */}
        <section>
          <h2 className="font-semibold mb-3">Níveis</h2>
          <div className="grid grid-cols-3 gap-3">
            {(Object.entries(LEVEL_CONFIG) as [Level, typeof LEVEL_CONFIG[Level]][]).map(
              ([key, config]) => {
                const coursesInLevel = MOCK_COURSES.filter(
                  (c) => c.level === key
                );
                const completedInLevel = coursesInLevel.filter(
                  (c) => c.completedLessons === c.totalLessons
                ).length;
                const isAchieved =
                  key === "beginner"
                    ? completedCourses >= 1
                    : key === "intermediate"
                      ? completedCourses >= 3
                      : completedCourses >= 5;

                return (
                  <div
                    key={key}
                    className={`card p-3 text-center border ${
                      isAchieved ? config.border : "border-gray-100"
                    } ${isAchieved ? config.bg : ""}`}
                  >
                    <div
                      className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center mb-2 ${
                        isAchieved
                          ? key === "beginner"
                            ? "bg-emerald-500"
                            : key === "intermediate"
                              ? "bg-blue-500"
                              : "bg-purple-500"
                          : "bg-gray-200"
                      }`}
                    >
                      {isAchieved ? (
                        <Trophy className="w-5 h-5 text-white" />
                      ) : (
                        <Lock className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    <p
                      className={`text-xs font-bold ${
                        isAchieved ? config.color : "text-gray-400"
                      }`}
                    >
                      {config.label}
                    </p>
                    <p className="text-2xs text-[var(--color-text-muted)] mt-0.5">
                      {completedInLevel}/{coursesInLevel.length} cursos
                    </p>
                  </div>
                );
              }
            )}
          </div>
        </section>

        {/* Level Filter */}
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedLevel("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedLevel === "all"
                ? "bg-primary-500 text-white"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            Todos
          </button>
          {(Object.entries(LEVEL_CONFIG) as [Level, typeof LEVEL_CONFIG[Level]][]).map(
            ([key, config]) => (
              <button
                key={key}
                onClick={() => setSelectedLevel(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedLevel === key
                    ? "bg-primary-500 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {config.label}
              </button>
            )
          )}
        </div>

        {/* Course Cards */}
        <section className="space-y-3">
          {filteredCourses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </section>
      </main>
    </div>
  );
}
