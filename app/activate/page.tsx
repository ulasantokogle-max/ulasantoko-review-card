import ActivationForm from "@/components/ActivationForm";
export default function ActivatePage(){
  return <main className="min-h-screen px-5 py-10">
    <div className="mx-auto max-w-md">
      <h1 className="text-3xl font-bold">Aktivasi Kartu</h1>
      <p className="mt-2 text-gray-600">Masukkan kode kartu dan link Google Review bisnis Anda.</p>
      <ActivationForm/>
    </div>
  </main>;
}