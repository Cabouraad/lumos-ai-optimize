import { supabase } from "@/integrations/supabase/client";

export async function getOrgId(): Promise<string> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error("Not signed in");
  }

  const { data, error } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (error || !data?.org_id) {
    throw new Error("Onboarding incomplete: no org membership");
  }

  return data.org_id;
}