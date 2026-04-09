import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "Arkimind",
    identifier: "arkimind.electrobun.dev",
    version: "0.1.0",
  },
  build: {
    // Vite builds to dist/, we copy from there
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/assets": "views/mainview/assets",
    },
    // Ignore Vite output in watch mode — HMR handles view rebuilds separately
    watchIgnore: ["dist/**"],
    mac: {
      bundleCEF: false,
    },
    linux: {
      bundleCEF: false,
      icon: "assets/icon.png",
    },
    win: {
      bundleCEF: false,
      icon: "assets/icon.ico",
    },
  },
  release: {
    baseUrl:
      "https://github.com/davidnussio/arkimind-app/releases/latest/download",
    generatePatch: true,
  },
} satisfies ElectrobunConfig;
