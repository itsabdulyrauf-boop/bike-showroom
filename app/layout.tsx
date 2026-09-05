import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Bike Showroom Management & POS System',
  description: 'Offline-first bike showroom inventory management, quick POS checkout, invoice printing, and expense tracking with Cloud sync in PKR.',
  openGraph: {
    title: 'Remix Bike Showroom Management & POS System',
    description: 'Offline-first bike showroom inventory management, quick POS checkout, invoice printing, and expense tracking with Cloud sync in PKR.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
