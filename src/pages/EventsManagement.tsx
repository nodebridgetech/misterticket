import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { EventManagementTab } from "@/components/EventManagementTab";

const EventsManagement = () => {
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
        <h1 className="text-3xl font-bold text-foreground">Gestão de Eventos</h1>
        <p className="text-muted-foreground mt-2">
          Gerencie todos os eventos da plataforma
        </p>
      </div>
      <EventManagementTab />
    </div>
  );
};

export default EventsManagement;
