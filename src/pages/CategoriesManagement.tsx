import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { CategoryManager } from "@/components/CategoryManager";

const CategoriesManagement = () => {
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
        <h1 className="text-3xl font-bold text-foreground">Gestão de Categorias</h1>
        <p className="text-muted-foreground mt-2">
          Gerencie as categorias de eventos da plataforma
        </p>
      </div>
      <CategoryManager />
    </div>
  );
};

export default CategoriesManagement;
