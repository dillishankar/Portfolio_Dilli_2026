/* ==================================================
   SCROLL REVEAL
================================================== */

const observerOptions = {
    threshold: 0.15
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

document.querySelectorAll('.reveal-on-scroll').forEach((element) => {
    observer.observe(element);
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