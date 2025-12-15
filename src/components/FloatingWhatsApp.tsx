import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface WhatsAppConfig {
  phone_number: string;
  default_message: string;
}

export const FloatingWhatsApp = () => {
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase
        .from("whatsapp_config")
        .select("phone_number, default_message")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (data) {
        setConfig(data);
      }
    };

    fetchConfig();
  }, []);

  if (!config) return null;

  const handleClick = () => {
    const phone = config.phone_number.replace(/\D/g, "");
    const message = encodeURIComponent(config.default_message);
    window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
  };

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:ring-offset-2"
      aria-label="Contato via WhatsApp"
    >
      <MessageCircle className="h-7 w-7" />
    </button>
  );
};
