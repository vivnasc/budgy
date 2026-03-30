import Script from "next/script";

interface AnalyticsProps {
  domain: string;
}

function Analytics({ domain }: AnalyticsProps) {
  if (process.env.NEXT_PUBLIC_PLAUSIBLE_ENABLED !== "true") {
    return null;
  }

  return (
    <Script
      defer
      data-domain={domain}
      src="https://plausible.io/js/script.js"
      strategy="afterInteractive"
    />
  );
}

export { Analytics };
export type { AnalyticsProps };
