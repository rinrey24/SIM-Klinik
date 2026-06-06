/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverActions: { bodySizeLimit: '2mb' } },
  serverExternalPackages: ['argon2', 'postgres'],
};
export default nextConfig;
