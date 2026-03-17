import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Profile {
  display_name: string;
  avatar_url: string | null;
  student_id: string | null;
  email: string | null;
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    if (!user) { setProfile(null); setLoading(false); return; }
    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, student_id, email")
      .eq("id", user.id)
      .single();
    setProfile(data);
    setLoading(false);
  };

  useEffect(() => { fetchProfile(); }, [user]);

  return { profile, loading, refetch: fetchProfile };
}
