import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({
  entryPoints: ["src/latex-text.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  write: false,
});
const { latexToUnicode } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

assert.equal(latexToUnicode(String.raw`$n \approx d$ 时测试误差达到峰值`), "n ≈ d 时测试误差达到峰值");
assert.equal(
  latexToUnicode(String.raw`$\hat{\beta} = (X^\top X + \lambda I)^{-1} X^\top y$`),
  "β̂ = (Xᵀ X + λ I)⁻¹ Xᵀ y",
);
assert.equal(
  latexToUnicode(String.raw`$\mathbb{E}\lVert \hat{\beta} - \beta \rVert_2^2 \le \frac{\sigma^2 d}{n - d - 1}$`),
  "𝔼‖ β̂ - β ‖₂² ≤ (σ² d)/(n - d - 1)",
);
assert.equal(latexToUnicode(String.raw`误差 $\sqrt{\mathrm{MSE}}$ 与 $\lambda = 10^{-3}$`), "误差 √MSE 与 λ = 10⁻³");
assert.equal(latexToUnicode(String.raw`$$\sum_{i=1}^{n} x_i^2$$`), "∑ᵢ₌₁ⁿ xᵢ²");
assert.equal(latexToUnicode(String.raw`$\text{test error}_{n}$，\(\alpha \to 0\)`), "test errorₙ，α → 0");
assert.equal(latexToUnicode(String.raw`$\bar{x} \pm \sigma$ 与 $x_{\max}$`), "x̄ ± σ 与 xₘₐₓ");
assert.equal(latexToUnicode(String.raw`$x_{\mathrm{best}}$`), "x_(best)");
assert.equal(latexToUnicode("成本介于 $5 and $10"), "成本介于 $5 and $10");
assert.equal(latexToUnicode("没有公式的普通文本"), "没有公式的普通文本");

console.log("LaTeX terminal text smoke test passed");
