"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Complaint = {
  id: string;
  feedback_page_id: string | null;
  customer_name: string | null;
  is_anonymous: boolean;
  message: string;
  status: string;
  created_at: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

export default function AdminComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadComplaints() {
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("feedback_complaints")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("LOAD_COMPLAINTS_ERROR:", error);
      setErrorMessage("Data keluhan gagal dimuat.");
      setLoading(false);
      return;
    }

    setComplaints(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadComplaints();
  }, []);

  async function updateStatus(
    id: string,
    status: string
  ) {
    const { error } = await supabase
      .from("feedback_complaints")
      .update({ status })
      .eq("id", id);

    if (error) {
      console.error("UPDATE_COMPLAINT_ERROR:", error);
      alert("Status gagal diperbarui.");
      return;
    }

    setComplaints((current) =>
      current.map((complaint) =>
        complaint.id === id
          ? { ...complaint, status }
          : complaint
      )
    );
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function getStatusClass(status: string) {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";

      case "reviewed":
        return "bg-blue-100 text-blue-800";

      case "resolved":
        return "bg-green-100 text-green-800";

      case "rejected":
        return "bg-red-100 text-red-800";

      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">

        {/* HEADER */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Complaint Management
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Kelola keluhan dan masukan pelanggan.
          </p>
        </div>

        {/* ERROR */}
        {errorMessage && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {/* SUMMARY */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Total
            </p>

            <p className="mt-2 text-2xl font-bold text-gray-900">
              {complaints.length}
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Pending
            </p>

            <p className="mt-2 text-2xl font-bold text-yellow-600">
              {
                complaints.filter(
                  (item) => item.status === "pending"
                ).length
              }
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Reviewed
            </p>

            <p className="mt-2 text-2xl font-bold text-blue-600">
              {
                complaints.filter(
                  (item) => item.status === "reviewed"
                ).length
              }
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Resolved
            </p>

            <p className="mt-2 text-2xl font-bold text-green-600">
              {
                complaints.filter(
                  (item) => item.status === "resolved"
                ).length
              }
            </p>
          </div>

        </div>

        {/* TABLE */}
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">

          <div className="flex items-center justify-between border-b p-5">
            <div>
              <h2 className="font-semibold text-gray-900">
                Daftar Keluhan
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Keluhan terbaru ditampilkan paling atas.
              </p>
            </div>

            <button
              onClick={loadComplaints}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-gray-500">
              Memuat data keluhan...
            </div>
          ) : complaints.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">
              Belum ada keluhan.
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full text-left text-sm">

                <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-5 py-4">
                      Tanggal
                    </th>

                    <th className="px-5 py-4">
                      Pelanggan
                    </th>

                    <th className="px-5 py-4">
                      Keluhan
                    </th>

                    <th className="px-5 py-4">
                      Status
                    </th>

                    <th className="px-5 py-4">
                      Aksi
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">

                  {complaints.map((complaint) => (

                    <tr
                      key={complaint.id}
                      className="hover:bg-gray-50"
                    >

                      <td className="whitespace-nowrap px-5 py-4 text-gray-500">
                        {formatDate(complaint.created_at)}
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-medium text-gray-900">
                          {complaint.is_anonymous
                            ? "Anonim"
                            : complaint.customer_name || "-"}
                        </div>
                      </td>

                      <td className="max-w-md px-5 py-4">
                        <p className="line-clamp-2 text-gray-700">
                          {complaint.message}
                        </p>
                      </td>

                      <td className="px-5 py-4">

                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusClass(
                            complaint.status
                          )}`}
                        >
                          {complaint.status}
                        </span>

                      </td>

                      <td className="px-5 py-4">

                        <select
                          value={complaint.status}
                          onChange={(event) =>
                            updateStatus(
                              complaint.id,
                              event.target.value
                            )
                          }
                          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                        >
                          <option value="pending">
                            Pending
                          </option>

                          <option value="reviewed">
                            Reviewed
                          </option>

                          <option value="resolved">
                            Resolved
                          </option>

                          <option value="rejected">
                            Rejected
                          </option>
                        </select>

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>
          )}

        </div>

      </div>
    </main>
  );
}
