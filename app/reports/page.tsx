"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RecommendationsTable from "@/app/components/RecommendationsTable";

export const runtime = "edge";

type Recommendation = {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  due_date: string;
  created_at: string;
  user_email: string;
};

export default function Reports() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const checkAuth = async () => {
      try {
        const { createBrowserClient } = await import("@supabase/ssr");
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
          router.push("/login");
          return;
        }

        const supabase = createBrowserClient(supabaseUrl, supabaseKey);
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }
        fetchRecommendations();
      } catch (error) {
        console.error("Auth check failed:", error);
        router.push("/login");
      }
    };
    checkAuth();
  }, [router, isClient]);

  const fetchRecommendations = async () => {
    try {
      const response = await fetch("/api/recommendations");
      if (!response.ok) throw new Error("Failed to fetch reports");
      const data = await response.json();
      setRecommendations(data);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch reports";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6">Loading reports...</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Manager Reports</h1>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Back to Dashboard
        </button>
      </div>

      <RecommendationsTable recommendations={recommendations} showAll={true} />

      {recommendations.length === 0 && (
        <p className="text-center text-gray-500 mt-6">
          No recommendations found.
        </p>
      )}

      {recommendations.length === 0 && (
        <p className="text-center text-gray-500 mt-6">
          No recommendations found.
        </p>
      )}
    </div>
  );
}
