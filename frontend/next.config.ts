import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  serverExternalPackages: ["lightningcss"],
  // ใน Next.js 15+, turbopack เป็น Top-level config และใช้ชื่อ 'turbopack' 
  // เราใช้ (nextConfig as any) เพื่อเลี่ยงปัญหา TS ฟ้องในขณะที่ฟีเจอร์นี้ยังใหม่ครับ
  ...({
    turbopack: {
      resolveAlias: {
        "@": path.resolve(__dirname, "./src"),
        "@/*": path.resolve(__dirname, "./src/*"),
      },
    },
  } as any),
};

export default nextConfig;
