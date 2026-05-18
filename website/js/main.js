/* Forge Solutions — Main JS */

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initFAQ();
  initContactForm();
  setActiveNav();
});

/* ── Navigation ─────────────────────────────────────────────────── */
function initNav() {
  const nav    = document.querySelector('.nav');
  const toggle = document.querySelector('.nav__toggle');
  const mobile = document.querySelector('.nav__mobile');

  // Shadow on scroll
  window.addEventListener('scroll', () => {
    nav?.classList.toggle('scrolled', window.scrollY > 12);
  }, { passive: true });

  // Hamburger toggle
  toggle?.addEventListener('click', () => {
    const isOpen = mobile.classList.toggle('is-open');
    toggle.classList.toggle('open', isOpen);
    toggle.setAttribute('aria-expanded', isOpen);
  });

  // Close mobile nav when a link is clicked
  mobile?.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mobile.classList.remove('is-open');
      toggle.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

/* ── Active nav link ────────────────────────────────────────────── */
function setActiveNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav__links a, .nav__mobile a').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (href === path || (path === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
}

/* ── FAQ Accordion ──────────────────────────────────────────────── */
function initFAQ() {
  document.querySelectorAll('.faq-item__q').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const item = trigger.closest('.faq-item');
      const isOpen = item.classList.contains('open');

      // Close all open items
      document.querySelectorAll('.faq-item.open').forEach(open => {
        open.classList.remove('open');
      });

      // Open clicked item (unless it was already open)
      if (!isOpen) item.classList.add('open');
    });
  });
}

/* ── Contact Form ───────────────────────────────────────────────── */
function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = form.querySelector('[type="submit"]');
    const status = document.getElementById('form-status');
    btn.disabled = true;
    btn.textContent = 'Sending…';

    try {
      // Netlify Forms — POST to the same page as URL-encoded data
      const encoded = new URLSearchParams(new FormData(form)).toString();
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encoded
      });

      if (res.ok) {
        form.reset();
        showStatus(status, 'success', "Thanks — I'll be in touch within one business day.");
      } else {
        showStatus(status, 'error', 'Something went wrong. Please email me directly.');
      }
    } catch {
      showStatus(status, 'error', 'Could not send. Please email me directly.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send Message';
    }
  });
}

function showStatus(el, type, msg) {
  if (!el) return;
  el.textContent = msg;
  el.className = `form-status form-status--${type}`;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 8000);
}
