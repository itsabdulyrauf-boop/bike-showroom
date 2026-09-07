import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      <h2 className="text-2xl font-bold font-mono text-white mb-2">Page Not Found</h2>
      <p className="text-slate-400 text-sm mb-4">The requested page could not be located.</p>
      <Link
        href="/"
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all"
      >
        Return to Showroom
      </Link>
    </div>
  );
}
