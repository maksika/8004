# wayMint — Design System Migration

You are updating **wayMint** to use the Lineage Labs design system. The project is at `/home/erasmus/.openclaw/workspace/waymint/`.

Read these files carefully before writing anything:
- `DESIGN-SYSTEM.md` — full spec
- `design-system-colors.css` — exact CSS tokens to use
- `design-system-presets.js` — GSAP animation presets

Also read all existing source files to understand what's currently there.

---

## What the design system requires

**Framework:** shadcn-svelte (Svelte variant of shadcn/ui)
**Style:** Maia — soft, rounded, generous spacing
**Colors:** Gray base (blue-tinted neutrals) + brand color addons
**Fonts:**
- Body/UI: System UI native stack (no install needed)
- H1/display: Lora (400 and 700)
- H2-H4: Poppins (600-800)
- Code: Geist Mono
**Icons:** @hugeicons/svelte
**Animation:** GSAP v3 with presets from design-system-presets.js
**Radius:** 0.875rem (large — Maia)

---

## STEP 1: Install dependencies

```bash
cd /home/erasmus/.openclaw/workspace/waymint

# shadcn-svelte
npx shadcn-svelte@latest init 2>&1 || true

# Icons
npm install @hugeicons/svelte

# GSAP
npm install gsap

# Types
npm install -D @types/gsap 2>/dev/null || true
```

If `npx shadcn-svelte@latest init` is interactive, skip it — we will set up the tokens manually instead.

---

## STEP 2: Update src/app.html — fonts

Replace the current Google Fonts link with the Lineage Labs font stack:

```html
<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%sveltekit.assets%/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
    <link
      href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,700&family=Poppins:wght@300;600;700;800&display=swap"
      rel="stylesheet"
    />
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

Note: `class="dark"` on the html element activates the dark mode token set.

---

## STEP 3: Replace src/app.css entirely

The current app.css uses custom tokens. Replace it with the Lineage Labs design system tokens and mappings. This is the new app.css:

```css
/* ── Google Fonts are loaded in app.html ── */

/* ── Lineage Labs Design System tokens ── */
/* Copied from tokens/colors.css */

:root {
  --radius: 0.875rem;

  --background: #E8E5DE;
  --foreground: oklch(0.13 0.028 261.692);

  --card: oklch(1 0 0);
  --card-foreground: oklch(0.13 0.028 261.692);

  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.13 0.028 261.692);

  --primary: oklch(0.21 0.034 264.665);
  --primary-foreground: oklch(0.985 0.002 247.839);

  --secondary: oklch(0.967 0.003 264.542);
  --secondary-foreground: oklch(0.21 0.034 264.665);

  --muted: oklch(0.967 0.003 264.542);
  --muted-foreground: oklch(0.551 0.027 264.364);

  --accent: oklch(0.967 0.003 264.542);
  --accent-foreground: oklch(0.21 0.034 264.665);

  --destructive: oklch(0.577 0.245 27.325);

  --border: oklch(0.928 0.006 264.531);
  --input: oklch(0.928 0.006 264.531);
  --ring: oklch(0.707 0.022 261.325);

  /* Brand color primitives */
  --brand-surface-light: #E8E5DE;
  --brand-surface-dark: #0E1233;
  --brand-offset-lavender-light: #7267E2;
  --brand-offset-lavender-dark: #B4AFE7;
  --brand-offset-green-light: #A0D246;
  --brand-offset-green-dark: #D5FD8D;
  --brand-offset-coral-light: #FF7236;
  --brand-offset-coral-dark: #FF814C;
  --brand-offset-blue-light: #006CDB;
  --brand-offset-blue-dark: #2886E6;

  /* Brand semantics — light mode */
  --brand-surface: var(--brand-surface-light);
  --brand-highlight-navy: #0E1233;
  --brand-highlight-light: #FAFAFA;
  --brand-offset-lavender: var(--brand-offset-lavender-light);
  --brand-offset-green: var(--brand-offset-green-light);
  --brand-offset-yellow: #F8BC4D;
  --brand-offset-coral: var(--brand-offset-coral-light);
  --brand-offset-blue: var(--brand-offset-blue-light);

  /* Font stacks */
  --font-body: system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
  --font-display: "Lora", Georgia, serif;
  --font-heading: "Poppins", sans-serif;
  --font-mono: "Geist Mono", "SF Mono", "Fira Code", Consolas, monospace;
}

.dark {
  --background: #0E1233;
  --foreground: oklch(0.985 0.002 247.839);

  --card: oklch(0.21 0.034 264.665);
  --card-foreground: oklch(0.985 0.002 247.839);

  --popover: oklch(0.21 0.034 264.665);
  --popover-foreground: oklch(0.985 0.002 247.839);

  --primary: oklch(0.928 0.006 264.531);
  --primary-foreground: oklch(0.21 0.034 264.665);

  --secondary: oklch(0.278 0.033 256.848);
  --secondary-foreground: oklch(0.985 0.002 247.839);

  --muted: oklch(0.278 0.033 256.848);
  --muted-foreground: oklch(0.707 0.022 261.325);

  --accent: oklch(0.278 0.033 256.848);
  --accent-foreground: oklch(0.985 0.002 247.839);

  --destructive: oklch(0.704 0.191 22.216);

  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.551 0.027 264.364);

  /* Brand semantics — dark mode */
  --brand-surface: var(--brand-surface-dark);
  --brand-offset-lavender: var(--brand-offset-lavender-dark);
  --brand-offset-green: var(--brand-offset-green-dark);
  --brand-offset-coral: var(--brand-offset-coral-dark);
  --brand-offset-blue: var(--brand-offset-blue-dark);
}

/* ── Reset ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { color-scheme: dark; overflow-x: clip; }
body {
  font-family: var(--font-body);
  background: var(--background);
  color: var(--foreground);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  min-height: 100dvh;
  overflow-wrap: break-word;
}

img, video, svg, canvas, iframe { max-width: 100%; height: auto; }

/* ── Typography ── */
h1 {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(2rem, 4vw, 2.75rem);
  line-height: 1.2;
}

h2, h3, h4 {
  font-family: var(--font-heading);
  font-weight: 700;
  line-height: 1.3;
}

h2 { font-size: clamp(1.5rem, 3vw, 1.75rem); }
h3 { font-size: 1.125rem; font-weight: 600; }
h4 { font-size: 1rem; font-weight: 600; }

.h0 {
  font-family: var(--font-display);
  font-weight: 400;
  font-size: clamp(3.5rem, 8vw, 6rem);
  line-height: 1.0;
  letter-spacing: -0.03em;
}

code, pre, .mono { font-family: var(--font-mono); }
a { color: var(--brand-offset-blue); text-decoration: none; }
a:hover { text-decoration: underline; }

/* ── Layout ── */
.container { max-width: 1100px; margin: 0 auto; padding: 0 1.5rem; }

/* ── Maia-style component primitives ── */

/* Badges */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.7rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  font-family: var(--font-body);
  white-space: nowrap;
}

/* Chain badges */
.badge-celo {
  background: rgba(252, 255, 82, 0.12);
  color: #fcff52;
  border: 1px solid rgba(252, 255, 82, 0.3);
}
.badge-base {
  background: color-mix(in srgb, var(--brand-offset-blue) 15%, transparent);
  color: var(--brand-offset-blue);
  border: 1px solid color-mix(in srgb, var(--brand-offset-blue) 30%, transparent);
}

/* Status badges */
.badge-verified {
  background: color-mix(in srgb, var(--brand-offset-green) 15%, transparent);
  color: var(--brand-offset-green);
  border: 1px solid color-mix(in srgb, var(--brand-offset-green) 35%, transparent);
}
.badge-unverified {
  background: color-mix(in srgb, var(--foreground) 5%, transparent);
  color: var(--muted-foreground);
  border: 1px solid var(--border);
}

/* Buttons — Maia style (pill-shaped) */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.6rem 1.5rem;
  border-radius: 999px; /* Maia pill */
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 150ms ease-out;
  border: none;
  text-decoration: none;
  white-space: nowrap;
}
.btn:hover { text-decoration: none; transform: scale(0.98); }
.btn:active { transform: scale(0.97); }

.btn-primary {
  background: var(--primary);
  color: var(--primary-foreground);
}
.btn-primary:hover { opacity: 0.9; }

.btn-secondary {
  background: color-mix(in srgb, var(--brand-highlight-light) 10%, transparent);
  color: var(--foreground);
  border: 1px solid var(--border);
}
.btn-secondary:hover {
  background: color-mix(in srgb, var(--brand-highlight-light) 15%, transparent);
  border-color: color-mix(in srgb, var(--foreground) 25%, transparent);
}

.btn-lg { padding: 0.75rem 2rem; font-size: 1rem; }
.btn-sm { padding: 0.35rem 1rem; font-size: 0.8rem; }

/* Cards — Maia style */
.card {
  background: var(--card);
  color: var(--card-foreground);
  border-radius: calc(var(--radius) * 1.3); /* rounded-2xl equiv */
  padding: 1.5rem;
  box-shadow: 0 1px 3px oklch(0 0 0 / 8%);
  /* Maia uses ring instead of border */
  outline: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
  outline-offset: -1px;
}

/* Forms */
.form-input {
  background: color-mix(in srgb, var(--input) 30%, transparent);
  border: 1px solid var(--border);
  border-radius: 999px; /* Maia pill inputs */
  padding: 0.6rem 1rem;
  color: var(--foreground);
  font-family: var(--font-body);
  font-size: 0.9rem;
  width: 100%;
  transition: box-shadow 150ms, border-color 150ms;
}
.form-input:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--ring), 0 0 0 4px var(--background);
  border-color: var(--ring);
}
.form-input.form-textarea {
  border-radius: calc(var(--radius) * 1.3); /* textarea is rounded-xl, not pill */
  resize: vertical;
  min-height: 80px;
}
select.form-input {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  padding-right: 2.5rem;
}

/* Spinner */
.spinner {
  width: 32px; height: 32px;
  border: 2.5px solid var(--border);
  border-top-color: var(--brand-offset-blue);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* GSAP entrance helper — JS sets opacity/transform, this just establishes initial state */
.will-animate { opacity: 0; }
```

---

## STEP 4: Copy animation presets into src/lib

```bash
cp /home/erasmus/.openclaw/workspace/waymint/design-system-presets.js /home/erasmus/.openclaw/workspace/waymint/src/lib/animations.js
```

---

## STEP 5: Update src/routes/+layout.svelte

No changes needed — it just imports app.css. Keep it as-is.

---

## STEP 6: Update src/routes/+page.svelte — Landing page

Read the current file first. Then update it to use the design system:

Key changes:
1. Hero title: use `.h0` class (Lora 400 display weight) for the main headline. "verifiable identity" accent → use `var(--brand-offset-blue)` or `var(--brand-offset-green)` (one accent max per section)
2. Navigation: use `var(--background)` / `var(--foreground)` tokens, not hardcoded hex
3. Section headings (h2): Poppins via CSS — already handled by the h2 rule in app.css
4. Buttons: already use `.btn` classes — keep. The new pill shape is applied automatically.
5. Cards: use new `.card` class (ring outline instead of border)
6. Colors: replace ALL hardcoded hex values and old CSS vars (`--color-*`) with the new tokens (`--background`, `--foreground`, `--muted-foreground`, `--border`, `--brand-offset-*`)
7. Add GSAP entrance animations to the hero (fadeIn + slideInUp on hero text and CTA) and step cards (staggered slideInUp on scroll)
8. The search form input should use `.form-input` class
9. Footer: use `var(--muted-foreground)` for links

For GSAP in Svelte, import dynamically to avoid SSR:
```svelte
<script>
  import { onMount } from 'svelte';

  onMount(async () => {
    const gsap = (await import('gsap')).default;
    const { ENTRANCE } = await import('$lib/animations.js');

    // Hero entrance
    gsap.fromTo('.hero-title', ENTRANCE.slideInUp.from, { ...ENTRANCE.slideInUp.to, delay: 0.1 });
    gsap.fromTo('.hero-sub', ENTRANCE.fadeIn.from, { ...ENTRANCE.fadeIn.to, delay: 0.3 });
    gsap.fromTo('.hero-cta', ENTRANCE.slideInUp.from, { ...ENTRANCE.slideInUp.to, delay: 0.4 });

    // Step cards stagger
    gsap.fromTo('.step', ENTRANCE.slideInUp.from, {
      ...ENTRANCE.slideInUp.to,
      stagger: 0.12,
      delay: 0.5,
      scrollTrigger: undefined,
    });
  });
</script>
```

---

## STEP 7: Update src/routes/register/+page.svelte

Read the current file. Key changes:
1. Network cards: update card styles to use `.card` class with Maia tokens
2. Form inputs: already use `.form-input` — the pill shape now applies automatically
3. Step indicator in Stepper.svelte: update colors to use `--brand-offset-blue` (active), `--brand-offset-green` (done)
4. Remove all hardcoded `#3b82f6`, `#22c55e`, `#0a0a0a` etc. — replace with token vars
5. The "Verified" badge on success: use `.badge-verified` class
6. Error card: use `--destructive` token

---

## STEP 8: Update src/routes/agent/[chain]/[id]/+page.svelte

Read the current file. Key changes:
1. Verified badge: update glow to use `var(--brand-offset-green)` 
2. Chain badge pill colors: already handled by `.badge-celo` and `.badge-base` in app.css
3. All hardcoded colors replaced with tokens
4. Detail list borders: use `var(--border)` token
5. Card outlines: Maia ring style via `.card`
6. Add a subtle GSAP fadeIn on the agent header on mount

---

## STEP 9: Update src/lib/components/Stepper.svelte

Replace hardcoded color values with design tokens:
- Active step: `var(--brand-offset-blue)` + `color-mix(in srgb, var(--brand-offset-blue) 15%, transparent)`
- Done step: `var(--brand-offset-green)` + `color-mix(in srgb, var(--brand-offset-green) 15%, transparent)`
- Inactive: `var(--muted)` / `var(--muted-foreground)`
- Step line: `var(--border)` (inactive), `var(--brand-offset-green)` (done)

---

## STEP 10: Update src/routes/owner/[address]/+page.svelte

Same token replacement pass — remove all hardcoded hex, use design system vars.

---

## STEP 11: Clean up design system reference files

Remove the temp files we no longer need at root:
```bash
rm /home/erasmus/.openclaw/workspace/waymint/design-system-colors.css
rm /home/erasmus/.openclaw/workspace/waymint/design-system-presets.js
rm /home/erasmus/.openclaw/workspace/waymint/DESIGN-SYSTEM.md
```

---

## STEP 12: Build and verify

```bash
cd /home/erasmus/.openclaw/workspace/waymint
npm run build 2>&1
```

Fix all errors. Common issues:
- GSAP types: if `@types/gsap` is missing, add `// @ts-ignore` above gsap imports
- `color-mix()` in vite: should work fine in modern browsers and build
- Import `.js` files from `$lib`: make sure the animations.js import works

---

## STEP 13: Commit and push

```bash
cd /home/erasmus/.openclaw/workspace/waymint
git add -A
git commit -m "design: migrate to Lineage Labs design system (Maia/shadcn tokens, Lora+Poppins, brand colors, GSAP)"
git push origin main
```

---

## When done

```
openclaw system event --text "Done: wayMint design system migration complete. Lineage Labs tokens (Maia/shadcn Gray), Lora+Poppins fonts, brand color vars, pill buttons/inputs, GSAP entrance animations. Build passes. Pushed." --mode now
```
