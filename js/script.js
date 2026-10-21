/* ==================================================
   ABOUT SECTION — STAGGERED SCROLL REVEAL
================================================== */

document.addEventListener("DOMContentLoaded", () => {

    const aboutCards = document.querySelectorAll(".about-reveal");

    if (!aboutCards.length) return;

    /* Enable the About scroll animations (CSS hides the elements until they scroll in).
       Skipped for users who prefer reduced motion, so nothing stays hidden. */
    const aboutSection = document.getElementById("about");

    if (aboutSection && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        aboutSection.classList.add("about-anim");
    }

    const aboutObserver = new IntersectionObserver(
        (entries, observer) => {

            entries.forEach((entry) => {

                if (entry.isIntersecting) {

                    entry.target.classList.add("is-visible");

                    observer.unobserve(entry.target);
                }

            });

        },
        {
            threshold: 0.18,
            rootMargin: "0px 0px -40px 0px"
        }
    );

    aboutCards.forEach((card) => {
        aboutObserver.observe(card);
    });

});

/* ==================================================
   ABOUT ME — TYPEWRITER EFFECT
================================================== */

document.addEventListener("DOMContentLoaded", () => {

    const typewriter = document.getElementById("aboutTypewriter");

    if (!typewriter) return;

    /* Default text. The Admin Panel can replace it (see js/dynamic.js). */
    const defaultTexts = [
        "I am a motivated and enthusiastic Data Analyst with a strong foundation in data processing, SQL, and analytical thinking.",
        "I build structured data solutions and turn raw information into meaningful insights.",
        "I also have experience in Digital Marketing, with a strong understanding of online strategies and user engagement.",
        "I enjoy leveraging data and technology to support impactful business decisions."
    ];

    const getTexts = () =>
        (window.portfolioAboutTexts && window.portfolioAboutTexts.length)
            ? window.portfolioAboutTexts
            : defaultTexts;

    let textIndex = 0;
    let charIndex = 0;
    let isDeleting = false;

    const typingSpeed = 35;
    const deletingSpeed = 18;
    const pauseAfterTyping = 1800;
    const pauseAfterDeleting = 500;

    function typeEffect() {

        const texts = getTexts();

        if (textIndex >= texts.length) textIndex = 0;

        const currentText = texts[textIndex];

        if (!isDeleting) {

            typewriter.textContent = currentText.substring(0, charIndex + 1);
            charIndex++;

            if (charIndex >= currentText.length) {
                isDeleting = true;

                setTimeout(typeEffect, pauseAfterTyping);
                return;
            }

            setTimeout(typeEffect, typingSpeed);

        } else {

            typewriter.textContent = currentText.substring(0, charIndex - 1);
            charIndex--;

            if (charIndex === 0) {
                isDeleting = false;
                textIndex = (textIndex + 1) % texts.length;

                setTimeout(typeEffect, pauseAfterDeleting);
                return;
            }

            setTimeout(typeEffect, deletingSpeed);
        }
    }

    typeEffect();
});




/* ==================================================
   WHY HIRE ME — RUNNING COUNTER ANIMATION
================================================== */

document.addEventListener("DOMContentLoaded", () => {
    const counters = document.querySelectorAll(".counter-val");
    if (!counters.length) return;

    let animated = false;

    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting && !animated) {
                animated = true;

                counters.forEach((counter) => {
                    const target = +counter.getAttribute("data-target");
                    const duration = 1800; // Animation speed in ms
                    const stepTime = 20;
                    const steps = duration / stepTime;
                    const increment = target / steps;
                    let current = 0;

                    const timer = setInterval(() => {
                        current += increment;
                        if (current >= target) {
                            counter.textContent = target;
                            clearInterval(timer);
                        } else {
                            counter.textContent = Math.ceil(current);
                        }
                    }, stepTime);
                });
            }
        });
    }, { threshold: 0.4 });

    const hireCard = document.querySelector(".why-hire-card");
    if (hireCard) {
        counterObserver.observe(hireCard);
    }
});


/* ==================================================
   WHY HIRE ME — STAGGERED REVEAL & COUNTER SYNC
================================================== */

document.addEventListener("DOMContentLoaded", () => {
    const hireCard = document.querySelector(".why-hire-card");
    const counters = document.querySelectorAll(".counter-val");
    if (!hireCard) return;

    let animated = false;

    const hireObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                /* 1. Trigger the staggered CSS ribbon and image reveal sequence */
                hireCard.classList.add("is-visible");

                /* 2. Trigger counter numbers running up */
                if (!animated && counters.length) {
                    animated = true;

                    setTimeout(() => {
                        counters.forEach((counter) => {
                            const target = +counter.getAttribute("data-target");
                            const duration = 1800;
                            const stepTime = 20;
                            const steps = duration / stepTime;
                            const increment = target / steps;
                            let current = 0;

                            const timer = setInterval(() => {
                                current += increment;
                                if (current >= target) {
                                    counter.textContent = target;
                                    clearInterval(timer);
                                } else {
                                    counter.textContent = Math.ceil(current);
                                }
                            }, stepTime);
                        });
                    }, 700); // Waits for card reveal before starting numbers
                }
            }
        });
    }, { threshold: 0.35 });

    hireObserver.observe(hireCard);
});


/* ==================================================
   MOBILE NAV — CLOSE THE DRAWER AFTER A LINK IS TAPPED
================================================== */

document.addEventListener("DOMContentLoaded", () => {

    const mobileNavMenu = document.getElementById("mobileNavMenu");

    /* Bootstrap bundle is loaded from the CDN before this file */
    if (!mobileNavMenu || typeof bootstrap === "undefined") return;

    mobileNavMenu.querySelectorAll("a").forEach((link) => {

        link.addEventListener("click", () => {

            bootstrap.Collapse
                .getOrCreateInstance(mobileNavMenu, { toggle: false })
                .hide();

        });

    });

});
