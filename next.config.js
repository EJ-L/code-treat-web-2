/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  
  // Optimize output file tracing to exclude cache and unnecessary files
  outputFileTracingExcludes: {
    '*': [
      'node_modules/@swc/core-linux-x64-gnu',
      'node_modules/@swc/core-linux-x64-musl',
      'node_modules/@esbuild/linux-x64',
      '.next/cache/**/*',
      '.next/server/chunks/**/*',
      'node_modules/.cache/**/*',
      '.vercel/**/*',
      'scripts/**/*',
      'data/**/*',
      'new_dataset/**/*'
    ]
  },
  
  outputFileTracingIncludes: {
    '/api/**/*': ['./public/data/**/*']
  },
  
  // Configure output to minimize function size
  output: 'standalone',
  
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Note: unsafe-inline/eval needed for Next.js dev
              "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
              "font-src 'self' fonts.gstatic.com",
              "img-src 'self' data: https:",
              "connect-src 'self' https://api.github.com",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
      // API routes get additional headers
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
    ];
  },
  
  // swcMinify is enabled by default in Next.js 13+ and this option is deprecated
  webpack: (config) => {
    // 优化 webpack 配置
    config.optimization = {
      ...config.optimization,
      moduleIds: 'deterministic',
      chunkIds: 'deterministic'
    }
    return config
  }
}

module.exports = nextConfig
  