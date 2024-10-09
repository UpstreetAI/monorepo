"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assetPath = void 0;
// nextjs@14 bundler may attempt to execute this during SSR and crash
var isWeb = typeof window !== "undefined" && typeof window.document !== "undefined";
var currentScript = isWeb
    ? window.document.currentScript
    : null;
var basePath = "/";
if (currentScript) {
    basePath = currentScript.src
        .replace(/#.*$/, "")
        .replace(/\?.*$/, "")
        .replace(/\/[^\/]+$/, "/");
}
var assetPath = function (file) {
    return basePath + file;
};
exports.assetPath = assetPath;
