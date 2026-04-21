import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TaskDifficulty {
  id: string;
  label: string;
  sort_order: number;
  is_active: boolean;
}

export interface TaskCategory {
  id: string;
  value: string;
  label: string;
  sort_order: number;
  is_active: boolean;
}

export const useTaskOptions = () => {
  const [difficulties, setDifficulties] = useState<TaskDifficulty[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [dRes, cRes] = await Promise.all([
      supabase.from("task_difficulties").select("*").order("sort_order", { ascending: true }),
      supabase.from("task_categories").select("*").order("sort_order", { ascending: true }),
    ]);
    if (dRes.data) setDifficulties(dRes.data);
    if (cRes.data) setCategories(cRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const activeDifficulties = difficulties.filter((d) => d.is_active);
  const activeCategories = categories.filter((c) => c.is_active);

  const categoryLabel = (value: string) =>
    categories.find((c) => c.value === value)?.label || value;

  return {
    difficulties,
    categories,
    activeDifficulties,
    activeCategories,
    categoryLabel,
    loading,
    refetch: fetchAll,
  };
};
