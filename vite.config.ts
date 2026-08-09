import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

/**
 * Chặn build khi thiếu biến môi trường Supabase.
 *
 * Vite NHÚNG biến VITE_ vào bundle lúc build. Thiếu biến thì build vẫn "thành
 * công" nhưng cho ra bundle chứa `undefined`, và createClient ném lỗi ngay lúc
 * NẠP MODULE — trước khi React render, nên không ErrorBoundary nào đỡ được.
 * Người dùng chỉ thấy màn hình trắng với "supabaseUrl is required".
 *
 * Đúng một sự cố như vậy đã xảy ra khi .env bị bỏ khỏi repo mà biến chưa được
 * khai ở nền tảng build. Guard này biến "site chết im lặng" thành "build đỏ
 * ngay", tức là hỏng ở chỗ rẻ nhất để phát hiện.
 *
 * Chỉ áp cho `build` — `dev` vẫn chạy được để người mới clone còn vào sửa .env.
 */
function requireSupabaseEnv(): PluginOption {
  const REQUIRED = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"];
  return {
    name: "require-supabase-env",
    apply: "build",
    configResolved(config) {
      const missing = REQUIRED.filter((k) => !config.env[k]);
      if (missing.length > 0) {
        throw new Error(
          `\n\n[build bị chặn] Thiếu biến môi trường: ${missing.join(", ")}\n\n` +
            `Vite nhúng biến VITE_ vào bundle lúc build, nên build thiếu biến sẽ\n` +
            `cho ra một site chết ("supabaseUrl is required") chứ không báo gì.\n\n` +
            `Cách xử lý:\n` +
            `  • máy local  : chép .env.example thành .env rồi điền giá trị\n` +
            `  • Vercel/CI  : khai biến ở phần Environment Variables của nền tảng\n`,
        );
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    requireSupabaseEnv(),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["pwa-icon-512.png", "pwa-icon-192.png"],
      manifest: {
        name: "BĐS Marketplace - Broker Portal",
        short_name: "BĐS Broker",
        description: "Nền tảng quản lý bất động sản chuyên nghiệp",
        theme_color: "#0EA5E9",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        icons: [
          {
            src: "/pwa-icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "/pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ],
        start_url: "/broker/dashboard",
        scope: "/broker/"
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        // pdfmake + font Roboto ~1.8MB, chỉ dùng khi xuất hồ sơ ra PDF ở
        // /portal. PWA lại có scope /broker/, nên precache chúng là bắt mọi
        // người cài app tải thừa 1.8MB. Để runtime tự nạp khi cần.
        globIgnores: ["**/{pdfmake,vfs_fonts}-*.js"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              }
            }
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Tách vendor để cache line ỔN ĐỊNH giữa các lần deploy. Trước đây
        // react + 30 package radix + react-query + supabase-js nằm chung khối
        // với code ứng dụng, nên sửa MỘT dòng code là toàn bộ ~475 kB gzip bị
        // cache-bust và user phải tải lại từ đầu.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          // react + react-dom + scheduler PHẢI cùng một chunk: tách rời chúng
          // gây lỗi thứ tự khởi tạo (react-dom đọc internals của react).
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
            return "react-vendor";
          }
          if (id.includes("react-router")) return "react-vendor";

          if (id.includes("@radix-ui")) return "radix-vendor";
          if (id.includes("@tanstack")) return "data-vendor";
          if (id.includes("@supabase")) return "data-vendor";

          // recharts/leaflet/pdfmake/xlsx đã tự tách theo lazy import — để
          // Rollup tự quyết, đừng gom vào vendor chung kẻo kéo lại vào entry.
        },
      },
    },
  },
  // Pre-bundle deps that are only reached from lazy routes/components (e.g. the
  // carousel/embla slider). Without this, Vite discovers them mid-session and
  // re-optimizes, which 504s in-flight requests ("Outdated Optimize Dep").
  optimizeDeps: {
    include: ["embla-carousel-react"],
  },
}));
