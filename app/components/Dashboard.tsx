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

type Recommendation = {
  id: string;
  recommendation_number?: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  inspection_date: string | null;
  due_date: string | null;
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
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [googlesheetsLoading, setGooglesheetsLoading] = useState(false);
  const [googlesheetsMessage, setGooglesheetsMessage] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfMessage, setPdfMessage] = useState("");

  const exportToGoogleSheets = async () => {
    if (recommendations.length === 0) {
      setGooglesheetsMessage("No recommendations to export");
      setTimeout(() => setGooglesheetsMessage(""), 3000);
      return;
    }

    setGooglesheetsLoading(true);
    setGooglesheetsMessage("");

    try {
      const response = await fetch('/api/googlesheets/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recommendations }),
      });

      const data = await response.json();

      if (response.ok) {
        setGooglesheetsMessage(`✓ ${data.message}`);
      } else {
        setGooglesheetsMessage(`✗ ${data.error}`);
      }
    } catch (error) {
      console.error('Google Sheets export error:', error);
      setGooglesheetsMessage("✗ Failed to export to Google Sheets");
    } finally {
      setGooglesheetsLoading(false);
      setTimeout(() => setGooglesheetsMessage(""), 5000);
    }
  };

  const importFromPDFFile = async (file: File | null) => {
    if (!file) {
      setPdfMessage('No file selected');
      setTimeout(() => setPdfMessage(''), 3000);
      return;
    }

    setPdfLoading(true);
    setPdfMessage('');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const response = await fetch('/api/pdf/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/pdf',
        },
        body: arrayBuffer,
      });

      const data = await response.json();
      if (response.ok) {
        setPdfMessage(`✓ Imported ${data.imported} recommendations`);
        // Refresh recommendations list
        try {
          const recRes = await fetch('/api/recommendations');
          if (recRes.ok) {
            const recs = await recRes.json();
            setRecommendations(recs);
          }
        } catch (e) {
          console.warn('Failed to refresh recommendations after import', e);
        }
      } else {
        setPdfMessage(`✗ ${data.error || 'Import failed'}`);
      }
    } catch (error) {
      console.error('PDF import error:', error);
      setPdfMessage('✗ Failed to import PDF');
    } finally {
      setPdfLoading(false);
      setTimeout(() => setPdfMessage(''), 6000);
    }
  };

  const exportToExcel = () => {
    // Helper function to capitalize each word
    const capitalizeWords = (str: string) => {
      return str.replace(/_/g, ' ').split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
    };

    // Create CSV content
    const headers = ['Recommendation Number', 'Priority', 'Title', 'Description', 'Status', 'Inspection Date', 'Due Date'];
    const csvContent = [
      headers.join(','),
      ...recommendations.map(rec => [
        (rec as any).recommendation_number || rec.id,
        capitalizeWords(rec.priority),
        `"${rec.title.replace(/"/g, '""')}"`,
        `"${rec.description.replace(/"/g, '""')}"`,
        capitalizeWords(rec.status),
        rec.inspection_date || 'N/A',
        rec.due_date || 'N/A'
      ].join(','))
    ].join('\n');

    // Create and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `recommendations_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportToPDF = () => {
    // Create a printable HTML version
    const printWindow = window.open('', '', 'height=600,width=800');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Repair Recommendations Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #334155; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f1f5f9; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9fafb; }
            .status { text-transform: capitalize; }
            @media print {
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>Repair Recommendations Report</h1>
          <p>Generated: ${new Date().toLocaleString()}</p>
          <table>
            <thead>
              <tr>
                <th>Rec #</th>
                <th>Priority</th>
                <th>Title</th>
                <th>Description</th>
                <th>Status</th>
                <th>Inspection Date</th>
                <th>Due Date</th>
              </tr>
            </thead>
            <tbody>
              ${recommendations.map(rec => `
                <tr>
                  <td>${(rec as any).recommendation_number || rec.id}</td>
                  <td style="text-transform: capitalize;">${rec.priority}</td>
                  <td>${rec.title}</td>
                  <td>${rec.description}</td>
                  <td class="status">${rec.status.replace('_', ' ')}</td>
                  <td>${rec.inspection_date ? new Date(rec.inspection_date).toLocaleDateString() : 'N/A'}</td>
                  <td>${rec.due_date ? new Date(rec.due_date).toLocaleDateString() : 'N/A'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <button onclick="window.print()" style="margin-top: 20px; padding: 10px 20px; background: #475569; color: white; border: none; cursor: pointer;">Print to PDF</button>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

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
      } catch {
        // fallback to mock data if API not available
        setMetrics(mockMetrics);
      }

      // Fetch user role
      try {
        const profileRes = await fetch("/api/user/profile");
        if (profileRes.ok) {
          const profile = await profileRes.json();
          setUserRole(profile.role);
        } else {
          console.log('Profile fetch failed:', profileRes.status);
        }
      } catch (error) {
        console.log('Error fetching profile:', error);
      }

      // Always try to fetch recommendations (API handles its own auth)
      try {
        const recRes = await fetch("/api/recommendations");
        if (recRes.ok) {
          const recs = await recRes.json();
          console.log("Fetched recommendations:", recs);
          setRecommendations(recs);
        } else if (recRes.status === 401) {
          console.log('User not authenticated, redirecting to login');
          window.location.href = '/login';
          return;
        } else {
          console.log('Failed to fetch recommendations:', recRes.status);
          // For testing, show mock data if API fails
          setRecommendations([
            {
              id: '1',
              title: 'Test Recommendation',
              description: 'This is a test recommendation',
              priority: 'high',
              status: 'pending',
              inspection_date: null,
              due_date: '2025-12-31'
            }
          ]);
        }
      } catch (error) {
        console.log('Error fetching recommendations:', error);
        // For testing, show mock data if API fails
        setRecommendations([
          {
            id: '1',
            title: 'Test Recommendation',
            description: 'This is a test recommendation',
            priority: 'high',
            status: 'pending',
            inspection_date: null,
            due_date: '2025-12-31'
          }
        ]);
      }
    }

    load();

    // Refresh data when window regains focus (user comes back from add page)
    const handleFocus = () => {
      console.log("Window focused, refreshing data...");
      load();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
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
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
        <div className="p-4 bg-white border border-slate-300 shadow-sm">
          <div className="text-sm text-slate-600 uppercase tracking-wide font-semibold">Overdue</div>
          <div className="text-2xl font-bold text-slate-800">
            {metrics.overdue_count}
          </div>
        </div>
        <div className="p-4 bg-white border border-slate-300 shadow-sm">
          <div className="text-sm text-slate-600 uppercase tracking-wide font-semibold">Due Soon</div>
          <div className="text-2xl font-bold text-slate-800">
            {metrics.upcoming_count}
          </div>
        </div>
        <div className="p-4 bg-white border border-slate-300 shadow-sm">
          <div className="text-sm text-slate-600 uppercase tracking-wide font-semibold">Complete</div>
          <div className="text-2xl font-bold text-slate-800">
            {metrics.completion_rate}%
          </div>
        </div>
        <div className="p-4 bg-white border border-slate-300 shadow-sm">
          <div className="text-sm text-slate-600 uppercase tracking-wide font-semibold mb-2">Status</div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Pending Approval:</span>
              <span className="font-bold text-slate-800">{recommendations.filter(r => r.status === 'pending_approval').length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Approved:</span>
              <span className="font-bold text-slate-800">{recommendations.filter(r => r.status === 'approved').length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Not Approved:</span>
              <span className="font-bold text-slate-800">{recommendations.filter(r => r.status === 'not_approved').length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Deferred:</span>
              <span className="font-bold text-slate-800">{recommendations.filter(r => r.status === 'deferred').length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Temporary Repair:</span>
              <span className="font-bold text-slate-800">{recommendations.filter(r => r.status === 'temporary_repair').length}</span>
            </div>
          </div>
        </div>
        <div className="p-4 bg-white border border-slate-300 shadow-sm">
          <div className="text-sm text-slate-600 uppercase tracking-wide font-semibold">Total Recommendations</div>
          <div className="text-2xl font-bold text-slate-800">
            {metrics.total_recommendations}
          </div>
        </div>
      </div>

      <div className="w-1/6">
        <div className="bg-white border border-slate-300 shadow-sm p-4">
          <h3 className="text-lg font-semibold mb-2 text-slate-800 uppercase tracking-tight">
            Quick Actions
          </h3>
          <div className="flex flex-col gap-1">
            <Link 
              href="/add"
              className="btn btn-primary px-2 py-2 text-xs bg-slate-700 text-white hover:bg-slate-800 w-full uppercase tracking-wide font-semibold transition-colors text-center"
            >
              Add Recommendation
            </Link>
            {userRole && (
              <button
                onClick={() => {
                  document
                    .getElementById("recommendations-section")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
                className="btn btn-secondary px-2 py-2 text-xs bg-slate-600 text-white hover:bg-slate-700 w-full uppercase tracking-wide font-semibold transition-colors"
              >
                View Recommendations
              </button>
            )}
            {userRole === "manager" || userRole === "admin" ? (
              <Link 
                href="/reports"
                className="btn btn-secondary px-2 py-2 text-xs bg-slate-600 text-white hover:bg-slate-700 w-full uppercase tracking-wide font-semibold transition-colors text-center"
              >
                View Reports
              </Link>
            ) : null}
            <button 
              onClick={exportToExcel}
              className="btn btn-outline px-2 py-2 text-xs border border-slate-400 text-slate-700 w-full hover:bg-slate-50 uppercase tracking-wide font-semibold transition-colors"
            >
              Export Excel
            </button>
            <button 
              onClick={exportToPDF}
              className="btn btn-outline px-2 py-2 text-xs border border-slate-400 text-slate-700 w-full hover:bg-slate-50 uppercase tracking-wide font-semibold transition-colors"
            >
              Export PDF
            </button>
            <input
              id="pdf-import-input"
              type="file"
              accept="application/pdf"
              className="hidden"
            />
            <button
              onClick={async () => {
                const input = document.getElementById('pdf-import-input') as HTMLInputElement | null
                input?.click()
                input?.addEventListener('change', async () => {
                  const file = input?.files?.[0] || null
                  await importFromPDFFile(file)
                }, { once: true })
              }}
              disabled={pdfLoading}
              className="btn btn-outline px-2 py-2 text-xs border border-slate-400 text-slate-700 w-full hover:bg-slate-50 uppercase tracking-wide font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pdfLoading ? 'Importing...' : 'Import from PDF'}
            </button>
            <button 
              onClick={exportToGoogleSheets}
              disabled={googlesheetsLoading}
              className="btn btn-outline px-2 py-2 text-xs border border-blue-400 text-blue-700 w-full hover:bg-blue-50 uppercase tracking-wide font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {googlesheetsLoading ? 'Exporting...' : 'Export to Google Sheets'}
            </button>
          </div>
          {googlesheetsMessage && (
            <div className={`mt-2 text-xs p-2 rounded ${googlesheetsMessage.startsWith('✓') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {googlesheetsMessage}
            </div>
          )}
        </div>
      </div>

      {/* Recommendations Table Below Dashboard */}
      <div className="mt-6 bg-white border border-slate-300 shadow-sm p-4">
        <h3 className="text-lg font-semibold mb-4 text-slate-800 uppercase tracking-tight">
          Recent Recommendations
        </h3>
        {recommendations.length > 0 ? (
          <RecommendationsTable
            recommendations={recommendations.slice(0, 5)}
            showAll={false}
          />
        ) : (
          <p className="text-center text-slate-600 py-4 uppercase tracking-wide text-sm">
            No recommendations found.
          </p>
        )}
        <div className="mt-4 text-center">
          <button
            onClick={() => {
              document
                .getElementById("recommendations-section")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
            className="px-4 py-2 bg-slate-700 text-white hover:bg-slate-800 text-sm uppercase tracking-wide font-semibold transition-colors"
          >
            View All Recommendations
          </button>
        </div>
      </div>

      <div className="mt-6" id="recommendations-section">
        <h3 className="text-lg font-semibold mb-4 text-slate-800 uppercase tracking-tight">
          Recommendation Status Summary
        </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {[
              {
                status: "pending_approval",
                label: "Pending Approval",
                color: "bg-slate-100 text-slate-800",
              },
              {
                status: "approved",
                label: "Approved",
                color: "bg-slate-100 text-slate-800",
              },
              {
                status: "not_approved",
                label: "Not Approved",
                color: "bg-slate-100 text-slate-800",
              },
              {
                status: "deferred",
                label: "Deferred",
                color: "bg-slate-100 text-slate-800",
              },
              {
                status: "temporary_repair",
                label: "Temporary Repair",
                color: "bg-slate-100 text-slate-800",
              },
            ].map(({ status, label }) => {
              const count = recommendations.filter(
                (r) => r.status === status
              ).length;
              return (
                <div key={status} className="p-4 bg-white border border-slate-300 shadow-sm">
                  <div className="text-xs text-slate-600 uppercase tracking-wide font-semibold">{label}</div>
                  <div className="text-2xl font-bold text-slate-800">
                    {count}
                  </div>
                </div>
              );
            })}
          </div>
          <h3 className="text-lg font-semibold mb-4 text-slate-800 uppercase tracking-tight">
            All Recommendations
          </h3>
          <div className="mb-6">
            <table className="min-w-full divide-y divide-slate-300 bg-white border border-slate-300 shadow-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Total Repair Recommendations
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Count
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">
                    All Recommendations
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
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
            <p className="text-center text-slate-600 mt-6 uppercase tracking-wide text-sm">
              No recommendations found.
            </p>
          )}
        </div>
    </div>
  );
}
