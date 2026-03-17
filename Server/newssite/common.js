/* ============================================
   NEWS REPORTER LIVE - SHARED JS
   Scroll Reveal, Dark Mode, Header Effects
   ============================================ */

// Scroll Reveal with IntersectionObserver
(function() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                // Optional: unobserve after revealing
                // observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px'
    });

    // Observe all elements with nr-reveal class
    function initReveal() {
        document.querySelectorAll('.nr-reveal').forEach(el => observer.observe(el));
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initReveal);
    } else {
        initReveal();
    }

    // Also observe dynamically added elements
    const mutationObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                    if (node.classList && node.classList.contains('nr-reveal')) {
                        observer.observe(node);
                    }
                    node.querySelectorAll && node.querySelectorAll('.nr-reveal').forEach(el => observer.observe(el));
                }
            });
        });
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });
})();

// Header scroll effect
(function() {
    const header = document.querySelector('.nr-header');
    if (!header) return;
    
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
        const currentScroll = window.scrollY;
        if (currentScroll > 10) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
        lastScroll = currentScroll;
    }, { passive: true });
})();

// Smooth number counter animation
function animateCounters() {
    document.querySelectorAll('[data-count]').forEach(el => {
        const target = parseFloat(el.dataset.count);
        const duration = 1500;
        const start = performance.now();
        const prefix = el.dataset.prefix || '';
        const suffix = el.dataset.suffix || '';
        
        function update(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(target * eased);
            el.textContent = prefix + current + suffix;
            if (progress < 1) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    });
}

// Dark mode toggle (unified)
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark-mode') || document.body.classList.contains('dark');
    localStorage.setItem('nr-dark-mode', isDark ? '1' : '0');
    
    // Update toggle button text
    document.querySelectorAll('.nr-dark-toggle').forEach(btn => {
        btn.textContent = isDark ? '☀ Light' : '☾ Dark';
    });
}

// Apply saved dark mode preference
(function() {
    const saved = localStorage.getItem('nr-dark-mode');
    if (saved === '1') {
        document.body.classList.add('dark-mode', 'dark');
        document.querySelectorAll('.nr-dark-toggle').forEach(btn => {
            btn.textContent = '☀ Light';
        });
    }
})();

// Smooth scroll to anchors
document.addEventListener('click', (e) => {
    const anchor = e.target.closest('a[href^="#"]');
    if (anchor) {
        const target = document.querySelector(anchor.getAttribute('href'));
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
});
