import type { ReactNode } from "react";
import { useLayoutEffect, useState } from "react";
import "./type-scale.css";

const STORE = "dev.typeScale";

interface Size {
  name: string;
  value: number;
  unit: string;
}

function declaredSizes(): Size[] {
  const sizes = new Map<string, Size>();
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSStyleRule) || rule.selectorText !== ":root") {
        continue;
      }
      for (const property of Array.from(rule.style)) {
        const match = /^(-?[\d.]+)(px|rem)$/u.exec(rule.style.getPropertyValue(property).trim());
        if (property.startsWith("--fs-") && match && !sizes.has(property)) {
          sizes.set(property, { name: property, value: Number(match[1]), unit: match[2] ?? "rem" });
        }
      }
    }
  }
  return [...sizes.values()];
}

function stored(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

function css(sizes: Size[], values: Record<string, number>): string {
  return sizes
    .map((size) => `  ${size.name}: ${String(values[size.name] ?? size.value)}${size.unit};`)
    .join("\n");
}

export default function TypeScalePanel(): ReactNode {
  const [open, setOpen] = useState(false);
  const [sizes] = useState<Size[]>(declaredSizes);
  const [values, setValues] = useState<Record<string, number>>(stored);
  const [copied, setCopied] = useState(false);

  useLayoutEffect(() => {
    const root = document.documentElement.style;
    for (const size of sizes) {
      const value = values[size.name];
      if (value === undefined) {
        root.removeProperty(size.name);
      } else {
        root.setProperty(size.name, `${String(value)}${size.unit}`);
      }
    }
    if (Object.keys(values).length === 0) {
      localStorage.removeItem(STORE);
    } else {
      localStorage.setItem(STORE, JSON.stringify(values));
    }
  }, [sizes, values]);

  if (!open) {
    return (
      <button
        type="button"
        className="type-scale-toggle"
        aria-label="Type scale"
        title="Type scale (dev only)"
        onClick={() => {
          setOpen(true);
        }}
      >
        Aa
      </button>
    );
  }

  return (
    <section className="type-scale panel" aria-label="Type scale">
      <header className="type-scale-head">
        <h2 className="eyebrow">Type scale</h2>
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setOpen(false);
          }}
        >
          Close
        </button>
      </header>
      {sizes.map((size) => {
        const value = values[size.name] ?? size.value;
        const px = size.unit === "px";
        return (
          <label key={size.name} className="type-scale-row">
            <span style={{ fontSize: `var(${size.name})` }}>{size.name.slice(5)}</span>
            <input
              type="range"
              min={px ? 10 : 0.4}
              max={px ? 22 : 2.4}
              step={px ? 0.5 : 0.01}
              value={value}
              onChange={(event) => {
                setValues({ ...values, [size.name]: Number(event.target.value) });
              }}
            />
            <output data-changed={value === size.value ? undefined : ""}>
              {value}
              {size.unit}
            </output>
          </label>
        );
      })}
      <footer className="type-scale-foot">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(css(sizes, values)).then(() => {
              setCopied(true);
              setTimeout(() => {
                setCopied(false);
              }, 1500);
            });
          }}
        >
          {copied ? "Copied" : "Copy CSS"}
        </button>
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setValues({});
          }}
        >
          Reset
        </button>
      </footer>
    </section>
  );
}
