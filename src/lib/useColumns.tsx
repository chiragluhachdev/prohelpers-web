"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui";

export type ColumnDef = {
  id: string;
  label: string;
  defaultVisible?: boolean;
};

export function useColumns(storageKey: string, columns: ColumnDef[]) {
  // Initialize state from local storage or defaults
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") {
      const initial: Record<string, boolean> = {};
      columns.forEach(c => initial[c.id] = c.defaultVisible !== false);
      return initial;
    }
    
    try {
      const saved = localStorage.getItem(`cols_${storageKey}`);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      // ignore
    }
    
    const initial: Record<string, boolean> = {};
    columns.forEach(c => initial[c.id] = c.defaultVisible !== false);
    return initial;
  });

  // Save to local storage on change
  useEffect(() => {
    localStorage.setItem(`cols_${storageKey}`, JSON.stringify(visibleCols));
  }, [visibleCols, storageKey]);

  const toggleCol = (id: string) => {
    setVisibleCols(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const isVisible = (id: string) => visibleCols[id] !== false;

  const ColumnToggle = () => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
      if (!open) return;
      const handleClick = (e: MouseEvent) => {
        if (ref.current && !ref.current.contains(e.target as Node)) {
          setOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }, [open]);

    return (
      <div className="relative" ref={ref}>
        <Button variant="ghost" size="sm" onClick={() => setOpen(!open)} className="text-ink-muted hover:text-ink">
          Columns <span className="ml-1 text-[16px] leading-none">⚙</span>
        </Button>
        
        {open && (
          <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-line bg-surface p-2 shadow-lg z-50">
            <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-1">
              Show Columns
            </p>
            <div className="space-y-1">
              {columns.map(col => (
                <label
                  key={col.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sunken"
                >
                  <input
                    type="checkbox"
                    className="rounded border-line text-forest-600 focus:ring-forest-600"
                    checked={isVisible(col.id)}
                    onChange={() => toggleCol(col.id)}
                  />
                  <span className="text-sm font-medium text-ink">{col.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return { visibleCols, isVisible, toggleCol, ColumnToggle };
}
