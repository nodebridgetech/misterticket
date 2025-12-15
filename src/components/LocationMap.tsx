import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface LocationMapProps {
  address: string;
  addressNumber?: string;
  venue?: string;
  className?: string;
  showOpenButtons?: boolean;
}

export const LocationMap = ({
  address,
  addressNumber,
  venue,
  className = "",
  showOpenButtons = true,
}: LocationMapProps) => {
  const [copied, setCopied] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const fullAddress = addressNumber ? `${address}, ${addressNumber}` : address;

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(fullAddress);
      setCopied(true);
      toast.success("Endereço copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Erro ao copiar endereço");
    }
  };

  const openGoogleMaps = () => {
    const query = encodeURIComponent(fullAddress);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
  };

  const openWaze = () => {
    const query = encodeURIComponent(fullAddress);
    window.open(`https://waze.com/ul?q=${query}`, "_blank");
  };

  if (!address) {
    return null;
  }

  const encodedAddress = encodeURIComponent(fullAddress);
  const mapSrc = `https://maps.google.com/maps?q=${encodedAddress}&t=&z=16&ie=UTF8&iwloc=&output=embed`;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="w-full h-[200px] rounded-lg bg-muted border border-border overflow-hidden relative">
        {!iframeLoaded && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-muted">
            <div className="text-muted-foreground text-sm">Carregando mapa...</div>
          </div>
        )}
        <iframe
          src={mapSrc}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={() => setIframeLoaded(true)}
          className={iframeLoaded ? "opacity-100" : "opacity-0"}
        />
      </div>

      {showOpenButtons && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={copyAddress} className="flex-1">
            {copied ? (
              <Check className="h-4 w-4 mr-2" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            {copied ? "Copiado!" : "Copiar"}
          </Button>
          <Button variant="outline" size="sm" onClick={openGoogleMaps} className="flex-1">
            <MapPin className="h-4 w-4 mr-2" />
            Maps
          </Button>
          <Button variant="outline" size="sm" onClick={openWaze} className="flex-1">
            <Navigation className="h-4 w-4 mr-2" />
            Waze
          </Button>
        </div>
      )}
    </div>
  );
};