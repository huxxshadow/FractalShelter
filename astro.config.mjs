// astro.config.mjs
import { defineConfig } from 'astro/config';
import tailwindcss from "@tailwindcss/vite";
import icon from "astro-icon";
import react from "@astrojs/react";

export default defineConfig({
    vite: {
        plugins: [tailwindcss()],
    },
    integrations: [icon(), react()],
    // 开启 i18n 支持
    i18n: {
        defaultLocale: 'en',
        locales: ['en', 'zh'],
        routing: {
            // false 表示默认语言 (en) 放在 /pages 根目录
            // 其他语言放在对应文件夹，比如 /pages/zh/
            prefixDefaultLocale: false
        }
    }
});