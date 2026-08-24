/* ==================================================
   PROFESSIONAL PORTFOLIO INTRO
================================================== */

document.addEventListener("DOMContentLoaded", () => {

    const intro =
        document.getElementById("portfolioIntro");

    if (!intro) {
        return;
    }


    /*
     * Give the browser a moment to render
     * the intro before starting the exit.
     */

    const INTRO_DURATION = 2700;


    setTimeout(() => {

        intro.classList.add("is-exiting");


        /*
         * Completely remove the intro after
         * the exit animation.
         */

        setTimeout(() => {

            intro.remove();

        }, 850);

    }, INTRO_DURATION);

});