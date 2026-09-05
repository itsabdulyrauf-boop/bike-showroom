import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white font-sans p-4">
      <h2 className="text-2xl font-bold mb-2">Page Not Found</h2>
      <p className="text-slate-400 mb-4">Could not find requested resource</p>
      <Link href="/" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-white text-sm">
        Return Home
      </Link>
    </div>
  );
}
