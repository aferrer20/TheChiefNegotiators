// Shared header + footer injection
(function () {
  const path = (location.pathname.split('/').pop() || 'index.html');

  const NAV_LINKS = [
    { href: 'index.html', label: 'Access' },
    { href: 'exchange.html', label: 'Exchange' },
    { href: 'inventory.html', label: 'Inventory' },
    { href: 'vera-rubin.html', label: 'Vera Rubin' },
    { href: 'availability.html', label: 'Availability' },
    { href: 'gpuaas.html', label: 'GPUaaS' },
    { href: 'services.html', label: 'Services' },
    { href: 'contact.html', label: 'Contact' },
  ];

  const navHtml = `
    <nav class="nav">
      <div class="wrap nav-inner">
        <a href="index.html" class="brand">
          <img src="assets/logo.png" alt="The Chief Negotiators" class="brand-logo" />
          <span class="brand-word">The Chief <span>Negotiators</span></span>
        </a>
        <div class="nav-links">
          ${NAV_LINKS.map(l => `<a href="${l.href}" class="nav-link${l.href === path ? ' active' : ''}">${l.label}</a>`).join('')}
          <a href="index.html#qualify" class="nav-cta">Request Access</a>
        </div>
        <button class="nav-toggle" aria-label="Menu"></button>
      </div>
    </nav>
  `;

  const footHtml = `
    <footer class="foot">
      <div class="wrap">
        <div class="foot-grid">
          <div>
            <div class="brand" style="margin-bottom:14px">
              <img src="assets/logo.png" alt="" class="brand-logo" />
              <span class="brand-word">The Chief <span>Negotiators</span></span>
            </div>
            <div class="foot-tagline">Strategic access. Stronger outcomes.</div>
            <p class="muted" style="margin-top:14px;max-width:340px">Independent IT consulting and GPU sourcing for enterprise buyers and strategic partners.</p>
          </div>
          <div>
            <h5>GPUs</h5>
            <a href="gpu-b300.html">B300</a>
            <a href="gpu-gb300.html">GB300 NVL72</a>
            <a href="gpu-b200.html">B200</a>
            <a href="gpu-h200.html">H200</a>
            <a href="gpu-h100.html">H100</a>
            <a href="gpuaas.html">GPUaaS clusters</a>
            <a href="vera-rubin.html">Vera Rubin cluster</a>
          </div>
          <div>
            <h5>Portal</h5>
            <a href="exchange.html">The Exchange</a>
            <a href="exchange.html#sell">List capacity</a>
            <a href="index.html#qualify">Request access</a>
            <a href="availability.html">Availability</a>
            <a href="inventory.html">Live Inventory</a>
            <a href="reserve.html">Reserve</a>
            <a href="wtb.html">Want to Buy</a>
            <a href="services.html">Services</a>
          </div>
          <div>
            <h5>Direct</h5>
            <a href="mailto:sales@thechiefnegotiators.com">sales@thechiefnegotiators.com</a>
            <a href="tel:+13056102849">+1 (305) 610&#8209;2849</a>
            <a href="contact.html">Schedule a call</a>
          </div>
          <div>
            <h5>Services</h5>
            <a href="services.html">Rack &amp; stack</a>
            <a href="services.html">Decommissioning</a>
          </div>
        </div>
        <div class="foot-legal">
          <span>&copy; <span id="year"></span> The Chief Negotiators. All rights reserved.</span>
          <span>Discreet &nbsp;/&nbsp; Strategic &nbsp;/&nbsp; Effective</span>
        </div>
      </div>
    </footer>
  `;

  document.addEventListener('DOMContentLoaded', () => {
    const navMount = document.querySelector('[data-nav]');
    const footMount = document.querySelector('[data-foot]');
    if (navMount) navMount.outerHTML = navHtml;
    if (footMount) footMount.outerHTML = footHtml;
    const yr = document.getElementById('year');
    if (yr) yr.textContent = new Date().getFullYear();

    // mobile toggle wiring after injection
    const toggle = document.querySelector('.nav-toggle');
    const links = document.querySelector('.nav-links');
    if (toggle && links) toggle.addEventListener('click', () => {
      links.classList.toggle('open');
      toggle.classList.toggle('open');
    });
  });
})();
