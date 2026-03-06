"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, subDays, isToday } from "date-fns";

interface DateNavigatorProps {
  date: Date;
  onDateChange: (date: Date) => void;
}

export function DateNavigator({ date, onDateChange }: DateNavigatorProps) {
  return (
    <div className="flex items-center justify-center gap-3">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDateChange(subDays(date, 1))}
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <button
        onClick={() => onDateChange(new Date())}
        className="text-lg font-semibold min-w-[180px] text-center"
      >
        {isToday(date) ? "Today" : format(date, "EEEE, MMM d")}
      </button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDateChange(addDays(date, 1))}
        disabled={isToday(date)}
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
