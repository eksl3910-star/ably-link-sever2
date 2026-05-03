// Type declarations for Cloudflare Workers + D1 environment
// Referenced in next.config.ts via @cloudflare/next-on-pages

interface CloudflareEnv {
  DB: D1Database;
  ADMIN_TOGGLE_PASS?: string;
  ADMIN_BASIC_USER?: string;
  ADMIN_BASIC_PASS?: string;
}

declare module "*.svg" {
  const content: string;
  export default content;
}
