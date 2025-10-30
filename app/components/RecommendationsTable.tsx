import React from "react";

type Recommendation = {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  due_date: string | null;
};

type RecommendationsTableProps = {
  recommendations: Recommendation[];
  showAll?: boolean;
};

export default function RecommendationsTable({
  recommendations,
  showAll = false,
}: RecommendationsTableProps) {
  const displayRecs = showAll ? recommendations : recommendations.slice(0, 5);

  return (
    <div className="bg-white rounded shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Section
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Area/Component
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Repair Recommendation
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Remarks
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {displayRecs.map((rec) => (
            <tr key={rec.id}>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
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
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    rec.status === "completed"
                      ? "bg-green-100 text-green-800"
                      : rec.status === "in_progress"
                      ? "bg-blue-100 text-blue-800"
                      : rec.status === "overdue"
                      ? "bg-red-100 text-red-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {rec.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {rec.due_date
                  ? new Date(rec.due_date).toLocaleDateString()
                  : "N/A"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
