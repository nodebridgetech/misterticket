import { useEffect, useRef, useState } from "react";
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

// Global flag to track script loading
let googleMapsLoading = false;
let googleMapsLoaded = false;
const loadCallbacks: (() => void)[] = [];

const loadGoogleMapsScript = (apiKey: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Already loaded
    if (googleMapsLoaded && window.google?.maps?.Map) {
      resolve();
      return;
    }

    // Currently loading - add to callback queue
    if (googleMapsLoading) {
      loadCallbacks.push(() => resolve());
      return;
    }

    // Check if script already exists in DOM
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      if (window.google?.maps?.Map) {
        googleMapsLoaded = true;
        resolve();
      } else {
        existingScript.addEventListener('load', () => {
          googleMapsLoaded = true;
          resolve();
        });
      }
      return;
    }

    googleMapsLoading = true;

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      googleMapsLoaded = true;
      googleMapsLoading = false;
      resolve();
      loadCallbacks.forEach(cb => cb());
      loadCallbacks.length = 0;
    };

    script.onerror = () => {
      googleMapsLoading = false;
      reject(new Error("Failed to load Google Maps"));
    };

    document.head.appendChild(script);
  });
};

export const LocationMap = ({
  address,
  addressNumber,
  venue,
  className = "",
  showOpenButtons = true,
}: LocationMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markerInstance = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

  const fullAddress = addressNumber ? `${address}, ${addressNumber}` : address;

  useEffect(() => {
    if (!address) return;

    const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      setError("Chave da API do Google Maps não configurada");
      return;
    }

    let isMounted = true;

    const initMap = async () => {
      try {
        await loadGoogleMapsScript(apiKey);
        
        if (!isMounted || !mapRef.current || !window.google?.maps) return;

        const geocoder = new window.google.maps.Geocoder();
        
        geocoder.geocode({ address: fullAddress }, (results, status) => {
          if (!isMounted) return;
          
          if (status === "OK" && results && results[0]) {
            const location = results[0].geometry.location;
            
            // Create map
            mapInstance.current = new window.google.maps.Map(mapRef.current!, {
              center: location,
              zoom: 16,
              mapId: "location-map-" + Math.random().toString(36).substr(2, 9),
              disableDefaultUI: false,
              zoomControl: true,
              mapTypeControl: false,
              scaleControl: true,
              streetViewControl: false,
              rotateControl: false,
              fullscreenControl: true,
            });

            // Create marker content
            const markerContent = document.createElement("div");
            markerContent.innerHTML = `
              <div style="
                background: #8B5CF6;
                padding: 8px 12px;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                color: white;
                font-weight: 600;
                font-size: 14px;
                white-space: nowrap;
              ">
                ${venue || "Local do evento"}
              </div>
              <div style="
                width: 0;
                height: 0;
                border-left: 8px solid transparent;
                border-right: 8px solid transparent;
                border-top: 8px solid #8B5CF6;
                margin: 0 auto;
              "></div>
            `;

            markerInstance.current = new window.google.maps.marker.AdvancedMarkerElement({
              map: mapInstance.current,
              position: location,
              content: markerContent,
              title: venue || "Local do evento",
            });

            setIsLoaded(true);
            setError(null);
          } else {
            console.error("Geocoding failed:", status);
            setError("Endereço não encontrado no mapa");
          }
        });
      } catch (err) {
        console.error("Error initializing map:", err);
        if (isMounted) {
          setError("Erro ao carregar mapa");
        }
      }
    };

    initMap();

    return () => {
      isMounted = false;
      if (markerInstance.current) {
        markerInstance.current.map = null;
      }
    };
  }, [address, addressNumber, venue, fullAddress]);

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

  return (
    <div className={`space-y-3 ${className}`}>
      <div 
        ref={mapRef} 
        className="w-full h-[200px] rounded-lg bg-muted border border-border overflow-hidden"
      >
        {!isLoaded && !error && (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-muted-foreground text-sm">Carregando mapa...</div>
          </div>
        )}
        {error && (
          <div className="w-full h-full flex items-center justify-center flex-col gap-2 p-4">
            <MapPin className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">{error}</p>
            {showOpenButtons && (
              <Button variant="outline" size="sm" onClick={openGoogleMaps}>
                <MapPin className="h-4 w-4 mr-2" />
                Abrir no Google Maps
              </Button>
            )}
          </div>
        )}
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