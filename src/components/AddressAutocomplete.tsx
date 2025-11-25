import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string) => void;
  label?: string;
  required?: boolean;
}

interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

export const AddressAutocomplete = ({
  value,
  onChange,
  label = "Endereço Completo",
  required = false,
}: AddressAutocompleteProps) => {
  const [cep, setCep] = useState("");
  const [loading, setLoading] = useState(false);

  const formatCep = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 5) return numbers;
    return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`;
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCep(e.target.value);
    setCep(formatted);

    // Auto-fetch when CEP is complete
    if (formatted.length === 9) {
      fetchAddress(formatted);
    }
  };

  const fetchAddress = async (cepValue: string) => {
    const cleanCep = cepValue.replace(/\D/g, "");
    
    if (cleanCep.length !== 8) return;

    setLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data: ViaCepResponse = await response.json();

      if (data.erro) {
        toast.error("CEP não encontrado");
        return;
      }

      // Format complete address
      const fullAddress = [
        data.logradouro,
        data.bairro,
        data.localidade,
        data.uf
      ].filter(Boolean).join(", ");

      onChange(fullAddress);
      toast.success("Endereço encontrado!");
    } catch (error) {
      toast.error("Erro ao buscar endereço");
      console.error("ViaCEP error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cep">
          CEP
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Input
          id="cep"
          value={cep}
          onChange={handleCepChange}
          placeholder="00000-000"
          maxLength={9}
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Input
          id="address"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Rua, bairro, cidade, estado"
          required={required}
          disabled={loading}
        />
      </div>
    </div>
  );
};
