import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, ExternalLink } from "lucide-react";

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
  const mapRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

    const loadGoogleMaps = async () => {
      try {
        // Check if already loaded
        if (window.google?.maps?.Map) {
          initMap();
          return;
        }

        // Load Google Maps script
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
          initMap();
        };

        script.onerror = () => {
          setError("Erro ao carregar Google Maps");
        };

        document.head.appendChild(script);
      } catch (err) {
        console.error("Error loading Google Maps:", err);
        setError("Erro ao carregar mapa");
      }
    };

    const initMap = async () => {
      if (!mapRef.current || !window.google?.maps) return;

      try {
        const geocoder = new window.google.maps.Geocoder();
        
        geocoder.geocode({ address: fullAddress }, (results, status) => {
          if (status === "OK" && results && results[0]) {
            const location = results[0].geometry.location;
            
            // Create map
            mapInstance.current = new window.google.maps.Map(mapRef.current!, {
              center: location,
              zoom: 16,
              mapId: "location-map",
              disableDefaultUI: false,
              zoomControl: true,
              mapTypeControl: false,
              scaleControl: true,
              streetViewControl: false,
              rotateControl: false,
              fullscreenControl: true,
            });

            // Create marker
            const markerContent = document.createElement("div");
            markerContent.innerHTML = `
              <div style="
                background: hsl(var(--primary));
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
                border-top: 8px solid hsl(var(--primary));
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
        setError("Erro ao inicializar mapa");
      }
    };

    loadGoogleMaps();

    return () => {
      // Cleanup
      if (markerInstance.current) {
        markerInstance.current.map = null;
      }
    };
  }, [address, addressNumber, venue, fullAddress]);

  const openGoogleMaps = () => {
    const query = encodeURIComponent(fullAddress);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
  };

  const openWaze = () => {
    const query = encodeURIComponent(fullAddress);
    window.open(`https://waze.com/ul?q=${query}`, "_blank");
  };

  const openNativeMaps = () => {
    const query = encodeURIComponent(fullAddress);
    // This will open the default maps app on mobile devices
    window.open(`geo:0,0?q=${query}`, "_blank");
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
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir no Google Maps
              </Button>
            )}
          </div>
        )}
      </div>

      {showOpenButtons && isLoaded && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={openGoogleMaps} className="flex-1">
            <MapPin className="h-4 w-4 mr-2" />
            Google Maps
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
