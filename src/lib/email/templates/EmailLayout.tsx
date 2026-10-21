import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

export function EmailLayout({
  previewText,
  heading,
  children,
}: {
  previewText: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={brandBar}>
            <Text style={brandText}>TradeLinked</Text>
          </Section>
          <Section style={card}>
            <Heading style={h1}>{heading}</Heading>
            {children}
          </Section>
          <Text style={footer}>
            TradeLinked · This is an automated message, please do not reply directly.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#080c14",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  padding: "32px 0",
};

const container = {
  margin: "0 auto",
  maxWidth: "480px",
};

const brandBar = { padding: "0 8px 16px" };

const brandText = {
  color: "#3b82f6",
  fontSize: "20px",
  fontWeight: 700,
  margin: 0,
};

const card = {
  backgroundColor: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: "12px",
  padding: "32px",
};

const h1 = {
  color: "#e2e8f0",
  fontSize: "20px",
  fontWeight: 600,
  margin: "0 0 16px",
};

const footer = {
  color: "#64748b",
  fontSize: "12px",
  padding: "16px 8px 0",
  textAlign: "center" as const,
};

export const textStyle = { color: "#94a3b8", fontSize: "14px", lineHeight: "22px" };
export const rowLabel = { color: "#64748b", fontSize: "13px", margin: "0 0 2px" };
export const rowValue = { color: "#e2e8f0", fontSize: "15px", fontWeight: 600, margin: "0 0 14px" };
