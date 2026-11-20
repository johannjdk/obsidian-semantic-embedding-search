import esbuild from "esbuild";
import fs from "fs";
import process from "process";

const prod = process.argv[2] === "production";

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
  ],
  format: "cjs",
  target: "es2020",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "dist/main.js",
  minify: prod,
});

function copyAssets() {
  fs.mkdirSync("dist", { recursive: true });
  fs.copyFileSync("manifest.json", "dist/manifest.json");
  fs.copyFileSync("styles.css", "dist/styles.css");
}

if (prod) {
  await context.rebuild();
  copyAssets();
  process.exit(0);
} else {
  copyAssets();
  await context.watch();
}
