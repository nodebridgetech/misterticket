import { supabase } from "@/integrations/supabase/client";

type ActionType = "create" | "update" | "delete" | "login" | "logout" | "transfer";
type EntityType = "event" | "user" | "category" | "ticket" | "fee_config" | "producer";

interface LogActivityParams {
  actionType: ActionType;
  entityType: EntityType;
  entityId?: string;
  entityName?: string;
  details?: Record<string, any>;
}

export const logActivity = async ({
  actionType,
  entityType,
  entityId,
  entityName,
  details,
}: LogActivityParams) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    // Get user profile for name and phone
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("user_id", userData.user.id)
      .single();

    const { error } = await supabase.from("activity_logs").insert({
      user_id: userData.user.id,
      user_name: profile?.full_name || userData.user.email,
      user_phone: profile?.phone || null,
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      details: details || null,
    });

    if (error) {
      console.error("Error logging activity:", error);
    }
  } catch (error) {
    console.error("Error in logActivity:", error);
  }
};

export const useActivityLog = () => {
  return { logActivity };
};
