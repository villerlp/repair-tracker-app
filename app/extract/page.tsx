"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ExtractedRecommendation = {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  dueDate: string;
  inspectionDate: string;
  recommendation_number?: string;
  selected: boolean;
};

export default function ExtractPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [recommendations, setRecommendations] = useState<ExtractedRecommendation[]>([]);
  const [message, setMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = (selectedFile: File | null) => {
    if (!selectedFile) return;
    
    // Accept PDF, Excel, and CSV files
    const allowedTypes = [
      "application/pdf",
      "application/vnd.ms-excel", // .xls
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "text/csv"
    ];
    
    const isAllowed = allowedTypes.includes(selectedFile.type) || 
                      selectedFile.name.endsWith('.pdf') ||
                      selectedFile.name.endsWith('.xlsx') ||
                      selectedFile.name.endsWith('.xls') ||
                      selectedFile.name.endsWith('.csv');
    
    if (!isAllowed) {
      setMessage("Please select a PDF, Excel (.xlsx, .xls), or CSV file");
      setTimeout(() => setMessage(""), 3000);
      return;
    }
    
    setFile(selectedFile);
    setRecommendations([]);
    setMessage("");
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const droppedFile = e.dataTransfer.files[0];
    handleFileSelect(droppedFile);
  };

  const extractRecommendations = async () => {
    if (!file) return;

    setExtracting(true);
    setMessage("");

    try {
      const response = await fetch("/api/pdf/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/pdf",
        },
        body: file,
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(`Error: ${data.error || "Failed to extract"}`);
        setTimeout(() => setMessage(""), 5000);
      } else {
        const extracted = data.records.map((rec: any) => ({
          ...rec,
          selected: true, // Select all by default
        }));
        setRecommendations(extracted);
        setMessage(`✓ Extracted ${extracted.length} recommendation(s)`);
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (error) {
      console.error("Extract error:", error);
      setMessage("Failed to extract recommendations");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setExtracting(false);
    }
  };

  const toggleSelection = (id: string) => {
    setRecommendations(recs =>
      recs.map(rec =>
        rec.id === id ? { ...rec, selected: !rec.selected } : rec
      )
    );
  };

  const toggleSelectAll = () => {
    const allSelected = recommendations.every(rec => rec.selected);
    setRecommendations(recs =>
      recs.map(rec => ({ ...rec, selected: !allSelected }))
    );
  };

  const updateRecommendation = (id: string, field: string, value: any) => {
    setRecommendations(recs =>
      recs.map(rec =>
        rec.id === id ? { ...rec, [field]: value } : rec
      )
    );
  };

  const deleteRecommendation = (id: string) => {
    setRecommendations(recs => recs.filter(rec => rec.id !== id));
  };

  const addSingleRecommendation = async (rec: ExtractedRecommendation) => {
    setImporting(true);
    setMessage("");

    try {
      // Get next recommendation number
      const numberResponse = await fetch("/api/recommendations/next-number");
      let recNumber = undefined;
      if (numberResponse.ok) {
        const numberData = await numberResponse.json();
        recNumber = numberData.recommendation_number;
      }

      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendation_number: recNumber,
          title: rec.title,
          description: rec.description,
          priority: rec.priority,
          status: rec.status,
          due_date: rec.dueDate || null,
          inspection_date: rec.inspectionDate || null,
        }),
      });

      if (response.ok) {
        setMessage(`✓ Added: ${rec.title.substring(0, 50)}...`);
        // Remove from list after successful add
        setRecommendations(recs => recs.filter(r => r.id !== rec.id));
        setTimeout(() => setMessage(""), 3000);
      } else {
        const data = await response.json();
        setMessage(`❌ Failed to add: ${data.error || 'Unknown error'}`);
        setTimeout(() => setMessage(""), 5000);
      }
    } catch (error) {
      console.error("Add error:", error);
      setMessage("Failed to add recommendation");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setImporting(false);
    }
  };

  const importSelected = async () => {
    const selected = recommendations.filter(rec => rec.selected);
    
    if (selected.length === 0) {
      setMessage("Please select at least one recommendation");
      setTimeout(() => setMessage(""), 3000);
      return;
    }

    setImporting(true);
    setMessage("");

    let successCount = 0;
    let failCount = 0;

    for (const rec of selected) {
      try {
        // Get next recommendation number
        const numberResponse = await fetch("/api/recommendations/next-number");
        let recNumber = undefined;
        if (numberResponse.ok) {
          const numberData = await numberResponse.json();
          recNumber = numberData.recommendation_number;
        }

        const response = await fetch("/api/recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recommendation_number: recNumber,
            title: rec.title,
            description: rec.description,
            priority: rec.priority,
            status: rec.status,
            due_date: rec.dueDate || null,
            inspection_date: rec.inspectionDate || null,
          }),
        });

        if (response.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        console.error("Import error:", error);
        failCount++;
      }
    }

    setMessage(
      `✓ Imported ${successCount} recommendation(s)${failCount > 0 ? `, ${failCount} failed` : ""}`
    );
    
    // Remove successfully imported recommendations
    if (successCount > 0) {
      setRecommendations(recs => recs.filter(rec => !rec.selected));
    }
    
    setImporting(false);
    
    // Redirect to dashboard after a delay if all imported
    if (recommendations.filter(rec => rec.selected).length === selected.length) {
      setTimeout(() => {
        router.push("/");
      }, 2000);
    }
  };

  const addAllRecommendations = async () => {
    if (recommendations.length === 0) {
      setMessage("No recommendations to add");
      setTimeout(() => setMessage(""), 3000);
      return;
    }

    setImporting(true);
    setMessage("");

    let successCount = 0;
    let failCount = 0;

    for (const rec of recommendations) {
      try {
        // Get next recommendation number
        const numberResponse = await fetch("/api/recommendations/next-number");
        let recNumber = undefined;
        if (numberResponse.ok) {
          const numberData = await numberResponse.json();
          recNumber = numberData.recommendation_number;
        }

        const response = await fetch("/api/recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recommendation_number: recNumber,
            title: rec.title,
            description: rec.description,
            priority: rec.priority,
            status: rec.status,
            due_date: rec.dueDate || null,
            inspection_date: rec.inspectionDate || null,
          }),
        });

        if (response.ok) {
          successCount++;
          setMessage(`Adding... ${successCount}/${recommendations.length}`);
        } else {
          failCount++;
        }
      } catch (error) {
        console.error("Add error:", error);
        failCount++;
      }
    }

    setMessage(
      `✓ Added ${successCount} recommendation(s)${failCount > 0 ? `, ${failCount} failed` : ""}`
    );
    
    // Clear all recommendations after successful bulk add
    if (successCount > 0) {
      setRecommendations([]);
    }
    
    setImporting(false);
    
    // Redirect to dashboard after a delay
    setTimeout(() => {
      router.push("/");
    }, 2000);
  };

  const selectedCount = recommendations.filter(rec => rec.selected).length;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              Extract Recommendations
            </h1>
            <p className="text-gray-600 mt-1">
              Upload a PDF to extract and review multiple recommendations before importing
            </p>
          </div>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Step 1: Upload Document
          </h2>
          
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 bg-gray-50"
            }`}
          >
            <svg
              className="mx-auto h-12 w-12 text-gray-400 mb-4"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="mb-4">
              <label className="cursor-pointer">
                <span className="text-blue-600 hover:text-blue-700 font-semibold">
                  Click to upload
                </span>
                <span className="text-gray-600"> or drag and drop</span>
                <input
                  type="file"
                  accept="application/pdf,.pdf,.xlsx,.xls,.csv"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-sm text-gray-500">PDF, Excel (.xlsx, .xls), or CSV files</p>
          </div>

          {file && (
            <div className="mt-4 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                </svg>
                <div>
                  <p className="font-semibold text-gray-800">{file.name}</p>
                  <p className="text-sm text-gray-600">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={extractRecommendations}
                disabled={extracting}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold transition-colors"
              >
                {extracting ? "Extracting..." : "Extract Recommendations"}
              </button>
            </div>
          )}

          {message && (
            <div
              className={`mt-4 p-3 rounded ${
                message.includes("Error") || message.includes("Failed")
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-green-50 text-green-700 border border-green-200"
              }`}
            >
              {message}
            </div>
          )}
        </div>

        {/* Extracted Recommendations Section */}
        {recommendations.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                Step 2: Review & Add ({recommendations.length} recommendation{recommendations.length !== 1 ? 's' : ''} extracted)
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={addAllRecommendations}
                  disabled={importing || recommendations.length === 0}
                  className="px-4 py-2 text-sm font-bold text-white bg-gradient-to-b from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 active:from-blue-700 active:to-blue-900 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed shadow-[0_4px_0_0_rgba(29,78,216,1)] hover:shadow-[0_2px_0_0_rgba(29,78,216,1)] active:shadow-[0_1px_0_0_rgba(29,78,216,1)] hover:translate-y-[2px] active:translate-y-[3px] disabled:shadow-none disabled:translate-y-0 transition-all rounded uppercase tracking-wide"
                >
                  {importing ? `Adding... (${recommendations.length})` : `Add All (${recommendations.length})`}
                </button>
                <button
                  onClick={toggleSelectAll}
                  className="px-3 py-1.5 text-sm font-semibold text-slate-700 bg-slate-100 border border-slate-300 hover:bg-slate-200 transition-colors"
                >
                  {recommendations.every(rec => rec.selected) ? "Deselect All" : "Select All"}
                </button>
                <button
                  onClick={importSelected}
                  disabled={importing || selectedCount === 0}
                  className="px-4 py-1.5 text-sm bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold transition-colors"
                >
                  {importing ? "Importing..." : `Import Selected (${selectedCount})`}
                </button>
              </div>
            </div>

            {/* Table View */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      #
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recommendations.map((rec, index) => (
                    <tr key={rec.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900">
                        <input
                          type="text"
                          value={rec.title}
                          onChange={(e) => updateRecommendation(rec.id, "title", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs text-black focus:outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">
                        <textarea
                          value={rec.description}
                          onChange={(e) => updateRecommendation(rec.id, "description", e.target.value)}
                          rows={2}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs text-black focus:outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <select
                          value={rec.priority}
                          onChange={(e) => updateRecommendation(rec.id, "priority", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs text-black focus:outline-none focus:border-blue-500"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="critical">Critical</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <select
                          value={rec.status}
                          onChange={(e) => updateRecommendation(rec.id, "status", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs text-black focus:outline-none focus:border-blue-500"
                        >
                          <option value="pending_approval">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="not_approved">Not Approved</option>
                          <option value="deferred">Deferred</option>
                          <option value="temporary_repair">Temporary</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => addSingleRecommendation(rec)}
                            disabled={importing}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-b from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 active:from-green-700 active:to-green-900 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed shadow-[0_3px_0_0_rgba(21,128,61,1)] hover:shadow-[0_1px_0_0_rgba(21,128,61,1)] active:shadow-[0_0px_0_0_rgba(21,128,61,1)] hover:translate-y-[2px] active:translate-y-[3px] disabled:shadow-none disabled:translate-y-0 transition-all rounded uppercase tracking-wide"
                            title="Add this recommendation"
                          >
                            Add
                          </button>
                          <button
                            onClick={() => deleteRecommendation(rec.id)}
                            disabled={importing}
                            className="px-2 py-1.5 text-xs font-semibold text-white bg-gradient-to-b from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 active:from-red-700 active:to-red-900 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed shadow-[0_3px_0_0_rgba(127,29,29,1)] hover:shadow-[0_1px_0_0_rgba(127,29,29,1)] active:shadow-[0_0px_0_0_rgba(127,29,29,1)] hover:translate-y-[2px] active:translate-y-[3px] disabled:shadow-none disabled:translate-y-0 transition-all rounded uppercase tracking-wide"
                            title="Remove from list"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>


          </div>
        )}
      </div>
    </div>
  );
}
