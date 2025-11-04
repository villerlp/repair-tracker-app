"use client";

import { useState } from "react";

export default function FixDuplicatesPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const handleFix = async () => {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/recommendations/fix-duplicates", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to fix duplicates");
      } else {
        setResult(data);
      }
    } catch (err) {
      setError("Network error: " + (err instanceof Error ? err.message : "Unknown"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            Fix Duplicate Recommendation Numbers
          </h1>
          
          <div className="mb-6">
            <p className="text-gray-600 mb-2">
              This tool will scan your recommendations for:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
              <li>Duplicate recommendation numbers (keeps oldest, renumbers rest)</li>
              <li>Empty or missing recommendation numbers</li>
            </ul>
          </div>

          <button
            onClick={handleFix}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Checking and Fixing..." : "Scan and Fix Duplicates"}
          </button>

          {error && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-md p-4">
              <h3 className="text-red-800 font-semibold mb-2">Error</h3>
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {result && (
            <div className="mt-6 space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <h3 className="text-green-800 font-semibold mb-2">
                  ✅ {result.message}
                </h3>
                
                <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-white p-3 rounded border border-green-100">
                    <div className="text-gray-600">Total Recommendations</div>
                    <div className="text-2xl font-bold text-gray-800">{result.statistics.total}</div>
                  </div>
                  <div className="bg-white p-3 rounded border border-green-100">
                    <div className="text-gray-600">Fixed</div>
                    <div className="text-2xl font-bold text-green-600">{result.statistics.fixed}</div>
                  </div>
                  <div className="bg-white p-3 rounded border border-green-100">
                    <div className="text-gray-600">Duplicates Found</div>
                    <div className="text-2xl font-bold text-orange-600">{result.statistics.duplicates}</div>
                  </div>
                  <div className="bg-white p-3 rounded border border-green-100">
                    <div className="text-gray-600">Empty Numbers</div>
                    <div className="text-2xl font-bold text-orange-600">{result.statistics.empty}</div>
                  </div>
                </div>

                {result.nextAvailable && (
                  <div className="mt-3 text-sm text-gray-600">
                    Next available number: <span className="font-mono font-semibold">{result.nextAvailable}</span>
                  </div>
                )}
              </div>

              {result.updates && result.updates.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <h4 className="text-blue-800 font-semibold mb-3">Updates Made:</h4>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {result.updates.map((update: any, idx: number) => (
                      <div key={idx} className="bg-white p-3 rounded text-sm border border-blue-100">
                        <div className="font-semibold text-gray-800 mb-1">
                          {update.title.substring(0, 60)}{update.title.length > 60 ? '...' : ''}
                        </div>
                        <div className="text-gray-600">
                          <span className="line-through text-red-600">{update.oldNumber}</span>
                          {' → '}
                          <span className="text-green-600 font-mono font-semibold">{update.newNumber}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-gray-200">
            <a
              href="/"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              ← Back to Dashboard
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
