"use client";

import React, { useEffect, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
} from "chart.js";
import Link from "next/link";
import RecommendationsTable from "./RecommendationsTable";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale
);

type Metrics = {
  overdue_count: number;
  upcoming_count: number;
  completion_rate: number;
  total_recommendations: number;
};

const mockMetrics: Metrics = {
  overdue_count: 2,
  upcoming_count: 5,
  completion_rate: 62.5,
  total_recommendations: 48,
};

export default function Dashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const base = process.env.NEXT_PUBLIC_API_BASE || "";
        const url = base
          ? `${base.replace(/\/$/, "")}/api/dashboard/metrics`
          : "/api/dashboard/metrics";
        const res = await fetch(url);
        if (!res.ok) throw new Error("Network error");
        const data = await res.json();
        setMetrics({
          overdue_count: data.overdue_count ?? 0,
          upcoming_count: data.upcoming_count ?? 0,
          completion_rate: data.completion_rate ?? 0,
          total_recommendations: data.total_recommendations ?? 0,
        });
      } catch (err) {
        // fallback to mock data if API not available
        setMetrics(mockMetrics);
      }

      // Fetch user role
      try {
        const profileRes = await fetch("/api/user/profile");
        if (profileRes.ok) {
          const profile = await profileRes.json();
          setUserRole(profile.role);

          // Fetch recommendations if user is authenticated
          try {
            const recRes = await fetch("/api/recommendations");
            if (recRes.ok) {
              const recs = await recRes.json();
              setRecommendations(recs);
            }
          } catch (err) {
            // Ignore errors
          }
        }
      } catch (err) {
        // Ignore errors
      }
    }

    load();
  }, []);

  if (!metrics) return <div className="p-6">Loading dashboard...</div>;

  const statusData = {
    labels: ["Overdue", "Due Soon", "Complete"],
    datasets: [
      {
        data: [
          metrics.overdue_count,
          metrics.upcoming_count,
          Math.round(metrics.completion_rate),
        ],
        backgroundColor: ["#ef4444", "#f59e0b", "#10b981"],
        hoverOffset: 6,
      },
    ],
  };

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <div className="p-4 bg-white rounded shadow">
          <div className="text-xs text-gray-500">Overdue</div>
          <div className="text-2xl font-bold text-red-600">
            {metrics.overdue_count}
          </div>
        </div>
        <div className="p-4 bg-white rounded shadow">
          <div className="text-xs text-gray-500">Due This Week</div>
          <div className="text-2xl font-bold text-yellow-600">
            {metrics.upcoming_count}
          </div>
        </div>
        <div className="p-4 bg-white rounded shadow">
          <div className="text-xs text-gray-500">Completion Rate</div>
          <div className="text-2xl font-bold text-green-600">
            {metrics.completion_rate}%
          </div>
        </div>
        <div className="p-4 bg-white rounded shadow">
          <div className="text-xs text-gray-500">Total</div>
          <div className="text-2xl font-bold text-sky-600">
            {metrics.total_recommendations}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-1 md:col-span-2 bg-white rounded shadow p-4">
          <h3 className="text-lg font-semibold mb-2 text-black">
            Status Distribution
          </h3>
          <div style={{ height: 300 }}>
            <Doughnut
              data={statusData}
              options={{ responsive: true, maintainAspectRatio: false }}
            />
          </div>
        </div>

        <div className="bg-white rounded shadow p-4">
          <h3 className="text-lg font-semibold mb-2 text-black">
            Quick Actions
          </h3>
          <div className="flex flex-col gap-2">
            <Link href="/add">
              <button className="btn btn-primary px-3 py-2 bg-sky-600 text-white rounded hover:bg-sky-700">
                Add Recommendation
              </button>
            </Link>
            {userRole && (
              <button
                onClick={() => {
                  document
                    .getElementById("recommendations-section")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
                className="btn btn-secondary px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                View Recommendations
              </button>
            )}
            {userRole === "manager" || userRole === "admin" ? (
              <Link href="/reports">
                <button className="btn btn-secondary px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                  View Reports
                </button>
              </Link>
            ) : null}
            <button className="btn btn-outline px-3 py-2 border rounded text-black">
              Export CSV
            </button>
            <button className="btn btn-outline px-3 py-2 border rounded text-black">
              Upload Attachments
            </button>
          </div>
        </div>
      </div>

      {userRole && (
        <div className="mt-6" id="recommendations-section">
          <h3 className="text-lg font-semibold mb-4 text-black">
            Recommendation Status Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              {
                status: "pending",
                label: "Pending",
                color: "bg-gray-100 text-gray-800",
              },
              {
                status: "in_progress",
                label: "In Progress",
                color: "bg-blue-100 text-blue-800",
              },
              {
                status: "completed",
                label: "Completed",
                color: "bg-green-100 text-green-800",
              },
              {
                status: "overdue",
                label: "Overdue",
                color: "bg-red-100 text-red-800",
              },
            ].map(({ status, label, color }) => {
              const count = recommendations.filter(
                (r) => r.status === status
              ).length;
              return (
                <div key={status} className="p-4 bg-white rounded shadow">
                  <div className="text-xs text-gray-500">{label}</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {count}
                  </div>
                </div>
              );
            })}
          </div>
          <h3 className="text-lg font-semibold mb-4 text-black">
            All Recommendations
          </h3>
          <div className="mb-6">
            <table className="min-w-full divide-y divide-gray-200 bg-white rounded shadow">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Repair Recommendations
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Count
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    All Recommendations
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {recommendations.length}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {recommendations.length > 0 ? (
            <RecommendationsTable
              recommendations={recommendations}
              showAll={true}
            />
          ) : (
            <p className="text-center text-gray-500 mt-6">
              No recommendations found.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
