import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface AddressAutocompleteProps {
  address: string;
  number: string;
  complement: string;
  onAddressChange: (address: string) => void;
  onNumberChange: (number: string) => void;
  onComplementChange: (complement: string) => void;
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
  address,
  number,
  complement,
  onAddressChange,
  onNumberChange,
  onComplementChange,
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

      // Format complete address (street, neighborhood, city, state)
      const fullAddress = [
        data.logradouro,
        data.bairro,
        data.localidade,
        data.uf
      ].filter(Boolean).join(", ");

      onAddressChange(fullAddress);
      
      // If ViaCEP returns a complement, fill it
      if (data.complemento) {
        onComplementChange(data.complemento);
      }
      
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
          Endereço
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Input
          id="address"
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder="Rua, bairro, cidade, estado"
          required={required}
          disabled={loading}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="number">
            Número
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Input
            id="number"
            value={number}
            onChange={(e) => onNumberChange(e.target.value)}
            placeholder="123"
            required={required}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="complement">
            Complemento
          </Label>
          <Input
            id="complement"
            value={complement}
            onChange={(e) => onComplementChange(e.target.value)}
            placeholder="Apto 45, Bloco B"
            disabled={loading}
          />
        </div>
      </div>
    </div>
  );
};
