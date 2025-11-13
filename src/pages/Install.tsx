import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Smartphone, Download, CheckCircle, Share, MoreVertical, Monitor } from "lucide-react";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Detect Android
    const android = /Android/.test(navigator.userAgent);
    setIsAndroid(android);

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      toast.error("Instalação não disponível neste navegador");
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      toast.success("App instalado com sucesso!");
      setIsInstalled(true);
    }

    setDeferredPrompt(null);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl md:text-3xl">
            <Smartphone className="h-7 w-7 text-primary" />
            Instalar Mister Ticket
          </CardTitle>
          <CardDescription className="text-base">
            Tenha acesso rápido ao Mister Ticket direto da tela inicial do seu dispositivo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isInstalled ? (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-base font-medium">
                O app já está instalado no seu dispositivo!
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Android/Chrome Install Button */}
              {deferredPrompt && (
                <div className="space-y-4">
                  <Button 
                    onClick={handleInstallClick} 
                    size="lg" 
                    className="w-full"
                  >
                    <Download className="mr-2 h-5 w-5" />
                    Instalar Aplicativo
                  </Button>
                  <p className="text-sm text-muted-foreground text-center">
                    Clique no botão acima para instalar o app diretamente
                  </p>
                </div>
              )}

              {/* iOS Instructions */}
              {isIOS && !deferredPrompt && (
                <div className="space-y-4">
                  <Alert>
                    <Smartphone className="h-5 w-5" />
                    <AlertDescription className="text-base">
                      No iOS/iPhone, use o Safari para instalar
                    </AlertDescription>
                  </Alert>
                  
                  <div className="space-y-4 p-4 bg-muted rounded-lg">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      Como instalar no iPhone/iPad:
                    </h3>
                    <ol className="space-y-3 list-decimal list-inside text-sm md:text-base">
                      <li className="flex items-start gap-2">
                        <Share className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
                        <span>Toque no botão de <strong>Compartilhar</strong> (ícone de quadrado com seta para cima)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Download className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
                        <span>Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong></span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
                        <span>Toque em <strong>"Adicionar"</strong> no canto superior direito</span>
                      </li>
                    </ol>
                  </div>
                </div>
              )}

              {/* Android Chrome Instructions */}
              {isAndroid && !deferredPrompt && (
                <div className="space-y-4">
                  <Alert>
                    <Smartphone className="h-5 w-5" />
                    <AlertDescription className="text-base">
                      No Android, use o Chrome para instalar
                    </AlertDescription>
                  </Alert>
                  
                  <div className="space-y-4 p-4 bg-muted rounded-lg">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      Como instalar no Android:
                    </h3>
                    <ol className="space-y-3 list-decimal list-inside text-sm md:text-base">
                      <li className="flex items-start gap-2">
                        <MoreVertical className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
                        <span>Toque no menu <strong>(⋮)</strong> no canto superior direito</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Download className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
                        <span>Toque em <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong></span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
                        <span>Confirme tocando em <strong>"Instalar"</strong></span>
                      </li>
                    </ol>
                  </div>
                </div>
              )}

              {/* Desktop Instructions */}
              {!isIOS && !isAndroid && !deferredPrompt && (
                <div className="space-y-4">
                  <Alert>
                    <Monitor className="h-5 w-5" />
                    <AlertDescription className="text-base">
                      No computador, use Chrome, Edge ou outro navegador compatível
                    </AlertDescription>
                  </Alert>
                  
                  <div className="space-y-4 p-4 bg-muted rounded-lg">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      Como instalar no Desktop:
                    </h3>
                    <ol className="space-y-3 list-decimal list-inside text-sm md:text-base">
                      <li className="flex items-start gap-2">
                        <Download className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
                        <span>Procure pelo ícone de <strong>instalação</strong> na barra de endereços (geralmente um ícone de computador ou +)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
                        <span>Clique em <strong>"Instalar"</strong> quando aparecer a opção</span>
                      </li>
                    </ol>
                    <p className="text-sm text-muted-foreground mt-4">
                      Ou acesse pelo menu do navegador: <strong>Menu (⋮) → Instalar Mister Ticket</strong>
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Benefits Section */}
          <div className="space-y-4 pt-6 border-t border-border">
            <h3 className="font-semibold text-lg">Benefícios do App:</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Acesso Rápido</p>
                  <p className="text-sm text-muted-foreground">Abra direto da tela inicial</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Scanner de QR Code</p>
                  <p className="text-sm text-muted-foreground">Use a câmera para validar ingressos</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Funciona Offline</p>
                  <p className="text-sm text-muted-foreground">Acesse mesmo sem internet</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Notificações</p>
                  <p className="text-sm text-muted-foreground">Receba atualizações importantes</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
