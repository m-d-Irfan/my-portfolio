"use client";
import React, { useState } from "react";
import { portfolioData } from "@/data/portfolio";
import { Mail, Phone, MapPin, Send, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      setStatus("error");
      setErrorMsg("Please fill in all the fields.");
      return;
    }

    setStatus("loading");
    setErrorMsg("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("success");
        setFormData({ name: "", email: "", subject: "", message: "" });
      } else {
        setStatus("error");
        setErrorMsg(data.error || "Something went wrong. Please try again.");
      }
    } catch (error) {
      setStatus("error");
      setErrorMsg("Network error. Please verify your connection.");
    }
  };

  return (
    <section id="contact" className="section py-20 bg-base-100 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="font-outfit text-3xl sm:text-5xl font-bold tracking-tight mb-4">
            Get In <span className="text-gradient">Touch</span>
          </h2>
          <div className="w-16 h-1.5 bg-gradient-to-r from-primary to-secondary mx-auto rounded-full"></div>
          <p className="font-sans text-sm sm:text-base opacity-70 mt-4 max-w-xl mx-auto">
            Have a project in mind, a backend engineering opportunity, or just want to say hi? Drop me a message!
          </p>
        </div>

        {/* Form and Contact Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start max-w-6xl mx-auto">
          
          {/* Left Side: Contact Details */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-8 rounded-3xl bg-base-200/40 border border-base-300/40 shadow-lg space-y-8">
              <h3 className="font-outfit text-2xl font-bold text-base-content/90">
                Contact Information
              </h3>
              
              <div className="space-y-6">
                {/* Email Address */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-outfit text-sm font-semibold opacity-60">Email Me</h4>
                    <a
                      href={`mailto:${portfolioData.email}`}
                      className="font-outfit text-base font-bold hover:text-primary transition-colors mt-0.5 break-all block"
                    >
                      {portfolioData.email}
                    </a>
                  </div>
                </div>

                {/* Phone Number */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-secondary/10 border border-secondary/20 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <h4 className="font-outfit text-sm font-semibold opacity-60">Call / WhatsApp</h4>
                    <a
                      href={`tel:${portfolioData.phone}`}
                      className="font-outfit text-base font-bold hover:text-secondary transition-colors mt-0.5 block"
                    >
                      {portfolioData.phone}
                    </a>
                  </div>
                </div>

                {/* Location */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h4 className="font-outfit text-sm font-semibold opacity-60">My Location</h4>
                    <p className="font-outfit text-base font-bold mt-0.5">
                      {portfolioData.location}
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Right Side: Message Form */}
          <div className="lg:col-span-7">
            <form
              onSubmit={handleSubmit}
              className="p-8 sm:p-10 rounded-3xl bg-base-200/40 border border-base-300/40 shadow-lg space-y-6"
            >
              <h3 className="font-outfit text-2xl font-bold text-gradient mb-2">
                Send a Message
              </h3>

              {/* Status Alert Panels */}
              {status === "success" && (
                <div className="alert alert-success rounded-2xl shadow-sm text-sm py-3 font-outfit gap-2">
                  <CheckCircle2 className="w-5 h-5 text-success-content" />
                  <span>Your message has been sent successfully! I will get back to you soon.</span>
                </div>
              )}

              {status === "error" && (
                <div className="alert alert-error rounded-2xl shadow-sm text-sm py-3 font-outfit gap-2">
                  <AlertCircle className="w-5 h-5 text-error-content" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Form Input fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Name */}
                <div className="form-control w-full">
                  <label className="label">
                    <span className="label-text font-outfit font-semibold opacity-80">Full Name</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Enter your name"
                    className="input input-bordered w-full rounded-2xl focus:outline-primary bg-base-100/50"
                    disabled={status === "loading"}
                  />
                </div>

                {/* Email */}
                <div className="form-control w-full">
                  <label className="label">
                    <span className="label-text font-outfit font-semibold opacity-80">Email Address</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="name@example.com"
                    className="input input-bordered w-full rounded-2xl focus:outline-primary bg-base-100/50"
                    disabled={status === "loading"}
                  />
                </div>
              </div>

              {/* Subject */}
              <div className="form-control w-full">
                <label className="label">
                  <span className="label-text font-outfit font-semibold opacity-80">Subject</span>
                </label>
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder="What is this regarding?"
                  className="input input-bordered w-full rounded-2xl focus:outline-primary bg-base-100/50"
                  disabled={status === "loading"}
                />
              </div>

              {/* Message */}
              <div className="form-control w-full">
                <label className="label">
                  <span className="label-text font-outfit font-semibold opacity-80">Your Message</span>
                </label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  rows={5}
                  placeholder="Type your message here..."
                  className="textarea textarea-bordered w-full rounded-2xl focus:outline-primary bg-base-100/50 text-base"
                  disabled={status === "loading"}
                ></textarea>
              </div>

              {/* Submit Button */}
              <div>
                <button
                  type="submit"
                  className="btn btn-primary btn-block rounded-2xl font-outfit shadow-lg shadow-primary/20 hover:shadow-primary/45 transition-all duration-300"
                  disabled={status === "loading"}
                >
                  {status === "loading" ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Sending Message...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" /> Send Message
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

        </div>

      </div>
    </section>
  );
}
