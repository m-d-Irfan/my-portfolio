"use client";
import React from "react";
import { Github, Linkedin, Mail, Phone } from "lucide-react";

export default function Contact() {
  const handleLetsTalk = () => {
    // Dispatch custom event to trigger Navbar's connect modal
    window.dispatchEvent(new Event("open-connect-modal"));
  };

  return (
    <section id="contact" className="section py-24 bg-base-100 relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        
        {/* Section Header */}
        <div className="mb-12">
          <h2 className="font-outfit text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Get In <span className="text-gradient">Touch</span>
          </h2>
          <div className="w-16 h-1.5 bg-gradient-to-r from-primary to-secondary mx-auto rounded-full"></div>
          <p className="font-sans text-base opacity-75 mt-6 max-w-xl mx-auto leading-relaxed">
            I am always open to discussing new backend roles, software architecture opportunities, or developer collaborations.
          </p>
        </div>

        {/* Buttons Group - Side by Side */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-5 max-w-md mx-auto mb-12">
          <a
            href="mailto:monsurulislamcse.0208@gmail.com"
            className="w-full sm:w-auto btn btn-primary btn-lg rounded-2xl font-outfit shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/35 transition-all duration-300 hover:scale-[1.03] text-base"
          >
            <Mail className="w-5 h-5 mr-2" /> Start conversation
          </a>

          <button
            onClick={handleLetsTalk}
            className="w-full sm:w-auto btn btn-outline btn-secondary btn-lg rounded-2xl font-outfit hover:scale-[1.03] transition-all duration-300 text-base"
          >
            <Phone className="w-5 h-5 mr-2" /> Let's talk
          </button>
        </div>


      </div>
    </section>
  );
}
