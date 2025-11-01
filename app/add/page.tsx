"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export const runtime = "edge";

type ExtractedRecommendation = {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  dueDate: string;
  inspectionDate: string;
  recommendation_number?: string;
};

export default function AddRecommendation() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("pending_approval");
  const [dueDate, setDueDate] = useState("");
  const [inspectionDate, setInspectionDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isClient, setIsClient] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [recommendationId, setRecommendationId] = useState("");
  const [extractedRecs, setExtractedRecs] = useState<ExtractedRecommendation[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfMessage, setPdfMessage] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
    // Fetch the next recommendation number from API
    const fetchNextNumber = async () => {
      try {
        const response = await fetch('/api/recommendations/next-number');
        if (response.ok) {
          const data = await response.json();
          setRecommendationId(data.recommendation_number);
        } else {
          // Fallback if API fails
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          setRecommendationId(`${year}-${month}-0001`);
        }
      } catch (error) {
        console.error('Error fetching next number:', error);
        // Fallback if API fails
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        setRecommendationId(`${year}-${month}-0001`);
      }
    };
    fetchNextNumber();
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
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        router.push("/login");
      }
    };
    checkAuth();
  }, [router, isClient]);

  const handlePDFDrop = async (file: File) => {
    setPdfLoading(true);
    setPdfMessage("");
    try {
      const arrayBuffer = await file.arrayBuffer();
      const response = await fetch('/api/pdf/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/pdf' },
        body: arrayBuffer,
      });
      const data = await response.json();
      if (response.ok && data.records) {
        // Convert to editable format
        const extracted = data.records.map((rec: any, idx: number) => ({
          id: `temp-${Date.now()}-${idx}`,
          title: rec.title || '',
          description: rec.description || '',
          priority: rec.priority || 'medium',
          status: rec.status || 'pending_approval',
          dueDate: rec.due_date || '',
          inspectionDate: rec.inspection_date || '',
          recommendation_number: rec.recommendation_number,
        }));
        setExtractedRecs(extracted);
        setPdfMessage(`✓ Extracted ${extracted.length} recommendations. Review and edit below.`);
      } else {
        setPdfMessage(`✗ ${data.error || 'Failed to extract'}`);
      }
    } catch (error) {
      console.error('PDF extraction error:', error);
      setPdfMessage('✗ Failed to process PDF');
    } finally {
      setPdfLoading(false);
      setTimeout(() => setPdfMessage(''), 8000);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      handlePDFDrop(file);
    } else {
      setPdfMessage('✗ Please drop a PDF file');
      setTimeout(() => setPdfMessage(''), 3000);
    }
  };

  const handleBatchInsert = async () => {
    if (extractedRecs.length === 0) return;
    setLoading(true);
    setMessage("");
    let successCount = 0;
    let failCount = 0;

    for (const rec of extractedRecs) {
      try {
        // Generate a new recommendation number for each item
        let recNumber = rec.recommendation_number;
        if (!recNumber) {
          const numberResponse = await fetch("/api/recommendations/next-number");
          if (numberResponse.ok) {
            const numberData = await numberResponse.json();
            recNumber = numberData.nextNumber;
          }
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
            attachments: [],
          }),
        });
        if (response.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        console.error('Insert error:', error);
        failCount++;
      }
    }

    setMessage(`✓ Inserted ${successCount} recommendations${failCount > 0 ? `, ${failCount} failed` : ''}`);
    setExtractedRecs([]);
    setLoading(false);
    setTimeout(() => setMessage(""), 5000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      // Upload attachments first if any
      let uploadedAttachments: Array<{name: string, url: string, size: number}> = [];
      
      if (attachments.length > 0) {
        const formData = new FormData();
        attachments.forEach((file) => {
          formData.append('files', file);
        });
        
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          uploadedAttachments = uploadData.files;
        } else {
          console.error('Failed to upload attachments');
        }
      }

      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recommendation_number: recommendationId,
          title,
          description,
          priority,
          status,
          due_date: dueDate || null,
          inspection_date: inspectionDate || null,
          attachments: uploadedAttachments,
        }),
      });

      if (!response.ok) {
        let errorData;
        const contentType = response.headers.get("content-type");
        
        try {
          if (contentType && contentType.includes("application/json")) {
            errorData = await response.json();
          } else {
            const text = await response.text();
            errorData = { error: text || 'Unknown error' };
          }
        } catch (e) {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        
        console.error('API Error:', errorData);
        console.error('Response status:', response.status, response.statusText);
        throw new Error(errorData.error || "Failed to add recommendation");
      }

      const data = await response.json();
      console.log('Recommendation added successfully:', data);
      setMessage("Recommendation added successfully!");
      
      // Clear form and generate new recommendation number
      setTitle("");
      setDescription("");
      setPriority("medium");
      setStatus("pending_approval");
      setDueDate("");
      setInspectionDate("");
      setAttachments([]);
      
      // Fetch new recommendation number
      try {
        const nextNumResponse = await fetch('/api/recommendations/next-number');
        if (nextNumResponse.ok) {
          const nextData = await nextNumResponse.json();
          setRecommendationId(nextData.recommendation_number);
        }
      } catch (err) {
        console.error('Error fetching next number:', err);
      }
      
      setTimeout(() => setMessage(""), 3000);
    } catch (error: unknown) {
      console.error('Submit error:', error);
      const errorMessage =
        error instanceof Error ? error.message : "An error occurred";
      setMessage(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* PDF Drop Zone */}
        <div className="bg-white border border-slate-300 shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-800 uppercase tracking-tight mb-3">
            Quick Import from PDF
          </h2>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed ${
              dragOver ? 'border-slate-500 bg-slate-100' : 'border-slate-300 bg-slate-50'
            } p-8 text-center transition-colors cursor-pointer`}
            onClick={() => document.getElementById('pdf-file-input')?.click()}
          >
            <svg
              className="mx-auto h-12 w-12 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="mt-2 text-sm font-semibold text-slate-700 uppercase tracking-wide">
              {pdfLoading ? 'Processing PDF...' : 'Drop PDF here or click to upload'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Extract repair recommendations from PDF automatically
            </p>
            <input
              id="pdf-file-input"
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePDFDrop(file);
              }}
            />
          </div>
          {pdfMessage && (
            <div
              className={`mt-3 p-3 text-sm ${
                pdfMessage.startsWith('✓')
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {pdfMessage}
            </div>
          )}
        </div>

        {/* Extracted Recommendations Preview */}
        {extractedRecs.length > 0 && (
          <div className="bg-white border border-slate-300 shadow-sm p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-800 uppercase tracking-tight">
                Extracted Recommendations ({extractedRecs.length})
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={handleBatchInsert}
                  disabled={loading}
                  className="px-4 py-2 bg-slate-700 text-white text-xs font-semibold uppercase tracking-wide hover:bg-slate-800 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Inserting...' : 'Insert All'}
                </button>
                <button
                  onClick={() => setExtractedRecs([])}
                  className="px-4 py-2 border border-slate-400 text-slate-700 text-xs font-semibold uppercase tracking-wide hover:bg-slate-50 transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {extractedRecs.map((rec, idx) => (
                <div key={rec.id} className="border border-slate-200 p-4 bg-slate-50">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-bold text-slate-500 uppercase">#{idx + 1}</span>
                    <button
                      onClick={() => setExtractedRecs(extractedRecs.filter(r => r.id !== rec.id))}
                      className="text-slate-500 hover:text-slate-700"
                    >
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase">Title</label>
                      <input
                        type="text"
                        value={rec.title}
                        onChange={(e) => {
                          const updated = [...extractedRecs];
                          updated[idx].title = e.target.value;
                          setExtractedRecs(updated);
                        }}
                        className="w-full px-3 py-2 border border-slate-300 text-sm bg-white text-black"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase">Description</label>
                      <textarea
                        value={rec.description}
                        onChange={(e) => {
                          const updated = [...extractedRecs];
                          updated[idx].description = e.target.value;
                          setExtractedRecs(updated);
                        }}
                        rows={2}
                        className="w-full px-3 py-2 border border-slate-300 text-sm bg-white text-black"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase">Priority</label>
                      <select
                        value={rec.priority}
                        onChange={(e) => {
                          const updated = [...extractedRecs];
                          updated[idx].priority = e.target.value;
                          setExtractedRecs(updated);
                        }}
                        className="w-full px-3 py-2 border border-slate-300 text-sm bg-white text-black"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase">Status</label>
                      <select
                        value={rec.status}
                        onChange={(e) => {
                          const updated = [...extractedRecs];
                          updated[idx].status = e.target.value;
                          setExtractedRecs(updated);
                        }}
                        className="w-full px-3 py-2 border border-slate-300 text-sm bg-white text-black"
                      >
                        <option value="pending_approval">Pending Approval</option>
                        <option value="approved">Approved</option>
                        <option value="not_approved">Not Approved</option>
                        <option value="deferred">Deferred</option>
                        <option value="temporary_repair">Temporary Repair</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white border border-slate-300 shadow-sm p-8">
          <div className="mb-8 border-b border-slate-200 pb-6">
            <h1 className="text-3xl font-semibold text-slate-800 tracking-tight uppercase">
              Repair Recommendation Form
            </h1>
            <p className="mt-2 text-sm text-slate-600 font-medium">
              Complete all required fields to submit a new repair recommendation
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6" suppressHydrationWarning>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                Recommendation Number
              </label>
              <input
                type="text"
                value={recommendationId}
                readOnly
                className="block w-full px-4 py-3 border border-slate-300 bg-slate-200 text-slate-700 font-mono font-semibold cursor-not-allowed"
                placeholder="Auto-generated"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                Title <span className="text-slate-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="block w-full px-4 py-3 border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:border-slate-500 focus:bg-white transition-colors"
                placeholder="Enter recommendation title"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                Description <span className="text-slate-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={4}
                className="block w-full px-4 py-3 border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:border-slate-500 focus:bg-white transition-colors"
                placeholder="Provide a detailed description of the repair recommendation"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="block w-full px-4 py-3 border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:border-slate-500 focus:bg-white transition-colors"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="block w-full px-4 py-3 border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:border-slate-500 focus:bg-white transition-colors"
                >
                  <option value="pending_approval">Pending Approval</option>
                  <option value="approved">Approved</option>
                  <option value="not_approved">Not Approved</option>
                  <option value="deferred">Deferred</option>
                  <option value="temporary_repair">Temporary Repair</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                  Inspection Date
                </label>
                <input
                  type="date"
                  value={inspectionDate}
                  onChange={(e) => setInspectionDate(e.target.value)}
                  className="block w-full px-4 py-3 border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:border-slate-500 focus:bg-white transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="block w-full px-4 py-3 border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:border-slate-500 focus:bg-white transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                Upload Attachments
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed bg-slate-50 hover:border-slate-400 hover:bg-slate-100 transition-colors">
                <div className="space-y-1 text-center">
              <svg
                className="mx-auto h-12 w-12 text-slate-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="flex text-sm text-slate-600">
                <label
                  htmlFor="file-upload"
                  className="relative cursor-pointer bg-white px-2 py-1 font-semibold text-slate-700 hover:text-slate-900 focus-within:outline-none"
                >
                  <span>Upload files</span>
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      if (e.target.files) {
                        setAttachments(Array.from(e.target.files));
                      }
                    }}
                    accept="image/*,.pdf,.doc,.docx,.txt"
                  />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                PNG, JPG, PDF, DOC up to 10MB
              </p>
            </div>
          </div>
          {attachments.length > 0 && (
            <div className="mt-2 space-y-2">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Selected files:</p>
              {attachments.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-slate-50 border border-slate-200 px-3 py-2"
                >
                  <div className="flex items-center space-x-2">
                    <svg
                      className="h-5 w-5 text-slate-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-sm text-slate-700 font-medium">{file.name}</span>
                    <span className="text-xs text-slate-500">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachments(attachments.filter((_, i) => i !== index));
                    }}
                    className="text-slate-500 hover:text-slate-700"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              ))}
              </div>
            )}
            </div>
            {message && (
              <div
                className={`p-4 border ${
                  message.includes("successfully")
                    ? "bg-slate-50 text-slate-800 border-slate-400"
                    : "bg-slate-50 text-slate-800 border-slate-400"
                }`}
              >
                <p className="text-sm font-semibold uppercase tracking-wide">{message}</p>
              </div>
            )}
            <div className="flex gap-4 pt-4 border-t border-slate-200">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex justify-center py-3 px-6 border border-slate-700 text-sm font-semibold uppercase tracking-wide text-white bg-slate-700 hover:bg-slate-800 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Processing..." : "Submit Recommendation"}
              </button>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="flex-1 py-3 px-6 border border-slate-400 text-sm font-semibold uppercase tracking-wide text-slate-700 bg-white hover:bg-slate-50 focus:outline-none transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
