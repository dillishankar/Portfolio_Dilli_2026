/* ==================================================
   CUSTOM CURSOR — DOT + TRAILING RING
   Runs only on devices with a real mouse (hover + fine pointer).
   Phones and tablets are skipped completely.
================================================== */

document.addEventListener("DOMContentLoaded", () => {

    const hasMouse = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    if (!hasMouse) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* Elements that should trigger the "hover" ring */
    const interactiveSelector =
        "a, button, [role='button'], summary, label[for], .certificate-card";

    /* Elements where the normal text cursor must be used */
    const textSelector = "input, textarea, select";

    const dot = document.createElement("div");
    const ring = document.createElement("div");
    const ringInner = document.createElement("div");

    dot.className = "cursor-dot";
    ring.className = "cursor-ring";
    ringInner.className = "cursor-ring-inner";

    dot.setAttribute("aria-hidden", "true");
    ring.setAttribute("aria-hidden", "true");

    ring.appendChild(ringInner);
    document.body.appendChild(ring);
    document.body.appendChild(dot);

    document.documentElement.classList.add("has-custom-cursor");

    let mouseX = 0;
    let mouseY = 0;
    let ringX = 0;
    let ringY = 0;
    let started = false;

    const show = () => {
        dot.classList.add("is-active");
        ring.classList.add("is-active");
        dot.classList.remove("is-hidden");
        ring.classList.remove("is-hidden");
    };

    const hide = () => {
        dot.classList.add("is-hidden");
        ring.classList.add("is-hidden");
    };

    document.addEventListener("mousemove", (e) => {

        mouseX = e.clientX;
        mouseY = e.clientY;

        if (!started) {
            ringX = mouseX;
            ringY = mouseY;
            started = true;
            show();
        }

        dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;

    }, { passive: true });

    /* Smooth trailing ring */
    const animate = () => {

        if (reduceMotion) {
            ringX = mouseX;
            ringY = mouseY;
        } else {
            ringX += (mouseX - ringX) * 0.18;
            ringY += (mouseY - ringY) * 0.18;
        }

        ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;

        requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);

    /* Hover state + text-field handling */
    document.addEventListener("mouseover", (e) => {

        const target = e.target;

        if (!(target instanceof Element)) return;

        if (target.closest(textSelector)) {
            hide();
            return;
        }

        if (started) show();

        const isInteractive = !!target.closest(interactiveSelector);

        ring.classList.toggle("is-hover", isInteractive);
        dot.classList.toggle("is-hover", isInteractive);
    });

    /* Press feedback */
    document.addEventListener("mousedown", () => ring.classList.add("is-down"));
    document.addEventListener("mouseup", () => ring.classList.remove("is-down"));

    /* Mouse leaves / enters the browser window */
    document.documentElement.addEventListener("mouseleave", hide);
    document.documentElement.addEventListener("mouseenter", () => {
        if (started) show();
    });

});
