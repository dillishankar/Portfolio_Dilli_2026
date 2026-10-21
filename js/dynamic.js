/* ==================================================
   DYNAMIC CONTENT
   Loads the content you manage in the Admin Panel and
   fills the EXISTING markup (same classes, same design).

   If Supabase is not configured or unreachable, nothing
   changes: the built-in content stays on the page.
================================================== */

(function () {

    "use strict";

    const cfg = window.PORTFOLIO_CONFIG || {};

    const configured =
        cfg.SUPABASE_URL &&
        cfg.SUPABASE_ANON_KEY &&
        !/YOUR-/i.test(cfg.SUPABASE_URL + cfg.SUPABASE_ANON_KEY);

    const REST = configured ? cfg.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1" : "";

    /* ----------------------------------------------
       HELPERS
    ---------------------------------------------- */

    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

    /* Only http(s) or relative URLs are allowed (blocks javascript: etc.) */
    function safeUrl(value) {

        const url = String(value || "").trim();

        if (!url) return "";

        try {
            const parsed = new URL(url, window.location.href);
            return /^https?:$/.test(parsed.protocol) ? url : "";
        } catch (e) {
            return "";
        }
    }

    function el(tag, className, text) {

        const node = document.createElement(tag);

        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;

        return node;
    }

    async function get(table, query) {

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);

        try {
            const res = await fetch(`${REST}/${table}?${query}`, {
                headers: {
                    apikey: cfg.SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${cfg.SUPABASE_ANON_KEY}`
                },
                signal: controller.signal
            });

            if (!res.ok) throw new Error(`${table}: HTTP ${res.status}`);

            return await res.json();

        } finally {
            clearTimeout(timer);
        }
    }

    /* ----------------------------------------------
       AVAILABILITY  (nav badge + top banner)
    ---------------------------------------------- */

    function renderAvailability(value) {

        if (!value) return;

        const available = value.available !== false;

        $$(".status-badge").forEach((badge) => {

            badge.classList.toggle("is-unavailable", !available);

            const text = $(".status-text", badge);

            if (text && value.badge_text) text.textContent = value.badge_text;
        });

        if (value.banner_text) {

            $$(".announcement-banner-boxed .marquee-track > span:not(.dot)")
                .forEach((span) => { span.textContent = value.banner_text; });
        }
    }

    /* ----------------------------------------------
       ABOUT ME  (typewriter text — read by script.js)
    ---------------------------------------------- */

    function renderAbout(value) {

        const texts = value && Array.isArray(value.texts)
            ? value.texts.map((t) => String(t).trim()).filter(Boolean)
            : [];

        if (texts.length) window.portfolioAboutTexts = texts;
    }

    /* ----------------------------------------------
       PROFILE  (email, WhatsApp, GitHub, LinkedIn)
    ---------------------------------------------- */

    function renderProfile(value) {

        if (!value) return;

        if (value.email) {

            $$('a[href^="mailto:"]').forEach((a) => {

                const query = a.getAttribute("href").split("?")[1];

                a.setAttribute("href", "mailto:" + value.email + (query ? "?" + query : ""));
            });
        }

        const digits = String(value.whatsapp || "").replace(/\D/g, "");

        $$('a[href*="wa.me"]').forEach((a) => {

            if (digits) {
                a.setAttribute("href", "https://wa.me/" + digits);
                a.hidden = false;
            } else {
                a.hidden = true;
            }
        });

        [["GitHub", value.github], ["LinkedIn", value.linkedin]].forEach(([title, link]) => {

            $$(`a[title="${title}"]`).forEach((a) => {

                const url = safeUrl(link);

                if (url) {
                    a.setAttribute("href", url);
                    a.hidden = false;
                } else {
                    a.hidden = true;
                }
            });
        });
    }

    /* ----------------------------------------------
       RESUME  (every CV / Download link)
    ---------------------------------------------- */

    function renderResume(value) {

        let url = safeUrl(value && value.url);

        if (!url) return;

        /* Files on Supabase Storage are on another domain, where the HTML "download"
           attribute is ignored — ask the server to send it as a download instead. */
        if (url.includes("/storage/v1/object/public/")) {
            url += (url.includes("?") ? "&" : "?") + "download=Dillishankar-Resume.pdf";
        }

        $$("a[download]").forEach((a) => a.setAttribute("href", url));
    }

    /* ----------------------------------------------
       PROJECTS
    ---------------------------------------------- */

    function renderProjects(rows) {

        const track = document.getElementById("projectsTrack");

        if (!track || !rows.length) return;

        const endCard = $(".projects-end-card", track);

        $$(".project-card", track).forEach((card) => card.remove());

        rows.forEach((project, index) => {

            const number = String(index + 1).padStart(2, "0");

            const card = el("article", `project-card project-card-${number}`);

            /* image */
            const imageWrap = el("div", "project-image-wrap");
            const image = el("img", "project-image");

            image.src = safeUrl(project.image_url);
            image.alt = project.title;

            imageWrap.append(image, el("div", "project-number", number));

            /* content */
            const content = el("div", "project-content");
            const meta = el("div", "project-meta");

            (project.tags || []).forEach((tag) => meta.append(el("span", "", tag)));

            const link = el("a", "project-link", (project.link_label || "View Project") + " ");

            link.href = safeUrl(project.link_url) || "#";
            link.append(el("i", "bi bi-arrow-up-right"));

            content.append(
                meta,
                el("h3", "", project.title),
                el("p", "", project.description || ""),
                link
            );

            card.append(imageWrap, content);

            track.insertBefore(card, endCard || null);
        });

        /* let projects.js recalculate the horizontal scroll distance */
        window.dispatchEvent(new Event("resize"));
    }

    /* ----------------------------------------------
       CERTIFICATES
    ---------------------------------------------- */

    function renderCertificates(rows) {

        const grid = $(".certificates-grid");

        if (!grid || !rows.length) return;

        grid.replaceChildren();

        rows.forEach((cert, index) => {

            /* first card is the large tile, the fourth is the wide tile (same as the original layout) */
            const size = index === 0 ? " certificate-card-large" : index === 3 ? " certificate-card-wide" : "";

            const card = el("button", "certificate-card" + size);

            card.type = "button";
            card.dataset.certificate = safeUrl(cert.image_url);
            card.setAttribute("aria-label", "View " + cert.title);

            const image = el("img", "certificate-image");

            image.src = safeUrl(cert.image_url);
            image.alt = cert.title;

            const view = el("span", "certificate-view", "VIEW ");

            view.append(el("i", "bi bi-arrow-up-right"));

            card.append(image, el("span", "certificate-overlay"), view);

            grid.append(card);
        });
    }

    /* ----------------------------------------------
       SKILLS  (two scrolling columns, same markup)
    ---------------------------------------------- */

    function skillChip(skill) {

        const chip = el("div", "skill-card-v");
        const icon = el("img");

        icon.src = safeUrl(skill.icon_url);
        icon.alt = skill.name;

        if (skill.icon_style === "invert") icon.className = "invert-icon";
        if (skill.icon_style === "white") icon.className = "white-icon";

        chip.append(icon, el("span", "", skill.name));

        return chip;
    }

    function fillColumn(selector, skills) {

        const track = $(`${selector} .vertical-track`);

        if (!track) return;

        track.replaceChildren();

        if (!skills.length) return;

        /* make sure one set is tall enough to scroll smoothly (the original columns hold 6–7 skills) */
        let set = skills.slice();

        while (set.length < 6) set = set.concat(skills);

        /* the set is rendered twice so the loop is seamless (animation moves -50%) */
        [...set, ...set].forEach((skill) => track.append(skillChip(skill)));

        /* keep the original scrolling speed per item */
        track.style.animationDuration = Math.max(10, set.length * 3.6) + "s";
    }

    function renderSkills(rows) {

        if (!rows.length) return;

        fillColumn(".marquee-up", rows.filter((_, i) => i % 2 === 0));
        fillColumn(".marquee-down", rows.filter((_, i) => i % 2 === 1));
    }

    /* ----------------------------------------------
       CONTACT FORM  ("Stay Updated" box in the footer)
       Saves the visitor's email as a message in the Admin Panel.
    ---------------------------------------------- */

    function setupContactForm() {

        const form = $(".footer-newsletter-form");

        if (!form) return;

        form.addEventListener("submit", async (event) => {

            event.preventDefault();

            const email = $('input[type="email"]', form);
            const trap = $('input[name="website"]', form);
            const button = $('button[type="submit"]', form);

            /* honeypot: real visitors never fill this hidden field */
            if (trap && trap.value) return;

            const original = button ? button.textContent : "";

            if (button) { button.disabled = true; button.textContent = "Sending…"; }

            try {

                if (configured) {

                    const res = await fetch(`${REST}/messages`, {
                        method: "POST",
                        headers: {
                            apikey: cfg.SUPABASE_ANON_KEY,
                            Authorization: `Bearer ${cfg.SUPABASE_ANON_KEY}`,
                            "Content-Type": "application/json",
                            Prefer: "return=minimal"
                        },
                        body: JSON.stringify({
                            email: email.value.trim(),
                            message: "Wants to connect / stay updated (footer form)"
                        })
                    });

                    if (!res.ok) throw new Error("HTTP " + res.status);
                }

                alert("Thank you for Connecting!");
                form.reset();

            } catch (error) {

                console.warn("Message could not be sent:", error);
                alert("Sorry, something went wrong. Please try again or email me directly.");

            } finally {

                if (button) { button.disabled = false; button.textContent = original; }
            }
        });
    }

    /* ----------------------------------------------
       START
    ---------------------------------------------- */

    async function load() {

        setupContactForm();

        if (!configured) return;

        const jobs = [
            ["settings", "select=key,value", (rows) => {
                const by = Object.fromEntries(rows.map((r) => [r.key, r.value]));
                renderAvailability(by.availability);
                renderAbout(by.about);
                renderProfile(by.profile);
                renderResume(by.resume);
            }],
            ["projects", "select=*&order=sort_order.asc,created_at.asc", renderProjects],
            ["certificates", "select=*&order=sort_order.asc,created_at.asc", renderCertificates],
            ["skills", "select=*&order=sort_order.asc,created_at.asc", renderSkills]
        ];

        await Promise.all(jobs.map(async ([table, query, render]) => {

            try {
                render(await get(table, query));
            } catch (error) {
                console.warn("Dynamic content skipped:", error.message);
            }
        }));
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", load);
    } else {
        load();
    }

})();
