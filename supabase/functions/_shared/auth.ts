export async function getUserOrgId(supabase: any): Promise<string> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error("Authentication required");
  }

  const { data, error } = await supabase
    .from("users")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (error || !data?.org_id) {
    throw new Error("User not properly onboarded");
  }

  return data.org_id;
}

export async function requireOwnerRole(supabase: any): Promise<string> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error("Authentication required");
  }

  const { data, error } = await supabase
    .from("users")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (error || !data?.org_id) {
    throw new Error("User not properly onboarded");
  }

  if (data.role !== 'owner') {
    throw new Error("Owner role required for this operation");
  }

  return data.org_id;
}