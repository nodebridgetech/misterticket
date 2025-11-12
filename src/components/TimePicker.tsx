import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface TimePickerProps {
  date: Date | undefined;
  onTimeChange: (date: Date | undefined) => void;
  placeholder?: string;
}

export function TimePicker({ date, onTimeChange, placeholder = "Selecione o horário" }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState(date?.getHours() || 0);
  const [selectedMinute, setSelectedMinute] = useState(date?.getMinutes() || 0);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const handleApply = () => {
    const newDate = date ? new Date(date) : new Date();
    newDate.setHours(selectedHour);
    newDate.setMinutes(selectedMinute);
    newDate.setSeconds(0);
    newDate.setMilliseconds(0);
    onTimeChange(newDate);
    setOpen(false);
  };

  const formatTime = (hour: number, minute: number) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <Clock className="mr-2 h-4 w-4 text-foreground" />
          {date ? formatTime(date.getHours(), date.getMinutes()) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex gap-2 p-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-center">Hora</label>
            <div className="h-[180px] overflow-y-auto border rounded-md">
              {hours.map((hour) => (
                <button
                  key={hour}
                  type="button"
                  onClick={() => setSelectedHour(hour)}
                  className={cn(
                    "w-full px-4 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                    selectedHour === hour && "bg-primary text-primary-foreground font-semibold"
                  )}
                >
                  {hour.toString().padStart(2, '0')}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-center">Minuto</label>
            <div className="h-[180px] overflow-y-auto border rounded-md">
              {minutes.map((minute) => (
                <button
                  key={minute}
                  type="button"
                  onClick={() => setSelectedMinute(minute)}
                  className={cn(
                    "w-full px-4 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                    selectedMinute === minute && "bg-primary text-primary-foreground font-semibold"
                  )}
                >
                  {minute.toString().padStart(2, '0')}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t p-3">
          <Button onClick={handleApply} className="w-full">
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
