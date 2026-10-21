import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/marketing/Hero";
import { AboutSection } from "@/components/marketing/AboutSection";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { PlansGrid } from "@/components/marketing/PlansGrid";
import { PaymentMethods } from "@/components/marketing/PaymentMethods";
import { SecurityFeatures } from "@/components/marketing/SecurityFeatures";
import { Partners } from "@/components/marketing/Partners";
import { CtaBanner } from "@/components/marketing/CtaBanner";
import { ScrollProgress } from "@/components/motion/Ambient";
import { WidgetBoundary } from "@/components/error/ErrorBoundary";
import { ChatWidget } from "@/components/marketing/ChatWidget";

export default function HomePage() {
  return (
    <>
      <ScrollProgress />
      <Navbar />
      <main>
        <Hero />
        <AboutSection />
        <HowItWorks />
        <PlansGrid />
        <PaymentMethods />
        <SecurityFeatures />
        <Partners />
        <CtaBanner />
      </main>
      <Footer />
      <WidgetBoundary name="chat" silent>
        <ChatWidget />
      </WidgetBoundary>
    </>
  );
}
