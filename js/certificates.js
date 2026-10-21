/* ==================================================
   CERTIFICATES
   GRID + ZOOM MODAL
================================================== */

document.addEventListener("DOMContentLoaded", () => {

    const modal =
        document.getElementById("certificateModal");

    const modalImage =
        document.getElementById("certificateModalImage");

    const modalClose =
        document.getElementById("certificateModalClose");

    const modalNumber =
        document.getElementById("certificateModalNumber");

    const modalBackdrop =
        document.querySelector(
            ".certificate-modal-backdrop"
        );


    /* ==================================================
       SAFETY CHECK
    ================================================== */

    if (
        !modal ||
        !modalImage ||
        !modalClose
    ) {

        return;

    }


    /* ==================================================
       OPEN MODAL
    ================================================== */

    function openCertificate(card) {

        const image =
            card.dataset.certificate;

        const number =
            card.querySelector(
                ".certificate-card-number"
            )?.textContent.trim() || "";


        if (!image) return;


        modalImage.src = image;

        modalImage.alt =
            `Certificate ${number}`;


        if (modalNumber) {

            modalNumber.textContent =
                number;

        }


        modal.classList.add("is-open");

        modal.setAttribute(
            "aria-hidden",
            "false"
        );


        /*
         * Prevent background scrolling.
         */

        document.body.style.overflow =
            "hidden";


        /*
         * Move focus to close button.
         */

        setTimeout(() => {

            modalClose.focus();

        }, 100);

    }


    /* ==================================================
       CLOSE MODAL
    ================================================== */

    function closeCertificate() {

        modal.classList.remove("is-open");

        modal.setAttribute(
            "aria-hidden",
            "true"
        );


        document.body.style.overflow =
            "";


        /*
         * Clear image after animation.
         */

        setTimeout(() => {

            if (
                !modal.classList.contains(
                    "is-open"
                )
            ) {

                modalImage.src = "";

            }

        }, 350);

    }


    /* ==================================================
       CARD CLICK
    ================================================== */

    /* One listener for the whole page, so certificates added from the
       Admin Panel (after the page loads) open the viewer too. */
    document.addEventListener("click", (event) => {

        const card = event.target.closest(".certificate-card");

        if (card) openCertificate(card);

    });


    /* ==================================================
       CLOSE BUTTON
    ================================================== */

    modalClose.addEventListener(
        "click",
        closeCertificate
    );


    /* ==================================================
       BACKDROP CLICK
    ================================================== */

    if (modalBackdrop) {

        modalBackdrop.addEventListener(
            "click",
            closeCertificate
        );

    }


    /* ==================================================
       ESCAPE KEY
    ================================================== */

    document.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Escape" &&
                modal.classList.contains(
                    "is-open"
                )
            ) {

                closeCertificate();

            }

        }
    );

});