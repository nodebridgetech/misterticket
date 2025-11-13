import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Html5QrcodeScanner } from "html5-qrcode";
import { BarcodeScanner } from "@capacitor-community/barcode-scanner";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertTriangle, Scan, Camera } from "lucide-react";
import { toast } from "sonner";

interface ValidationResult {
  success: boolean;
  message: string;
  ticketInfo?: {
    eventTitle: string;
    buyerName: string;
    ticketBatch: string;
    validatedAt?: string;
    validatedBy?: string;
  };
}

export default function ValidateTickets() {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [scanner, setScanner] = useState<Html5QrcodeScanner | null>(null);
  // Only use native scanner on actual native platforms (iOS/Android), not web/PWA
  const isNative = Capacitor.getPlatform() === 'ios' || Capacitor.getPlatform() === 'android';

  useEffect(() => {
    if (userRole !== "producer" && userRole !== "admin") {
      navigate("/");
      toast.error("Acesso negado. Apenas produtores podem validar ingressos.");
    }
  }, [userRole, navigate]);

  // Initialize HTML5 scanner after DOM is ready
  useEffect(() => {
    if (scanning && !isNative && !scanner) {
      console.log("=== HTML5 Scanner Initialization ===");
      
      // Wait for DOM to be ready
      setTimeout(() => {
        const element = document.getElementById("qr-reader");
        console.log("qr-reader element:", element);
        
        if (!element) {
          console.error("!!! qr-reader element not found in DOM!");
          toast.error("Erro: elemento scanner não encontrado");
          setScanning(false);
          return;
        }

        try {
          console.log("Creating Html5QrcodeScanner instance...");
          const html5QrcodeScanner = new Html5QrcodeScanner(
            "qr-reader",
            { 
              fps: 10, 
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1.0,
              // Request back camera on mobile
              videoConstraints: {
                facingMode: { ideal: "environment" }
              },
              // Disable file upload option
              showTorchButtonIfSupported: true,
              formatsToSupport: [0] // Only QR codes
            },
            /* verbose= */ false
          );

          console.log("Rendering scanner...");
          html5QrcodeScanner.render(onScanSuccess, onScanError);
          setScanner(html5QrcodeScanner);
          console.log("✓ HTML5 scanner initialized successfully!");
        } catch (error) {
          console.error("!!! Error initializing HTML5 scanner:", error);
          if (error instanceof Error) {
            console.error("Error message:", error.message);
            console.error("Error stack:", error.stack);
          }
          toast.error("Erro ao inicializar scanner: " + (error instanceof Error ? error.message : "Desconhecido"));
          setScanning(false);
        }
      }, 100);
    }
  }, [scanning, isNative, scanner]);

  useEffect(() => {
    return () => {
      if (scanner) {
        console.log("Cleaning up scanner...");
        scanner.clear();
      }
      // Cleanup native scanner
      if (isNative && scanning) {
        BarcodeScanner.stopScan();
        document.body.classList.remove("scanner-active");
      }
    };
  }, [scanner, scanning, isNative]);

  const startScanning = async () => {
    try {
      const platform = Capacitor.getPlatform();
      console.log("=== SCANNER DEBUG ===");
      console.log("Platform:", platform);
      console.log("isNative:", isNative);
      console.log("User Agent:", navigator.userAgent);
      
      setValidationResult(null);

      // Use native scanner if available (PWA/Native app)
      if (isNative) {
        setScanning(true);
        console.log("-> Using native scanner");
        await startNativeScanning();
      } else {
        // For web scanner, set scanning first to render the div
        console.log("-> Using HTML5 web scanner");
        setScanning(true);
      }
    } catch (error) {
      console.error("!!! Error in startScanning:", error);
      toast.error("Erro ao iniciar scanner");
      setScanning(false);
    }
  };

  const startNativeScanning = async () => {
    try {
      // Check permission
      const status = await BarcodeScanner.checkPermission({ force: true });
      
      if (!status.granted) {
        toast.error("Permissão de câmera negada");
        setScanning(false);
        return;
      }

      // Make background transparent for camera view
      document.body.classList.add("scanner-active");
      BarcodeScanner.hideBackground();
      
      // Start scanning
      const result = await BarcodeScanner.startScan();
      
      // Stop scanning and restore UI
      BarcodeScanner.showBackground();
      document.body.classList.remove("scanner-active");
      setScanning(false);
      
      if (result.hasContent) {
        await validateQRCode(result.content || "");
      }
    } catch (error) {
      console.error("Native scan error:", error);
      toast.error("Erro ao acessar câmera");
      BarcodeScanner.showBackground();
      document.body.classList.remove("scanner-active");
      setScanning(false);
    }
  };

  const stopScanning = async () => {
    if (isNative) {
      BarcodeScanner.stopScan();
      BarcodeScanner.showBackground();
      document.body.classList.remove("scanner-active");
    }
    
    if (scanner) {
      scanner.clear();
      setScanner(null);
    }
    setScanning(false);
  };

  const onScanSuccess = async (decodedText: string) => {
    if (scanner) {
      scanner.pause(true);
    }

    await validateQRCode(decodedText);
  };

  const onScanError = (error: any) => {
    // Silently ignore scan errors (they happen frequently during scanning)
    console.debug("QR scan error:", error);
  };

  const validateQRCode = async (qrCode: string) => {
    try {
      // Parse QR code data
      let qrToken: string;
      try {
        const qrData = JSON.parse(qrCode);
        qrToken = qrData.token;
      } catch {
        // If parsing fails, treat the whole string as the token (backward compatibility)
        qrToken = qrCode;
      }

      if (!qrToken) {
        setValidationResult({
          success: false,
          message: "QR Code inválido ou corrompido.",
        });
        toast.error("QR Code inválido");
        return;
      }

      // Fetch sale using the secure qr_token
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .select(`
          *,
          events (
            id,
            title,
            producer_id
          ),
          tickets (
            batch_name,
            sector
          )
        `)
        .eq("qr_token", qrToken)
        .single();

      if (saleError || !sale) {
        setValidationResult({
          success: false,
          message: "QR Code inválido ou ingresso não encontrado.",
        });
        toast.error("QR Code inválido");
        return;
      }

      // Fetch buyer profile separately
      const { data: buyerProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", sale.buyer_id)
        .single();

      // Check if user is the producer of this event
      if (userRole === "producer" && sale.events.producer_id !== user?.id) {
        setValidationResult({
          success: false,
          message: "Você não tem permissão para validar ingressos deste evento.",
        });
        toast.error("Acesso negado");
        return;
      }

      // Check if already validated
      if (sale.validated_at) {
        const validatedDate = new Date(sale.validated_at).toLocaleString("pt-BR");
        setValidationResult({
          success: false,
          message: "Este ingresso já foi validado anteriormente.",
          ticketInfo: {
            eventTitle: sale.events.title,
            buyerName: buyerProfile?.full_name || "N/A",
            ticketBatch: sale.tickets?.batch_name || "N/A",
            validatedAt: validatedDate,
          },
        });
        toast.error("Ingresso já validado");
        return;
      }

      // Validate the ticket
      const { error: updateError } = await supabase
        .from("sales")
        .update({
          validated_at: new Date().toISOString(),
          validated_by: user?.id,
        })
        .eq("id", sale.id);

      if (updateError) {
        setValidationResult({
          success: false,
          message: "Erro ao validar ingresso. Tente novamente.",
        });
        toast.error("Erro na validação");
        return;
      }

      setValidationResult({
        success: true,
        message: "Ingresso validado com sucesso!",
        ticketInfo: {
          eventTitle: sale.events.title,
          buyerName: buyerProfile?.full_name || "N/A",
          ticketBatch: `${sale.tickets?.batch_name || "N/A"}${sale.tickets?.sector ? ` - ${sale.tickets.sector}` : ""}`,
        },
      });
      toast.success("Ingresso validado!");
    } catch (error) {
      console.error("Validation error:", error);
      setValidationResult({
        success: false,
        message: "Erro ao processar validação.",
      });
      toast.error("Erro na validação");
    }
  };

  const handleNewScan = async () => {
    setValidationResult(null);
    if (scanner) {
      scanner.resume();
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scan className="h-6 w-6" />
            Validação de Ingressos
          </CardTitle>
          <CardDescription>
            Escaneie o QR Code dos ingressos para validar a entrada no evento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!scanning ? (
            <Button onClick={startScanning} className="w-full" size="lg">
              <Camera className="mr-2 h-5 w-5" />
              Iniciar Scanner com Câmera
            </Button>
          ) : (
            <div className="space-y-4">
              {!isNative && (
                <div className="relative">
                  <div id="qr-reader" className="w-full rounded-lg overflow-hidden" />
                  <style>{`
                    #qr-reader {
                      border: none !important;
                    }
                    #qr-reader__filescan_input {
                      display: none !important;
                    }
                    #qr-reader__dashboard_section_fsr {
                      display: none !important;
                    }
                    #qr-reader video {
                      border-radius: var(--radius) !important;
                    }
                    #qr-reader__scan_region {
                      border-radius: var(--radius) !important;
                    }
                    #qr-reader__scan_region img {
                      filter: brightness(0) saturate(100%) invert(47%) sepia(96%) saturate(3527%) hue-rotate(340deg) brightness(98%) contrast(98%);
                    }
                    #qr-reader__header_message {
                      display: none !important;
                    }
                    #qr-reader__camera_permission_button {
                      background: hsl(var(--primary)) !important;
                      color: hsl(var(--primary-foreground)) !important;
                      border: none !important;
                      padding: 0.75rem 1.5rem !important;
                      border-radius: var(--radius) !important;
                      font-weight: 500 !important;
                      cursor: pointer !important;
                    }
                    #qr-reader__camera_permission_button:hover {
                      opacity: 0.9 !important;
                    }
                    #html5-qrcode-button-camera-permission {
                      background: hsl(var(--primary)) !important;
                      color: hsl(var(--primary-foreground)) !important;
                      border: none !important;
                      padding: 0.75rem 1.5rem !important;
                      border-radius: var(--radius) !important;
                      font-weight: 500 !important;
                      cursor: pointer !important;
                    }
                    #html5-qrcode-button-camera-permission:hover {
                      opacity: 0.9 !important;
                    }
                  `}</style>
                </div>
              )}
              {isNative && (
                <Alert>
                  <Camera className="h-4 w-4" />
                  <AlertDescription>
                    Câmera ativa - aponte para o QR Code do ingresso
                  </AlertDescription>
                </Alert>
              )}
              <Button onClick={stopScanning} variant="outline" className="w-full">
                Parar Scanner
              </Button>
            </div>
          )}

          {validationResult && (
            <Alert
              className={
                validationResult.success
                  ? "border-green-500 bg-green-50 dark:bg-green-950"
                  : validationResult.ticketInfo?.validatedAt
                  ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950"
                  : "border-red-500 bg-red-50 dark:bg-red-950"
              }
            >
              <div className="flex items-start gap-3">
                {validationResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                ) : validationResult.ticketInfo?.validatedAt ? (
                  <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                )}
                <div className="flex-1 space-y-3">
                  <AlertDescription className="font-semibold text-base">
                    {validationResult.message}
                  </AlertDescription>

                  {validationResult.ticketInfo && (
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">Evento:</span>{" "}
                        {validationResult.ticketInfo.eventTitle}
                      </div>
                      <div>
                        <span className="font-medium">Comprador:</span>{" "}
                        {validationResult.ticketInfo.buyerName}
                      </div>
                      <div>
                        <span className="font-medium">Lote:</span>{" "}
                        {validationResult.ticketInfo.ticketBatch}
                      </div>
                      {validationResult.ticketInfo.validatedAt && (
                        <div>
                          <Badge variant="secondary">
                            Validado em: {validationResult.ticketInfo.validatedAt}
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}

                  {scanning && (
                    <Button onClick={handleNewScan} className="w-full mt-3">
                      Escanear Próximo Ingresso
                    </Button>
                  )}
                </div>
              </div>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
