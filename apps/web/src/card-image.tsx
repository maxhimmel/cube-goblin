import type { ReactNode } from "react";
import { useState } from "react";

const RETRY_DELAY_MS = 1500;

function withRetry(src: string): string {
  return src.startsWith("data:") ? src : `${src}${src.includes("?") ? "&" : "?"}retry=1`;
}

export function CardImage({
  src,
  alt,
  width,
  height,
  className,
  lazy = true,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  lazy?: boolean;
}): ReactNode {
  const [attempt, setAttempt] = useState<"first" | "retry" | "failed">("first");
  if (attempt === "failed") {
    return (
      <span className={`card-fallback ${className ?? ""}`} role="img" aria-label={alt}>
        {alt}
      </span>
    );
  }
  return (
    <img
      src={attempt === "retry" ? withRetry(src) : src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading={lazy ? "lazy" : "eager"}
      decoding="async"
      onError={() => {
        if (attempt === "first") {
          setTimeout(() => {
            setAttempt("retry");
          }, RETRY_DELAY_MS);
        } else {
          setAttempt("failed");
        }
      }}
    />
  );
}
