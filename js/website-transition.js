/* ==================================================
   PROFESSIONAL PORTFOLIO INTRO + HERO SYNC
================================================== */

document.addEventListener("DOMContentLoaded", () => {

    const intro = document.getElementById("portfolioIntro");
    const selectionBox = document.querySelector(".selection-box-wrapper");

    /* Duration matching the initial overlay display */
    const INTRO_DURATION = 2700;

    setTimeout(() => {

        if (intro) {
            intro.classList.add("is-exiting");

            /* Remove intro element after exit transition */
            setTimeout(() => {
                intro.remove();
            }, 850);
        }

        /* Trigger "here's mine!" outline and node pop animation right as intro exits */
        if (selectionBox) {
            selectionBox.classList.add("animate-in");
        }

    }, INTRO_DURATION);

});