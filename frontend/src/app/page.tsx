"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth().then(() => {
      if (isAuthenticated) {
        router.push("/chat");
      } else {
        router.push("/login");
      }
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-app-bg">
      <div className="animate-spin w-8 h-8 border-2 border-brand-red border-t-transparent rounded-full" />
    </div>
  );
}
