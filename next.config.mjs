/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    // Ensure pdfjs-dist is handled properly
    config.resolve.alias['pdfjs-dist/build/pdf.worker.entry'] = 'pdfjs-dist/build/pdf.worker.min.js';
    return config;
  },
  // Allow serving PDF files
  experimental: {
    serverComponentsExternalPackages: ['pdfjs-dist']
  }
};

export default nextConfig;
