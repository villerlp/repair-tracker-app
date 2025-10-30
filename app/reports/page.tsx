"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase";
import RecommendationsTable from "@/app/components/RecommendationsTable";

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
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      fetchRecommendations();
    };
    checkAuth();
  }, [supabase, router]);

  const fetchRecommendations = async () => {
    try {
      const response = await fetch("/api/recommendations");
      if (!response.ok) throw new Error("Failed to fetch reports");
      const data = await response.json();
      setRecommendations(data);
    } catch (error: any) {
      setError(error.message);
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
