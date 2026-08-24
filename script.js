/* ==================================================
   ABOUT SECTION — STAGGERED SCROLL REVEAL
================================================== */

document.addEventListener("DOMContentLoaded", () => {

    const aboutCards = document.querySelectorAll(".about-reveal");

    if (!aboutCards.length) return;

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

    const texts = [
        "I am a motivated and enthusiastic Data Analyst with a strong foundation in data processing, SQL, and analytical thinking.",
        "I build structured data solutions and turn raw information into meaningful insights.",
        "I also have experience in Digital Marketing, with a strong understanding of online strategies and user engagement.",
        "I enjoy leveraging data and technology to support impactful business decisions."
    ];

    let textIndex = 0;
    let charIndex = 0;
    let isDeleting = false;

    const typingSpeed = 35;
    const deletingSpeed = 18;
    const pauseAfterTyping = 1800;
    const pauseAfterDeleting = 500;

    function typeEffect() {

        const currentText = texts[textIndex];

        if (!isDeleting) {

            typewriter.textContent = currentText.substring(0, charIndex + 1);
            charIndex++;

            if (charIndex === currentText.length) {
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