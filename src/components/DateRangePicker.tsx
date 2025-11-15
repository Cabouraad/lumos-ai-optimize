import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
  from: Date | undefined;
  to: Date | undefined;
  onRangeChange: (from: Date | undefined, to: Date | undefined) => void;
}

export function DateRangePicker({ from, to, onRangeChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handlePreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    onRangeChange(start, end);
    setIsOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-[280px] justify-start text-left font-normal",
              !from && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {from && to ? (
              <>
                {format(from, "MMM d, yyyy")} - {format(to, "MMM d, yyyy")}
              </>
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            <div className="flex flex-col gap-2 p-3 border-r">
              <div className="text-sm font-medium mb-1">Quick Select</div>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => handlePreset(7)}
              >
                Last 7 days
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => handlePreset(14)}
              >
                Last 14 days
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => handlePreset(30)}
              >
                Last 30 days
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => handlePreset(60)}
              >
                Last 60 days
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => handlePreset(90)}
              >
                Last 90 days
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => {
                  onRangeChange(undefined, undefined);
                  setIsOpen(false);
                }}
              >
                All time
              </Button>
            </div>
            <Calendar
              mode="range"
              selected={{ from, to }}
              onSelect={(range) => {
                if (range) {
                  onRangeChange(range.from, range.to);
                  if (range.from && range.to) {
                    setIsOpen(false);
                  }
                }
              }}
              numberOfMonths={2}
              disabled={(date) => date > new Date()}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
