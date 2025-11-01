"use client";

import React from "react";
import { useRouter } from "next/navigation";

type Recommendation = {
  id: string;
  recommendation_number?: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  due_date: string | null;
  inspection_date: string | null;
  has_attachments?: boolean;
};

type RecommendationsTableProps = {
  recommendations: Recommendation[];
  showAll?: boolean;
};

export default function RecommendationsTable({
  recommendations,
  showAll = false,
}: RecommendationsTableProps) {
  const router = useRouter();
  const displayRecs = showAll ? recommendations : recommendations.slice(0, 5);

  return (
    <div className="bg-white rounded shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Recommendation Number
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Priority
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Title
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Description
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Inspection Date
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Due Date
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Attachments
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {displayRecs.map((rec) => (
            <tr key={rec.id}>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-semibold text-gray-900">
                {rec.recommendation_number || 'N/A'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">
                {rec.priority}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {rec.title}
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {rec.description}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full capitalize ${
                    rec.status === "completed"
                      ? "bg-green-100 text-green-800"
                      : rec.status === "in_progress"
                      ? "bg-blue-100 text-blue-800"
                      : rec.status === "overdue"
                      ? "bg-red-100 text-red-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {rec.status.replace('_', ' ')}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {rec.inspection_date
                  ? new Date(rec.inspection_date).toLocaleDateString()
                  : "N/A"}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {rec.due_date
                  ? new Date(rec.due_date).toLocaleDateString()
                  : "N/A"}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-center">
                {rec.has_attachments ? (
                  <button
                    onClick={() => router.push(`/edit/${rec.id}`)}
                    className="inline-flex items-center text-slate-600 hover:text-slate-800 transition-colors"
                    title="View attachments"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                      />
                    </svg>
                  </button>
                ) : (
                  <span className="text-xs text-gray-400">—</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-center">
                <button
                  onClick={() => router.push(`/edit/${rec.id}`)}
                  className="px-3 py-1 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300 hover:bg-slate-200 uppercase tracking-wide transition-colors"
                  title="Edit recommendation"
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
