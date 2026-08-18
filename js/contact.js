/**
 * Contact Channels & Form Handler
 * Fully functional with async email delivery and fallback
 */

import { portfolioData } from './data.js';
import { copyText, showToast } from './toast.js';

export function initContact() {
  // Bind 1-click copy triggers
  const copyEmailBtns = document.querySelectorAll('.copy-email-btn');
  copyEmailBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      copyText(portfolioData.email, 'Email address copied to clipboard');
    });
  });

  const copyPhoneBtns = document.querySelectorAll('.copy-phone-btn');
  copyPhoneBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      copyText(portfolioData.phone, 'Phone number copied to clipboard');
    });
  });

  // Contact form submission
  const contactForm = document.getElementById('portfolio-contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleFormSubmit(contactForm);
    });
  }
}

async function handleFormSubmit(form) {
  const nameInput = form.querySelector('#contact-name');
  const emailInput = form.querySelector('#contact-email');
  const messageInput = form.querySelector('#contact-message');
  const submitBtn = form.querySelector('#contact-submit-btn');

  const name = nameInput ? nameInput.value.trim() : '';
  const email = emailInput ? emailInput.value.trim() : '';
  const message = messageInput ? messageInput.value.trim() : '';

  if (!name || !email || !message) {
    showToast('Please fill in all fields', 'info');
    return;
  }

  // Basic email validation
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    showToast('Please enter a valid email address', 'info');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
        <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
      </svg>
      Sending Message...
    `;
  }

  try {
    // Send email asynchronously via formsubmit AJAX endpoint
    const response = await fetch(`https://formsubmit.co/ajax/${portfolioData.email}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        name: name,
        email: email,
        message: message,
        _subject: `Portfolio Message from ${name} (${email})`,
        _template: 'table'
      })
    });

    if (response.ok) {
      showToast(`Thank you, ${name}! Your message has been sent successfully.`, 'success');
      showSuccessBanner(form, name);
      form.reset();
    } else {
      throw new Error('Server returned non-200 status');
    }
  } catch (error) {
    // Fallback: Open formatted mailto client
    showToast(`Opening email client for ${name}...`, 'info');
    const mailtoUrl = `mailto:${portfolioData.email}?subject=${encodeURIComponent(`Portfolio Inquiry from ${name}`)}&body=${encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`)}`;
    window.location.href = mailtoUrl;
    form.reset();
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
        Send Message
      `;
    }
  }
}

function showSuccessBanner(form, name) {
  let existingBanner = form.querySelector('.form-success-banner');
  if (existingBanner) existingBanner.remove();

  const banner = document.createElement('div');
  banner.className = 'form-success-banner';
  banner.style.cssText = `
    margin-top: 1rem;
    padding: 0.875rem 1rem;
    border-radius: var(--radius-md);
    background: var(--color-primary-soft);
    border: 1px solid var(--border-accent);
    color: var(--color-primary);
    font-size: var(--text-xs);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    animation: toast-in 0.3s ease-out;
  `;
  banner.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
    <span>Message delivered! Monzurul will get back to you shortly.</span>
  `;

  form.appendChild(banner);

  setTimeout(() => {
    if (banner.parentNode) {
      banner.style.opacity = '0';
      banner.style.transition = 'opacity 0.5s ease';
      setTimeout(() => banner.remove(), 500);
    }
  }, 6000);
}
