"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export const runtime = "edge";

type Recommendation = {
  id: string;
  recommendation_number: string | null;
  title: string;
  description: string;
  priority: string;
  status: string;
  due_date: string | null;
  inspection_date: string | null;
};

export default function EditRecommendation() {
  const [recommendationNumber, setRecommendationNumber] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("pending");
  const [dueDate, setDueDate] = useState("");
  const [inspectionDate, setInspectionDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isClient, setIsClient] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !id) return;

    const checkAuthAndLoadData = async () => {
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

        // Fetch the recommendation data
        console.log('Fetching recommendation with id:', id);
        const response = await fetch(`/api/recommendations/${id}`);
        console.log('Response status:', response.status);
        
        if (response.ok) {
          const data: Recommendation = await response.json();
          console.log('Loaded recommendation:', data);
          setRecommendationNumber(data.recommendation_number || "");
          setTitle(data.title);
          setDescription(data.description);
          setPriority(data.priority);
          setStatus(data.status);
          setDueDate(data.due_date ? data.due_date.split('T')[0] : "");
          setInspectionDate(data.inspection_date ? data.inspection_date.split('T')[0] : "");
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('Failed to load recommendation:', response.status, errorData);
          setMessage(`Failed to load recommendation: ${errorData.error || 'Unknown error'}`);
          setTimeout(() => router.push("/"), 2000);
        }
      } catch (error) {
        console.error("Error loading recommendation:", error);
        setMessage("Error loading recommendation");
        setTimeout(() => router.push("/"), 2000);
      }
    };
    checkAuthAndLoadData();
  }, [router, isClient, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      // If there's no recommendation number, generate one
      let recNumber = recommendationNumber;
      if (!recNumber || recNumber.trim() === "") {
        const numberResponse = await fetch("/api/recommendations/next-number");
        if (numberResponse.ok) {
          const numberData = await numberResponse.json();
          recNumber = numberData.recommendation_number;
          setRecommendationNumber(recNumber);
        }
      }

      console.log('Submitting update for id:', id, 'with recommendation_number:', recNumber);
      const response = await fetch(`/api/recommendations/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recommendation_number: recNumber,
          title,
          description,
          priority,
          status,
          due_date: dueDate || null,
          inspection_date: inspectionDate || null,
        }),
      });

      console.log('Update response status:', response.status);

      if (!response.ok) {
        let errorMessage = `Failed to update (Status: ${response.status})`;
        try {
          const errorData = await response.json();
          console.error('Update failed with data:', errorData);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          const textError = await response.text().catch(() => 'No error details');
          console.error('Update failed with text:', textError);
          errorMessage = textError || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Update successful:', data);
      setMessage("Recommendation updated successfully!");
      setTimeout(() => router.push("/"), 2000);
    } catch (error: unknown) {
      console.error('Submit error:', error);
      const errorMessage =
        error instanceof Error ? error.message : "An error occurred";
      setMessage(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isClient) return null;

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white border border-slate-300 shadow-sm p-8">
          <div className="mb-8 border-b border-slate-200 pb-6">
            <h1 className="text-3xl font-semibold text-slate-800 tracking-tight uppercase">
              Edit Repair Recommendation
            </h1>
            <p className="mt-2 text-sm text-slate-600 font-medium">
              Update the details of this repair recommendation
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                Recommendation Number
              </label>
              <input
                type="text"
                value={recommendationNumber}
                onChange={(e) => setRecommendationNumber(e.target.value)}
                className="block w-full px-4 py-3 border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:border-slate-500 focus:bg-white transition-colors"
                placeholder="Will be auto-generated if empty"
              />
              <p className="mt-1 text-xs text-slate-500">
                Leave empty to auto-generate on save
              </p>
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
                {loading ? "Saving..." : "Save Changes"}
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
