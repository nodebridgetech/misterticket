import { useState, useEffect, useCallback } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UpdateSWFunction {
  (reloadPage?: boolean): Promise<void>;
}

export const PWAUpdatePrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [updateSW, setUpdateSW] = useState<UpdateSWFunction | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const handleUpdate = (event: CustomEvent<{ updateSW: UpdateSWFunction }>) => {
      setUpdateSW(() => event.detail.updateSW);
      setShowPrompt(true);
    };

    window.addEventListener('pwa-update-available', handleUpdate as EventListener);
    
    return () => {
      window.removeEventListener('pwa-update-available', handleUpdate as EventListener);
    };
  }, []);

  const handleUpdate = useCallback(async () => {
    if (updateSW) {
      setIsUpdating(true);
      try {
        await updateSW(true);
      } catch (error) {
        console.error('Error updating service worker:', error);
        // Force reload as fallback
        window.location.reload();
      }
    }
  }, [updateSW]);

  const handleDismiss = useCallback(() => {
    setShowPrompt(false);
  }, []);

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96">
      <div className="bg-card border border-border rounded-lg shadow-lg p-4 animate-in slide-in-from-bottom-5">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <RefreshCw className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-foreground text-sm">
              Nova versão disponível
            </h4>
            <p className="text-muted-foreground text-xs mt-1">
              Uma atualização está pronta para ser instalada. Atualize para obter as últimas melhorias.
            </p>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={handleUpdate}
                disabled={isUpdating}
                className="flex-1"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Atualizando...
                  </>
                ) : (
                  "Atualizar agora"
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDismiss}
                disabled={isUpdating}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
