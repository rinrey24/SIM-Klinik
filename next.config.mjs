/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
    // Hindari memuat seluruh barrel ikon/lib → compile dev & bundle lebih ramping
    optimizePackageImports: ['lucide-react', '@tanstack/react-query', '@tanstack/react-table', 'recharts', 'date-fns'],
  },
  serverExternalPackages: ['argon2', 'postgres'],
};
export default nextConfig;
