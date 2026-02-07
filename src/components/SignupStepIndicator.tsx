import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SignupStepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  labels: string[];
}

export const SignupStepIndicator = ({
  currentStep,
  totalSteps,
  labels,
}: SignupStepIndicatorProps) => {
  return (
    <div className="flex items-center justify-center mb-6 w-full">
      <div className="flex items-center justify-between w-full max-w-xs">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step, index) => (
          <div key={step} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300",
                  step < currentStep
                    ? "bg-primary text-primary-foreground scale-100"
                    : step === currentStep
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/20 scale-110"
                    : "bg-muted text-muted-foreground scale-100"
                )}
              >
                {step < currentStep ? (
                  <Check className="w-4 h-4" />
                ) : (
                  step
                )}
              </div>
              <span
                className={cn(
                  "text-xs mt-1 text-center max-w-[80px] transition-colors duration-300",
                  step <= currentStep ? "text-foreground font-medium" : "text-muted-foreground"
                )}
              >
                {labels[index]}
              </span>
            </div>
            {index < totalSteps - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-2 transition-all duration-500",
                  step < currentStep ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
