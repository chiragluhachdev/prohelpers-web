"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Spinner } from "@/components/ui";

/** `/admin` is just a doorway — send people to the dashboard or to sign in. */
export default function AdminIndex() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? "/admin/dashboard" : "/admin/login");
  }, [user, loading, router]);

  return <Spinner label="Starting Pro Helper Admin" />;
}
