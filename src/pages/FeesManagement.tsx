import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { FeeConfigTab } from "@/components/FeeConfigTab";

const FeesManagement = () => {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || userRole !== "admin") {
      navigate("/");
    }
  }, [user, userRole, navigate]);

  if (!user || userRole !== "admin") {
    return null;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Configuração de Taxas</h1>
        <p className="text-muted-foreground mt-2">
          Configure as taxas da plataforma e gateway de pagamento
        </p>
      </div>
      <FeeConfigTab />
    </div>
  );
};

export default FeesManagement;
