module.exports = function extensionSwcLoader(source) {
  const done = this.async();
  import("next/dist/build/swc/index.js").then(async ({ loadBindings, transform }) => {
    await loadBindings();
    return transform(source, {
    filename: this.resourcePath,
    jsc: { parser: { syntax: "typescript", tsx: this.resourcePath.endsWith(".tsx") }, transform: { react: { runtime: "automatic" } }, target: "es2022" },
    module: { type: "es6" },
    sourceMaps: false,
    });
  }).then(result => done(null, result.code), done);
};
