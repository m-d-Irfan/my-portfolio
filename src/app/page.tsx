import React from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import About from "@/components/About";
import Skills from "@/components/Skills";
import Projects from "@/components/Projects";
import Education from "@/components/Education";
import Training from "@/components/Training";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import AuraBackground from "@/components/AuraBackground";
import IntroLoader from "@/components/IntroLoader";

export default function Home() {
  return (
    <AuraBackground>
      {/* Intro Loading Animation like Mattia Cielo */}
      <IntroLoader />

      {/* Sticky top Navigation Bar */}
      <Navbar />
      
      {/* Scrollable Layout sections */}
      <main className="flex-grow">
        <Hero />
        <About />
        <Skills />
        <Projects />
        <Education />
        <Training />
        <Contact />
      </main>

      {/* Footer */}
      <Footer />
    </AuraBackground>
  );
}
