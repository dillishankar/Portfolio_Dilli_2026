/* ==================================================
   CERTIFICATES
   SCROLL CONTROLLED ANIMATION
================================================== */

document.addEventListener("DOMContentLoaded", () => {

    const section =
        document.querySelector(".certificates-section");

    const sticky =
        document.querySelector(".certificates-sticky");

    const viewport =
        document.querySelector(".certificates-viewport");

    const cards =
        document.querySelectorAll(".certificate-card");

    const progressBar =
        document.getElementById(
            "certificatesProgressBar"
        );

    const currentCounter =
        document.getElementById(
            "certificateCurrent"
        );

    const totalCounter =
        document.getElementById(
            "certificateTotal"
        );


    /* ==================================================
       SAFETY CHECK
    ================================================== */

    if (
        !section ||
        !sticky ||
        !viewport ||
        !cards.length
    ) {
        return;
    }


    /* ==================================================
       SETTINGS
    ================================================== */

    const MOBILE_BREAKPOINT = 600;

    let sectionScrollDistance = 0;

    let currentProgress = 0;

    let targetProgress = 0;

    let ticking = false;


    totalCounter.textContent =
        String(cards.length).padStart(2, "0");


    /* ==================================================
       CALCULATE SECTION HEIGHT
    ================================================== */

    function calculateSection() {

        /*
         * One viewport of scrolling is reserved
         * for each certificate transition.
         */

        const step =
            window.innerHeight * 0.72;


        const totalHeight =
            window.innerHeight +
            ((cards.length - 1) * step);


        section.style.height =
            `${totalHeight}px`;


        sectionScrollDistance =
            totalHeight -
            window.innerHeight;


        updateCards();

    }


    /* ==================================================
       GET SCROLL PROGRESS
    ================================================== */

    function getScrollProgress() {

        const sectionTop =
            section.offsetTop;


        const scrollY =
            window.scrollY;


        const distance =
            scrollY - sectionTop;


        if (sectionScrollDistance <= 0) {
            return 0;
        }


        return Math.min(
            Math.max(
                distance /
                sectionScrollDistance,
                0
            ),
            1
        );

    }


    /* ==================================================
       UPDATE CERTIFICATE CARDS
    ================================================== */

    function updateCards() {

        const progress =
            currentProgress *
            (cards.length - 1);


        cards.forEach((card, index) => {

            /*
             * Distance from the currently active
             * certificate.
             */

            const distance =
                index - progress;


            const absoluteDistance =
                Math.abs(distance);


            /*
             * Active card
             */

            let scale =
                1 -
                Math.min(
                    absoluteDistance * 0.08,
                    0.18
                );


            /*
             * Vertical movement
             *
             * Previous card moves upward.
             * Next card waits below and comes up.
             */

            let translateY =
                distance * 95;


            /*
             * Slight horizontal depth.
             */

            let translateX =
                distance * 18;


            /*
             * Opacity
             */

            let opacity =
                1 -
                Math.min(
                    absoluteDistance * 0.85,
                    0.85
                );


            /*
             * Blur cards that are further away.
             */

            let blur =
                Math.min(
                    absoluteDistance * 2,
                    4
                );


            /*
             * Cards further away should sit
             * behind the active certificate.
             */

            let zIndex =
                100 -
                Math.round(
                    absoluteDistance * 10
                );


            /*
             * Keep the active card crisp.
             */

            if (absoluteDistance < 0.15) {

                scale = 1;

                translateY =
                    distance * 70;

                translateX =
                    distance * 10;

                opacity = 1;

                blur = 0;

            }


            card.style.transform =
                `translate3d(
                    calc(-50% + ${translateX}px),
                    calc(-50% + ${translateY}px),
                    0
                )
                scale(${scale})`;


            card.style.opacity =
                opacity;


            card.style.filter =
                `blur(${blur}px)`;


            card.style.zIndex =
                zIndex;

        });


        /* ==================================================
           CURRENT CERTIFICATE
        ================================================== */

        const activeIndex =
            Math.min(
                Math.round(progress),
                cards.length - 1
            );


        currentCounter.textContent =
            String(activeIndex + 1)
                .padStart(2, "0");


        /* ==================================================
           PROGRESS BAR
        ================================================== */

        progressBar.style.width =
            `${currentProgress * 100}%`;

    }


    /* ==================================================
       SCROLL
    ================================================== */

    function handleScroll() {

        targetProgress =
            getScrollProgress();


        if (!ticking) {

            requestAnimationFrame(() => {

                /*
                 * Smooth interpolation.
                 */

                currentProgress +=
                    (
                        targetProgress -
                        currentProgress
                    ) * 0.10;


                if (
                    Math.abs(
                        targetProgress -
                        currentProgress
                    ) < 0.001
                ) {

                    currentProgress =
                        targetProgress;

                }


                updateCards();


                ticking = false;

            });


            ticking = true;

        }

    }


    /* ==================================================
       RESIZE
    ================================================== */

    window.addEventListener(
        "resize",
        () => {

            calculateSection();

        }
    );


    /* ==================================================
       SCROLL LISTENER
    ================================================== */

    window.addEventListener(
        "scroll",
        handleScroll,
        {
            passive: true
        }
    );


    /* ==================================================
       INITIALIZE
    ================================================== */

    calculateSection();

    currentProgress =
        getScrollProgress();

    targetProgress =
        currentProgress;

    updateCards();

});