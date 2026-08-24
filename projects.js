/* ==================================================
   PROJECTS — HORIZONTAL SCROLL SHOWCASE
================================================== */

document.addEventListener("DOMContentLoaded", () => {

    const projectsSection =
        document.querySelector(".projects-section");

    const projectsTrack =
        document.getElementById("projectsTrack");

    const progressBar =
        document.getElementById("projectsProgressBar");


    /* ----------------------------------------------
       SAFETY CHECK
    ---------------------------------------------- */

    if (!projectsSection || !projectsTrack) {
        return;
    }


    /* ----------------------------------------------
       MOBILE CHECK
       Desktop gets scroll-driven animation.
       Mobile uses native horizontal scrolling.
    ---------------------------------------------- */

    const mobileBreakpoint = 991;


    let currentX = 0;
    let targetX = 0;

    let maxTranslate = 0;

    let ticking = false;


    /* ----------------------------------------------
       CALCULATE HORIZONTAL DISTANCE
    ---------------------------------------------- */

    function calculateDimensions() {

        if (window.innerWidth <= mobileBreakpoint) {

            maxTranslate = 0;

            projectsTrack.style.transform = "none";

            return;
        }


        const trackWidth =
            projectsTrack.scrollWidth;

        const viewportWidth =
            window.innerWidth;


        maxTranslate =
            Math.max(
                0,
                trackWidth - viewportWidth + 40
            );


        updateHorizontalPosition();

    }


    /* ----------------------------------------------
       GET SECTION SCROLL PROGRESS
    ---------------------------------------------- */

    function getProgress() {

        const sectionTop =
            projectsSection.offsetTop;

        const sectionHeight =
            projectsSection.offsetHeight;

        const viewportHeight =
            window.innerHeight;


        const scrollDistance =
            sectionHeight - viewportHeight;


        if (scrollDistance <= 0) {
            return 0;
        }


        const currentScroll =
            window.scrollY - sectionTop;


        const progress =
            currentScroll / scrollDistance;


        return Math.min(
            Math.max(progress, 0),
            1
        );

    }


    /* ----------------------------------------------
       UPDATE TARGET POSITION
    ---------------------------------------------- */

    function updateHorizontalPosition() {

        if (window.innerWidth <= mobileBreakpoint) {
            return;
        }


        const progress =
            getProgress();


        /*
         * Cards move from RIGHT → LEFT
         * as user scrolls DOWN.
         *
         * This gives the natural horizontal
         * portfolio showcase effect.
         */

        targetX =
            -(maxTranslate * progress);


        /* Progress indicator */

        if (progressBar) {

            progressBar.style.width =
                `${progress * 100}%`;

        }

    }


    /* ----------------------------------------------
       SMOOTH ANIMATION
    ---------------------------------------------- */

    function animate() {

        const difference =
            targetX - currentX;


        currentX +=
            difference * 0.085;


        if (Math.abs(difference) < 0.1) {
            currentX = targetX;
        }


        if (window.innerWidth > mobileBreakpoint) {

            projectsTrack.style.transform =
                `translate3d(${currentX}px, 0, 0)`;

        }


        requestAnimationFrame(animate);

    }


    /* ----------------------------------------------
       SCROLL EVENT
    ---------------------------------------------- */

    window.addEventListener(
        "scroll",
        () => {

            if (!ticking) {

                window.requestAnimationFrame(() => {

                    updateHorizontalPosition();

                    ticking = false;

                });

                ticking = true;

            }

        },
        {
            passive: true
        }
    );


    /* ----------------------------------------------
       RESIZE EVENT
    ---------------------------------------------- */

    window.addEventListener(
        "resize",
        () => {

            calculateDimensions();

        }
    );


    /* ----------------------------------------------
       INITIALIZE
    ---------------------------------------------- */

    calculateDimensions();

    updateHorizontalPosition();

    animate();

});