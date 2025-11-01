"use client";

import React, { useState, useMemo } from "react";
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

type SortField = 'recommendation_number' | 'priority' | 'title' | 'status' | 'inspection_date' | 'due_date';
type SortDirection = 'asc' | 'desc';

export default function RecommendationsTable({
  recommendations,
  showAll = false,
}: RecommendationsTableProps) {
  const router = useRouter();
  const [sortField, setSortField] = useState<SortField>('recommendation_number');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const priorityOrder: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedRecs = useMemo(() => {
    const sorted = [...recommendations].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case 'recommendation_number':
          aVal = a.recommendation_number || '';
          bVal = b.recommendation_number || '';
          break;
        case 'priority':
          aVal = priorityOrder[a.priority] || 0;
          bVal = priorityOrder[b.priority] || 0;
          break;
        case 'title':
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case 'status':
          aVal = a.status.toLowerCase();
          bVal = b.status.toLowerCase();
          break;
        case 'inspection_date':
          aVal = a.inspection_date ? new Date(a.inspection_date).getTime() : 0;
          bVal = b.inspection_date ? new Date(b.inspection_date).getTime() : 0;
          break;
        case 'due_date':
          aVal = a.due_date ? new Date(a.due_date).getTime() : 0;
          bVal = b.due_date ? new Date(b.due_date).getTime() : 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [recommendations, sortField, sortDirection, priorityOrder]);

  const displayRecs = showAll ? sortedRecs : sortedRecs.slice(0, 5);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="w-3 h-3 ml-1 inline opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    if (sortDirection === 'asc') {
      return (
        <svg className="w-3 h-3 ml-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      );
    }
    return (
      <svg className="w-3 h-3 ml-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <div className="bg-white rounded shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th 
              className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
              onClick={() => handleSort('recommendation_number')}
            >
              Rec # <SortIcon field="recommendation_number" />
            </th>
            <th 
              className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
              onClick={() => handleSort('priority')}
            >
              Priority <SortIcon field="priority" />
            </th>
            <th 
              className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
              onClick={() => handleSort('title')}
            >
              Title <SortIcon field="title" />
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Description
            </th>
            <th 
              className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
              onClick={() => handleSort('status')}
            >
              Status <SortIcon field="status" />
            </th>
            <th 
              className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
              onClick={() => handleSort('inspection_date')}
            >
              Inspection <SortIcon field="inspection_date" />
            </th>
            <th 
              className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
              onClick={() => handleSort('due_date')}
            >
              Due <SortIcon field="due_date" />
            </th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Files
            </th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {displayRecs.map((rec) => (
            <tr key={rec.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 whitespace-nowrap text-xs font-mono font-semibold text-gray-900">
                {rec.recommendation_number || 'N/A'}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900 capitalize">
                {rec.priority}
              </td>
              <td className="px-3 py-2 text-xs text-gray-500 max-w-xs truncate">
                {rec.title}
              </td>
              <td className="px-3 py-2 text-xs text-gray-500 max-w-md">
                <div className="line-clamp-2">
                  {rec.description}
                </div>
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                <span
                  className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded capitalize ${
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
              <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                {rec.inspection_date
                  ? new Date(rec.inspection_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                  : "—"}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                {rec.due_date
                  ? new Date(rec.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                  : "—"}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-center">
                {rec.has_attachments ? (
                  <button
                    onClick={() => router.push(`/edit/${rec.id}`)}
                    className="inline-flex items-center text-slate-600 hover:text-slate-800 transition-colors"
                    title="View attachments"
                  >
                    <svg
                      className="w-4 h-4"
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
              <td className="px-3 py-2 whitespace-nowrap text-center">
                <button
                  onClick={() => router.push(`/edit/${rec.id}`)}
                  className="px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300 hover:bg-slate-200 uppercase tracking-wide transition-colors"
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
