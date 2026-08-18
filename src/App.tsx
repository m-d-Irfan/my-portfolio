import React from "react";
import { PortfolioProvider, usePortfolio } from "./context/context";
import IntroLoader from "./components/IntroLoader";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import MetricsBar from "./components/MetricsBar";
import About from "./components/About";
import Skills from "./components/Skills";
import Projects from "./components/Projects";
import CompetitiveProgramming from "./components/CompetitiveProgramming";
import Education from "./components/Education";
import Training from "./components/Training";
import Contact from "./components/Contact";
import Footer from "./components/Footer";
import ScrollToTop from "./components/ScrollToTop";
import AuraBackground from "./components/AuraBackground";
import CommandPalette from "./components/CommandPalette";
import ResumeView from "./components/ResumeView";

function PortfolioContent() {
  const { isResumeOpen } = usePortfolio();

  return (
    <>
      <IntroLoader />
      <CommandPalette />

      {isResumeOpen ? (
        <AuraBackground>
          <ResumeView />
        </AuraBackground>
      ) : (
        <AuraBackground>
          <Navbar />
          <main>
            <Hero />
            <MetricsBar />
            <About />
            <Skills />
            <Projects />
            <CompetitiveProgramming />
            <Education />
            <Training />
            <Contact />
          </main>
          <Footer />
          <ScrollToTop />
        </AuraBackground>
      )}
    </>
  );
}

export default function App() {
  return (
    <PortfolioProvider>
      <PortfolioContent />
    </PortfolioProvider>
  );
}
