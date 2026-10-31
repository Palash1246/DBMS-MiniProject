import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ParkSmart | Smart Parking Bengaluru',
  description: 'Book My Parking - Smart urban parking reservation system for Bengaluru',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

