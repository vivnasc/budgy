"use client";

import { useEffect, useState } from "react";
import { CalendarRange, ChevronDown } from "lucide-react";
import {
  getCycleStartDay,
  setCycleStartDay,
  cycleLabel,
  currentCycleStart,
} from "@/lib/period";

/**
 * Estado partilhado do dia de início do ciclo. Inicializa só no cliente
 * (evita mismatch de hidratação — no servidor é sempre 1, o default).
 */
export function useCycleStartDay(): [number, (day: number) => void] {
  const [startDay, setStartDay] = useState(1);

  useEffect(() => {
    setStartDay(getCycleStartDay());
  }, []);

  const update = (day: number) => {
    setCycleStartDay(day);
    setStartDay(getCycleStartDay());
  };

  return [startDay, update];
}

/**
 * Controlo compacto: "O meu mês começa no dia ___".
 * Mostra o ciclo actual e um selector 1..28. Escuro, mobile-first.
 */
export function CicloSettings({
  startDay,
  onChange,
}: {
  startDay: number;
  onChange: (day: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const label = cycleLabel(currentCycleStart(today, startDay), startDay, true);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-3.5 py-2.5 text-left active:opacity-70"
      >
        <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
          <CalendarRange className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-2xs text-gray-500">
            O meu m&ecirc;s come&ccedil;a no dia {startDay}
          </p>
          <p className="text-xs font-medium text-gray-200 truncate capitalize">{label}</p>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="card p-4 mt-2">
          <label
            htmlFor="ciclo-dia"
            className="text-xs font-medium text-gray-200 block mb-2"
          >
            O meu m&ecirc;s come&ccedil;a no dia
          </label>
          <select
            id="ciclo-dia"
            value={startDay}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-gray-100 outline-none focus:border-emerald-500/50"
          >
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d} className="bg-gray-900 text-gray-100">
                {d}
              </option>
            ))}
          </select>
          <p className="text-2xs text-gray-500 mt-2 leading-relaxed">
            Recebes o sal&aacute;rio neste dia? A BUDGY passa a contar o teu m&ecirc;s de
            sal&aacute;rio a sal&aacute;rio (ex: dia 20 &rarr; de 20 a 19). Dia 1 = m&ecirc;s normal do
            calend&aacute;rio.
          </p>
        </div>
      )}
    </div>
  );
}
