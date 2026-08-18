import React, { useState } from "react";
import { usePortfolio } from "../context/context";
import { Mail, Phone, MapPin, Send, Copy, Github, Linkedin, MessageSquare } from "lucide-react";

export default function Contact() {
  const { data, copyToClipboard, showToast } = usePortfolio();

  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      showToast("Please fill in all fields", "info");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      showToast(`Thank you, ${formData.name}! Your message is prepared.`, "success");
      
      const mailtoUrl = `mailto:${data.email}?subject=${encodeURIComponent(
        `Portfolio Contact from ${formData.name}`
      )}&body=${encodeURIComponent(
        `Name: ${formData.name}\nEmail: ${formData.email}\n\nMessage:\n${formData.message}`
      )}`;
      window.location.href = mailtoUrl;

      setFormData({ name: "", email: "", message: "" });
      setIsSubmitting(false);
    }, 500);
  };

  return (
    <section id="contact" className="py-16 sm:py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary font-mono text-xs font-semibold mb-3">
            Connect
          </div>
          <h2 className="font-outfit text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Get In Touch
          </h2>
          <p className="font-sans text-base text-base-content/75">
            Have an open engineering role, project inquiry, or technical question? Feel free to reach out directly!
          </p>
        </div>

        {/* Contact Box */}
        <div className="max-w-5xl mx-auto bg-base-200/60 border border-base-300 rounded-3xl p-6 sm:p-10 shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Direct Channels */}
            <div className="lg:col-span-5 flex flex-col gap-3.5">
              <h3 className="font-outfit text-xl font-bold mb-1">Direct Contact</h3>
              <p className="font-sans text-xs text-base-content/70 mb-2">
                Click any channel below to copy or start a chat directly.
              </p>

              {/* Email Button */}
              <button
                onClick={() => copyToClipboard(data.email, "Email address copied")}
                className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-base-100/80 border border-base-300 hover:border-primary/40 hover:bg-base-100 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="font-mono text-[10px] text-base-content/60 uppercase">Email (Click to Copy)</div>
                  <div className="font-sans text-xs sm:text-sm font-semibold truncate text-base-content group-hover:text-primary transition-colors">
                    {data.email}
                  </div>
                </div>
                <Copy className="w-4 h-4 text-base-content/40 group-hover:text-primary shrink-0" />
              </button>

              {/* WhatsApp Direct */}
              <a
                href="https://wa.me/8801611836864"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-base-100/80 border border-base-300 hover:border-success/40 hover:bg-base-100 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center text-success shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="font-mono text-[10px] text-base-content/60 uppercase">WhatsApp Chat</div>
                  <div className="font-sans text-xs sm:text-sm font-semibold text-base-content group-hover:text-success transition-colors">
                    +8801611836864
                  </div>
                </div>
              </a>

              {/* LinkedIn */}
              <a
                href="https://linkedin.com/in/monzurul-islam-irfan/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-base-100/80 border border-base-300 hover:border-secondary/40 hover:bg-base-100 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary shrink-0">
                  <Linkedin className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="font-mono text-[10px] text-base-content/60 uppercase">LinkedIn Profile</div>
                  <div className="font-sans text-xs sm:text-sm font-semibold text-base-content group-hover:text-secondary transition-colors">
                    monzurul-islam-irfan
                  </div>
                </div>
              </a>

              {/* GitHub */}
              <a
                href="https://github.com/m-d-Irfan"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-base-100/80 border border-base-300 hover:border-accent/40 hover:bg-base-100 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent shrink-0">
                  <Github className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="font-mono text-[10px] text-base-content/60 uppercase">GitHub Profile</div>
                  <div className="font-sans text-xs sm:text-sm font-semibold text-base-content group-hover:text-accent transition-colors">
                    m-d-Irfan
                  </div>
                </div>
              </a>
            </div>

            {/* Right: Message Form */}
            <div className="lg:col-span-7 bg-base-100/90 border border-base-300 rounded-3xl p-6 sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block font-mono text-xs text-base-content/70 mb-1.5">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Monzurul Islam"
                    required
                    className="input input-bordered w-full rounded-xl bg-base-200 text-sm font-sans focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block font-mono text-xs text-base-content/70 mb-1.5">
                    Your Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="example@email.com"
                    required
                    className="input input-bordered w-full rounded-xl bg-base-200 text-sm font-sans focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block font-mono text-xs text-base-content/70 mb-1.5">
                    Your Message
                  </label>
                  <textarea
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Hello Monzurul, I would like to discuss an opportunity..."
                    required
                    className="textarea textarea-bordered w-full rounded-xl bg-base-200 text-sm font-sans focus:border-primary resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary w-full rounded-xl font-outfit shadow-md shadow-primary/20 hover:shadow-primary/40 gap-2"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? "Sending..." : "Send Message"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
