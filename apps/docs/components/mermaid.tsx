"use client";

import { useTheme } from "fumadocs-ui/provider/base";
import { useEffect, useId, useState } from "react";

const light = {
  background: "#dbdbda",
  primaryColor: "#d1d1d0",
  primaryTextColor: "#050505",
  primaryBorderColor: "#050505",
  lineColor: "#202020",
  secondaryColor: "#ff641c",
  tertiaryColor: "#dbdbda",
  clusterBkg: "#d1d1d0",
  clusterBorder: "#050505",
  titleColor: "#050505",
  edgeLabelBackground: "#dbdbda",
  nodeTextColor: "#050505",
};

const dark = {
  background: "#050505",
  primaryColor: "#141414",
  primaryTextColor: "#ffffff",
  primaryBorderColor: "#dbdbda",
  lineColor: "#dbdbda",
  secondaryColor: "#ff641c",
  tertiaryColor: "#050505",
  clusterBkg: "#141414",
  clusterBorder: "#dbdbda",
  titleColor: "#ffffff",
  edgeLabelBackground: "#050505",
  nodeTextColor: "#ffffff",
};

export function Mermaid({ chart }: { chart: string }) {
  const rawId = useId();
  const { resolvedTheme } = useTheme();
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let cancelled = false;
    const renderId = `mmd-${rawId.replaceAll(":", "")}`;

    async function renderChart() {
      const { default: mermaid } = await import("mermaid");
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        fontFamily: "inherit",
        theme: "base",
        themeVariables: resolvedTheme === "dark" ? dark : light,
        flowchart: {
          htmlLabels: true,
          wrappingWidth: 200,
          padding: 10,
          nodeSpacing: 24,
          rankSpacing: 32,
          useMaxWidth: true,
        },
      });

      const source = chart.replaceAll("\\n", "\n");

      try {
        const rendered = await mermaid.render(renderId, source);
        if (!cancelled) setSvg(rendered.svg);
      } catch (err) {
        if (!cancelled) setSvg("");
        console.error("Mermaid render failed", err);
      }
    }

    void renderChart();
    return () => {
      cancelled = true;
    };
  }, [chart, rawId, resolvedTheme]);

  if (!svg) return null;

  return (
    <figure
      className="my-6 overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
