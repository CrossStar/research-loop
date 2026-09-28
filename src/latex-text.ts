/**
 * Best-effort TeX → Unicode for terminal display. Files and agent-facing text keep the original TeX;
 * this only makes formulas readable where MathJax is unavailable.
 */

const SYMBOLS: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η",
  theta: "θ", vartheta: "ϑ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π",
  rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ", phi: "φ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
  approx: "≈", sim: "∼", simeq: "≃", cong: "≅", equiv: "≡", neq: "≠", ne: "≠", le: "≤", leq: "≤",
  ge: "≥", geq: "≥", ll: "≪", gg: "≫", times: "×", cdot: "·", pm: "±", mp: "∓", div: "÷", infty: "∞",
  propto: "∝", sum: "∑", prod: "∏", int: "∫", partial: "∂", nabla: "∇", in: "∈", notin: "∉",
  subset: "⊂", subseteq: "⊆", cup: "∪", cap: "∩", forall: "∀", exists: "∃", neg: "¬", land: "∧", lor: "∨",
  to: "→", rightarrow: "→", leftarrow: "←", Rightarrow: "⇒", implies: "⇒", iff: "⇔", mapsto: "↦",
  lvert: "|", rvert: "|", vert: "|", mid: "|", lVert: "‖", rVert: "‖", Vert: "‖", langle: "⟨", rangle: "⟩",
  ldots: "…", cdots: "⋯", dots: "…", circ: "∘", star: "⋆", ast: "∗", top: "⊤", perp: "⊥", emptyset: "∅",
  quad: " ", qquad: "  ", ",": " ", ":": " ", ";": " ", "!": "", " ": " ",
};
const BLACKBOARD: Record<string, string> = { R: "ℝ", N: "ℕ", Z: "ℤ", Q: "ℚ", C: "ℂ", E: "𝔼", P: "ℙ" };
const ACCENTS: Record<string, string> = { hat: "̂", widehat: "̂", bar: "̄", overline: "̄", tilde: "̃", widetilde: "̃", vec: "⃗", dot: "̇" };
const TEXT_WRAPPERS = new Set(["text", "mathrm", "mathbf", "mathit", "mathsf", "mathtt", "mathcal", "boldsymbol", "operatorname", "textbf", "textit"]);
const SIZING = new Set(["left", "right", "big", "Big", "bigg", "Bigg", "displaystyle", "textstyle"]);
const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ", T: "ᵀ", "⊤": "ᵀ", "*": "*", "′": "′",
};
const SUBSCRIPT: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎", a: "ₐ", e: "ₑ", o: "ₒ", x: "ₓ", h: "ₕ", k: "ₖ",
  l: "ₗ", m: "ₘ", n: "ₙ", p: "ₚ", s: "ₛ", t: "ₜ", i: "ᵢ", j: "ⱼ", r: "ᵣ", u: "ᵤ", v: "ᵥ",
};

/** Replaces TeX segments in text ($…$, $$…$$, \(…\), \[…\]) with a Unicode approximation. */
export function latexToUnicode(text: string): string {
  return text
    .replace(/\$\$([^]*?)\$\$/g, (_match, tex: string) => convertTex(tex))
    .replace(/\\\[([^]*?)\\\]/g, (_match, tex: string) => convertTex(tex))
    .replace(/\\\(([^]*?)\\\)/g, (_match, tex: string) => convertTex(tex))
    // Same currency-safe rule as the Viewer: no space after the opening $ and no digit after the closing $.
    .replace(/(^|[^\\$])\$(?!\$|\s)([^$\n]*?\S)\$(?!\d|\$)/g, (_match, prefix: string, tex: string) => `${prefix}${convertTex(tex)}`);
}

export function convertTex(tex: string): string {
  let output = "";
  let index = 0;
  while (index < tex.length) {
    const char = tex[index]!;
    if (char === "\\") {
      const { name, end } = readCommand(tex, index);
      index = end;
      if (name === "frac" || name === "dfrac" || name === "tfrac") {
        const numerator = readArgument(tex, index);
        const denominator = readArgument(tex, numerator.end);
        index = denominator.end;
        output += `${wrapCompound(numerator.value)}/${wrapCompound(denominator.value)}`;
      } else if (name === "sqrt") {
        const argument = readArgument(tex, index);
        index = argument.end;
        output += `√${wrapCompound(argument.value)}`;
      } else if (ACCENTS[name]) {
        const argument = readArgument(tex, index);
        index = argument.end;
        output += `${argument.value}${ACCENTS[name]}`;
      } else if (name === "mathbb") {
        const argument = readArgument(tex, index);
        index = argument.end;
        output += [...argument.value].map((letter) => BLACKBOARD[letter] ?? letter).join("");
      } else if (TEXT_WRAPPERS.has(name)) {
        const argument = readArgument(tex, index, true);
        index = argument.end;
        output += argument.value;
      } else if (!SIZING.has(name)) {
        output += SYMBOLS[name] ?? (name.length === 1 ? name : name);
      }
      continue;
    }
    if (char === "^" || char === "_") {
      const argument = readArgument(tex, index + 1);
      index = argument.end;
      output += script(argument.value, char === "^" ? SUPERSCRIPT : SUBSCRIPT, char);
      continue;
    }
    if (char === "{") {
      const argument = readArgument(tex, index);
      index = argument.end;
      output += argument.value;
      continue;
    }
    if (char === "}") {
      index += 1;
      continue;
    }
    if (/\s/.test(char)) {
      if (output && !output.endsWith(" ")) output += " ";
      while (index < tex.length && /\s/.test(tex[index]!)) index += 1;
      continue;
    }
    output += char;
    index += 1;
  }
  return output.trim();
}

function readCommand(tex: string, start: number): { name: string; end: number } {
  const letters = tex.slice(start + 1).match(/^[A-Za-z]+/)?.[0];
  if (letters) return { name: letters, end: start + 1 + letters.length };
  return { name: tex[start + 1] ?? "", end: Math.min(tex.length, start + 2) };
}

/** Reads a braced group, a command, or a single character, and returns it converted. */
function readArgument(tex: string, start: number, raw = false): { value: string; end: number } {
  let index = start;
  while (index < tex.length && /\s/.test(tex[index]!)) index += 1;
  if (tex[index] === "{") {
    let depth = 0;
    for (let end = index; end < tex.length; end += 1) {
      if (tex[end] === "\\") {
        end += 1;
        continue;
      }
      if (tex[end] === "{") depth += 1;
      if (tex[end] === "}") depth -= 1;
      if (depth === 0) {
        const inner = tex.slice(index + 1, end);
        return { value: raw ? inner : convertTex(inner), end: end + 1 };
      }
    }
    const inner = tex.slice(index + 1);
    return { value: raw ? inner : convertTex(inner), end: tex.length };
  }
  if (tex[index] === "\\") {
    const { end } = readCommand(tex, index);
    return { value: convertTex(tex.slice(index, end)), end };
  }
  return { value: tex[index] ?? "", end: Math.min(tex.length, index + 1) };
}

function script(value: string, table: Record<string, string>, marker: string): string {
  const chars = [...value];
  if (chars.length > 0 && chars.every((char) => table[char])) return chars.map((char) => table[char]).join("");
  return chars.length === 1 ? `${marker}${value}` : `${marker}(${value})`;
}

function wrapCompound(value: string): string {
  return /^[\p{Letter}\p{Number}.′̂̄̃⃗̇]+$/u.test(value) ? value : `(${value})`;
}
