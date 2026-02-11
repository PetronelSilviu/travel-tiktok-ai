/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // <--- FĂRĂ SLASH-URI AICI! (Activăm exportul static)
  images: {
    unoptimized: true
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
      ignoreDuringBuilds: true,
  }
};

export default nextConfig;