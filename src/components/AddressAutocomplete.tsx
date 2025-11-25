import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string) => void;
  label?: string;
  required?: boolean;
}

export const AddressAutocomplete = ({
  value,
  onChange,
  label = "Endereço Completo",
  required = false,
}: AddressAutocompleteProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
    
    if (!apiKey) {
      console.error("Google Places API key not found");
      return;
    }

    // Load Google Maps script
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initAutocomplete`;
    script.async = true;
    script.defer = true;

    // Define the callback function
    (window as any).initAutocomplete = () => {
      if (!inputRef.current) return;

      const autocomplete = new google.maps.places.Autocomplete(
        inputRef.current,
        {
          types: ["address"],
          componentRestrictions: { country: "br" },
          fields: ["formatted_address", "address_components", "geometry"],
        }
      );

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        
        if (place.formatted_address) {
          onChange(place.formatted_address);
        }
      });
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup
      const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`);
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
      delete (window as any).initAutocomplete;
    };
  }, [onChange]);

  return (
    <div className="space-y-2">
      <Label htmlFor="address">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Input
        ref={inputRef}
        id="address"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Digite o endereço e selecione uma sugestão"
        required={required}
      />
    </div>
  );
};
