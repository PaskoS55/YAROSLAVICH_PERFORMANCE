import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

export const dynamic = 'force-dynamic';
import { AppShell } from '../components/layout/AppShell';
import { PRODUCT_IDENTITY } from '@pasko-performance/core/product';
import { prisma } from '../lib/prisma';

const inter = Inter({
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: PRODUCT_IDENTITY.display,
  description: 'Платформа для тестирования, мониторинга и управления физической подготовкой волейбольных команд',
  icons: {
    icon: [
      { url: '/brand/pasko/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/brand/pasko/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/pasko/favicon-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/brand/pasko/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/brand/pasko/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/brand/pasko/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const organization = await prisma.organization.findFirst({
    where: { deletedAt: null },
    select: { name: true },
  });
  const organizationName = organization?.name ?? 'Организация';
  return (
    <html lang="ru">
      <body className={inter.className}>
        <AppShell organizationName={organizationName}>{children}</AppShell>
      </body>
    </html>
  );
}
