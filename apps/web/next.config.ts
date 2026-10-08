import type { NextConfig } from 'next';
const config: NextConfig = {
  transpilePackages: ['@safecircle/contracts'],
  async rewrites() { return [{ source:'/api/v1/:path*',destination:`${process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000'}/v1/:path*` }]; },
  async headers() { return [{ source:'/:path*',headers:[
    {key:'Cache-Control',value:'no-store'}, {key:'Referrer-Policy',value:'no-referrer'},
    {key:'X-Content-Type-Options',value:'nosniff'}, {key:'X-Frame-Options',value:'DENY'},
    {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
    {key:'Content-Security-Policy',value:"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'"}
  ]}]; }
};
export default config;
