/* ==================================================
   ADMIN PANEL
   Talks to Supabase. Security is enforced by the database
   (see supabase/schema.sql) — this file only provides the screens.
================================================== */

(() => {

    "use strict";

    /* never allow the admin page to be shown inside another site's frame */
    if (window.top !== window.self) {
        try { window.top.location = window.self.location; } catch (e) { document.body.textContent = ""; }
    }

    const cfg = window.PORTFOLIO_CONFIG || {};
    const BUCKET = cfg.BUCKET || "portfolio-media";

    const configured = !!(
        cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
        !/YOUR-/i.test(cfg.SUPABASE_URL + cfg.SUPABASE_ANON_KEY) &&
        window.supabase
    );

    const IDLE_LIMIT_MS = 30 * 60 * 1000;      /* auto sign-out after 30 minutes without activity */
    const MAX_IMAGE_MB = 8;
    const MAX_PDF_MB = 10;

    let sb = null;
    let currentSection = "dashboard";
    let idleTimer = null;

    /* ----------------------------------------------
       SMALL HELPERS
    ---------------------------------------------- */

    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

    const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

    const view = $("#view");

    /* images saved as "assets/..." live in the main site, one folder up from /admin */
    function assetUrl(url) {
        const u = String(url || "");
        if (!u) return "";
        return /^(https?:)?\/\/|^data:|^blob:/i.test(u) ? u : "../" + u.replace(/^\/+/, "");
    }

    function isHttpOrRelative(value) {
        try {
            const p = new URL(value, "https://example.invalid/");
            return /^https?:$/.test(p.protocol);
        } catch (e) { return false; }
    }

    function friendlyError(error) {
        const msg = (error && (error.message || error.error_description)) || String(error || "Unknown error");
        if (/row-level security|permission denied|not authorized/i.test(msg)) {
            return "Not allowed. Please sign out and sign in again with the admin account.";
        }
        if (/Failed to fetch|NetworkError|network/i.test(msg)) {
            return "Network problem. Check your connection and try again.";
        }
        if (/mime type|not supported|invalid_mime/i.test(msg)) {
            return "That file type is not allowed.";
        }
        if (/exceeded the maximum allowed size|too large|payload/i.test(msg)) {
            return "That file is too large.";
        }
        return msg;
    }

    let toastTimer = null;

    function toast(message, isError = false) {
        const node = $("#toast");
        node.textContent = message;
        node.classList.toggle("is-error", isError);
        node.classList.add("is-show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => node.classList.remove("is-show"), isError ? 5000 : 2600);
    }

    function fmtDate(iso) {
        const d = new Date(iso);
        return isNaN(d) ? "" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    }

    function loading() {
        view.innerHTML = '<div class="adm-loading"><div class="adm-spinner" aria-label="Loading"></div></div>';
    }

    async function withBusy(button, label, task) {
        const original = button ? button.innerHTML : "";
        if (button) { button.disabled = true; button.textContent = label; }
        try { return await task(); }
        finally { if (button) { button.disabled = false; button.innerHTML = original; } }
    }

    /* ----------------------------------------------
       MODAL
    ---------------------------------------------- */

    function openModal({ title, bodyHtml, submitLabel = "Save", onSubmit, onOpen, hideCancel = false, danger = false }) {

        return new Promise((resolve) => {

            const root = $("#modalRoot");

            root.innerHTML = `
                <div class="adm-modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
                    <form class="adm-modal-panel" novalidate>
                        <h2>${esc(title)}</h2>
                        ${bodyHtml}
                        <p class="adm-error" data-error role="alert"></p>
                        <div class="adm-modal-actions">
                            ${hideCancel ? "" : '<button type="button" class="adm-btn adm-btn--ghost" data-cancel>Cancel</button>'}
                            <button type="submit" class="adm-btn ${danger ? "adm-btn--danger" : ""}" data-submit>${esc(submitLabel)}</button>
                        </div>
                    </form>
                </div>`;

            document.body.style.overflow = "hidden";

            const overlay = $(".adm-modal", root);
            const form = $("form", root);
            const errorBox = $("[data-error]", root);
            const submit = $("[data-submit]", root);
            let busy = false;

            function close(result) {
                document.removeEventListener("keydown", onKey);
                root.innerHTML = "";
                document.body.style.overflow = "";
                resolve(result);
            }

            function onKey(e) { if (e.key === "Escape" && !busy) close(false); }

            document.addEventListener("keydown", onKey);

            overlay.addEventListener("mousedown", (e) => { if (e.target === overlay && !busy) close(false); });

            const cancel = $("[data-cancel]", root);
            if (cancel) cancel.addEventListener("click", () => { if (!busy) close(false); });

            form.addEventListener("submit", async (e) => {

                e.preventDefault();

                if (busy) return;

                busy = true;
                errorBox.textContent = "";

                const label = submit.textContent;
                submit.disabled = true;
                submit.textContent = "Working…";

                try {
                    if (onSubmit) await onSubmit(form);
                    close(true);
                } catch (error) {
                    errorBox.textContent = friendlyError(error);
                    submit.disabled = false;
                    submit.textContent = label;
                    busy = false;
                }
            });

            if (onOpen) onOpen(form);

            const first = $("input:not([type=file]):not([type=hidden]), textarea, select", form) || submit;
            setTimeout(() => first.focus(), 30);
        });
    }

    function confirmBox(message, confirmLabel = "Delete") {
        return openModal({
            title: "Are you sure?",
            bodyHtml: `<p class="adm-muted" style="line-height:1.6;margin:0 0 14px">${esc(message)}</p>`,
            submitLabel: confirmLabel,
            danger: true
        });
    }

    /* ----------------------------------------------
       FILES  (compress images, upload, delete)
    ---------------------------------------------- */

    function loadBitmap(file) {
        if (window.createImageBitmap) return createImageBitmap(file);
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }

    /* Shrinks big photos (max side + WebP) so the public site stays fast. SVG/GIF are untouched. */
    async function optimiseImage(file, maxSide) {

        if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;

        try {
            const bmp = await loadBitmap(file);
            const w = bmp.width, h = bmp.height;
            const scale = Math.min(1, maxSide / Math.max(w, h));

            const canvas = document.createElement("canvas");
            canvas.width = Math.round(w * scale);
            canvas.height = Math.round(h * scale);
            canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);

            const blob = await new Promise((res) => canvas.toBlob(res, "image/webp", 0.86));

            return blob && blob.size < file.size ? blob : file;

        } catch (e) {
            return file;
        }
    }

    function extFor(type) {
        return ({
            "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png",
            "image/gif": "gif", "image/svg+xml": "svg", "application/pdf": "pdf"
        })[type] || "bin";
    }

    async function uploadFile(file, folder, { maxSide = 1600 } = {}) {

        const body = file.type === "application/pdf" ? file : await optimiseImage(file, maxSide);
        const type = body.type || file.type;
        const random = Math.random().toString(36).slice(2, 8);
        const path = `${folder}/${Date.now()}-${random}.${extFor(type)}`;

        const { error } = await sb.storage.from(BUCKET).upload(path, body, {
            contentType: type, cacheControl: "31536000", upsert: false
        });

        if (error) throw error;

        return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    }

    function storagePath(url) {
        const m = String(url || "").match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+?)(?:\?|$)/);
        return m && m[1] === BUCKET ? decodeURIComponent(m[2]) : null;
    }

    /* best effort: a leftover file is harmless, so never block the user on this */
    async function removeFile(url) {
        const path = storagePath(url);
        if (!path) return;
        try { await sb.storage.from(BUCKET).remove([path]); } catch (e) { /* ignore */ }
    }

    /* image input: choose a file OR paste a URL */
    function imageField(name, label, url, hint = "") {
        return `
            <div class="adm-field" data-image-field="${esc(name)}">
                <span class="adm-label">${esc(label)}</span>
                <div class="adm-image-field">
                    <div class="preview">${url ? `<img src="${esc(assetUrl(url))}" alt="">` : '<i class="bi bi-image"></i>'}</div>
                    <div class="controls">
                        <input type="file" class="adm-file" data-file
                            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml">
                        <input type="text" class="adm-input" name="${esc(name)}" value="${esc(url || "")}"
                            placeholder="…or paste an image URL" data-url inputmode="url" autocomplete="off">
                        ${hint ? `<span class="adm-hint">${esc(hint)}</span>` : ""}
                    </div>
                </div>
            </div>`;
    }

    function bindImageFields(form) {

        $$("[data-image-field]", form).forEach((wrap) => {

            const file = $("[data-file]", wrap);
            const url = $("[data-url]", wrap);
            const preview = $(".preview", wrap);

            const show = (src) => {
                preview.innerHTML = src ? "" : '<i class="bi bi-image"></i>';
                if (src) { const img = new Image(); img.alt = ""; img.src = src; preview.append(img); }
            };

            file.addEventListener("change", () => {

                const chosen = file.files[0];

                wrap._file = null;

                if (!chosen) return;

                if (!/^image\//.test(chosen.type)) {
                    toast("Please choose an image file.", true); file.value = ""; return;
                }

                if (chosen.size > MAX_IMAGE_MB * 1024 * 1024) {
                    toast(`Image is larger than ${MAX_IMAGE_MB} MB.`, true); file.value = ""; return;
                }

                wrap._file = chosen;
                show(URL.createObjectURL(chosen));
            });

            url.addEventListener("input", () => {
                if (!wrap._file) show(assetUrl(url.value.trim()));
            });
        });
    }

    /* returns the final image URL (uploads the chosen file when there is one) */
    async function resolveImage(form, name, folder, { required = true, maxSide = 1600 } = {}) {

        const wrap = $(`[data-image-field="${name}"]`, form);
        const typed = $("[data-url]", wrap).value.trim();

        if (wrap._file) return uploadFile(wrap._file, folder, { maxSide });

        if (!typed) {
            if (required) throw new Error("Please choose an image or paste an image URL.");
            return "";
        }

        if (!isHttpOrRelative(typed)) throw new Error("The image URL must start with https://");

        return typed;
    }

    /* ----------------------------------------------
       DATABASE HELPERS
    ---------------------------------------------- */

    async function must(promise) {
        const { data, error } = await promise;
        if (error) throw error;
        return data;
    }

    async function count(table, modify) {
        let q = sb.from(table).select("*", { count: "exact", head: true });
        if (modify) q = modify(q);
        const { count: n, error } = await q;
        if (error) throw error;
        return n || 0;
    }

    const listOrdered = (table) =>
        must(sb.from(table).select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true }));

    async function getSettings() {
        const rows = await must(sb.from("settings").select("key,value"));
        return Object.fromEntries(rows.map((r) => [r.key, r.value]));
    }

    async function saveSetting(key, value) {
        await must(sb.from("settings").upsert(
            { key, value, updated_at: new Date().toISOString() }, { onConflict: "key" }
        ));
    }

    const nextOrder = (rows) => (rows.reduce((m, r) => Math.max(m, r.sort_order || 0), 0) || 0) + 10;

    async function moveRow(table, rows, id, direction) {

        const i = rows.findIndex((r) => r.id === id);
        const j = i + direction;

        if (i < 0 || j < 0 || j >= rows.length) return;

        const order = rows.slice();
        [order[i], order[j]] = [order[j], order[i]];

        await Promise.all(order.map((row, index) => {
            const wanted = (index + 1) * 10;
            return row.sort_order === wanted ? null : must(sb.from(table).update({ sort_order: wanted }).eq("id", row.id));
        }).filter(Boolean));
    }

    /* ----------------------------------------------
       PAGE LAYOUT HELPERS
    ---------------------------------------------- */

    function pageHead(eyebrow, title, description = "", action = "") {
        return `
            <div class="adm-page-head">
                <div>
                    <span class="adm-mono adm-muted">${esc(eyebrow)}</span>
                    <h1>${esc(title)}</h1>
                    ${description ? `<p>${esc(description)}</p>` : ""}
                </div>
                ${action}
            </div>`;
    }

    const emptyState = (icon, text) =>
        `<div class="adm-empty"><i class="bi ${icon}"></i>${esc(text)}</div>`;

    const moveButtons = (id, index, total) => `
        <button class="adm-btn adm-btn--ghost adm-btn--icon" data-action="up" data-id="${esc(id)}"
            aria-label="Move up" ${index === 0 ? "disabled" : ""}><i class="bi bi-arrow-up"></i></button>
        <button class="adm-btn adm-btn--ghost adm-btn--icon" data-action="down" data-id="${esc(id)}"
            aria-label="Move down" ${index === total - 1 ? "disabled" : ""}><i class="bi bi-arrow-down"></i></button>`;

    /* ==================================================
       SECTION: DASHBOARD
    ================================================== */

    async function renderDashboard() {

        const [projects, certificates, skills, messages, unread, settings, recent] = await Promise.all([
            count("projects"), count("certificates"), count("skills"), count("messages"),
            count("messages", (q) => q.eq("is_read", false)),
            getSettings(),
            must(sb.from("messages").select("*").order("created_at", { ascending: false }).limit(3))
        ]);

        const availability = settings.availability || {};
        const available = availability.available !== false;

        view.innerHTML = pageHead("Overview", "Dashboard", "A quick look at what is on your portfolio right now.") + `
            <div class="adm-stats">
                <button class="adm-stat" data-go="projects"><span class="adm-mono adm-muted">Projects</span><b>${projects}</b><small>Manage projects →</small></button>
                <button class="adm-stat" data-go="certificates"><span class="adm-mono adm-muted">Certificates</span><b>${certificates}</b><small>Manage certificates →</small></button>
                <button class="adm-stat" data-go="skills"><span class="adm-mono adm-muted">Skills</span><b>${skills}</b><small>Manage skills →</small></button>
                <button class="adm-stat" data-go="messages"><span class="adm-mono adm-muted">Messages</span><b>${messages}</b><small>${unread} unread →</small></button>
            </div>

            <div class="adm-card">
                <h2>Availability</h2>
                <span class="adm-chip"><span class="adm-dot ${available ? "" : "is-off"}"></span>${esc(availability.badge_text || (available ? "Available for work" : "Not available"))}</span>
                <p class="adm-hint" style="margin:10px 0 0">Visitors currently see this badge in the navigation bar.</p>
                <div class="adm-actions" style="margin-top:14px"><button class="adm-btn adm-btn--ghost adm-btn--sm" data-go="availability">Change availability</button></div>
            </div>

            <div class="adm-card">
                <h2>Latest messages</h2>
                ${recent.length ? recent.map(messageHtml).join("") : emptyState("bi-inbox", "No messages yet.")}
            </div>`;

        view.onclick = (e) => {
            const go = e.target.closest("[data-go]");
            if (go) navigate(go.dataset.go);
        };
    }

    /* ==================================================
       SECTION: AVAILABILITY
    ================================================== */

    async function renderAvailability() {

        const settings = await getSettings();
        const a = settings.availability || {};

        view.innerHTML = pageHead("Dynamic section", "Available for work",
            "Controls the status badge in the navigation bar and the scrolling banner at the top of your portfolio.") + `
            <form class="adm-card" id="availabilityForm" novalidate>
                <div class="adm-field">
                    <label class="adm-switch">
                        <input type="checkbox" name="available" ${a.available !== false ? "checked" : ""}>
                        <span class="track"></span>
                        <span><b data-state>${a.available !== false ? "Available for work" : "Not available"}</b><br>
                        <span class="adm-hint">Turn off to show an amber “busy” dot instead.</span></span>
                    </label>
                </div>
                <div class="adm-field">
                    <label for="badge_text">Badge text</label>
                    <input class="adm-input" id="badge_text" name="badge_text" maxlength="40"
                        value="${esc(a.badge_text || "Available for work")}">
                </div>
                <div class="adm-field">
                    <label for="banner_text">Scrolling banner text</label>
                    <input class="adm-input" id="banner_text" name="banner_text" maxlength="120"
                        value="${esc(a.banner_text || "")}">
                    <span class="adm-hint">Shown in capitals at the very top of the page, e.g. “AVAILABLE FOR Q3/Q4 2026 FULL-TIME ROLES &amp; PROJECTS”.</span>
                </div>
                <p class="adm-error" data-error role="alert"></p>
                <button class="adm-btn" type="submit"><i class="bi bi-check2"></i> Save changes</button>
            </form>`;

        const form = $("#availabilityForm");
        const state = $("[data-state]", form);

        form.available.addEventListener("change", () => {
            state.textContent = form.available.checked ? "Available for work" : "Not available";
        });

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const button = $("button[type=submit]", form);
            const err = $("[data-error]", form);
            err.textContent = "";

            const badge = form.badge_text.value.trim();
            const banner = form.banner_text.value.trim();

            if (!badge) { err.textContent = "Badge text cannot be empty."; return; }

            try {
                await withBusy(button, "Saving…", () => saveSetting("availability", {
                    available: form.available.checked, badge_text: badge, banner_text: banner
                }));
                toast("Availability updated.");
            } catch (error) { err.textContent = friendlyError(error); }
        });
    }

    /* ==================================================
       SECTION: ABOUT ME
    ================================================== */

    async function renderAbout() {

        const settings = await getSettings();
        const texts = (settings.about && settings.about.texts) || [];

        view.innerHTML = pageHead("Dynamic section", "About me",
            "Your description in the About section. Write one paragraph per line — your portfolio types them out one after another.") + `
            <form class="adm-card" id="aboutForm" novalidate>
                <div class="adm-field">
                    <label for="aboutText">Description (one paragraph per line)</label>
                    <textarea class="adm-textarea" id="aboutText" rows="9" maxlength="2400">${esc(texts.join("\n"))}</textarea>
                    <span class="adm-hint adm-counter" data-count></span>
                </div>
                <p class="adm-error" data-error role="alert"></p>
                <button class="adm-btn" type="submit"><i class="bi bi-check2"></i> Save changes</button>
            </form>`;

        const form = $("#aboutForm");
        const area = $("#aboutText");
        const counter = $("[data-count]", form);

        const update = () => {
            const lines = area.value.split("\n").map((l) => l.trim()).filter(Boolean);
            counter.textContent = `${lines.length} paragraph${lines.length === 1 ? "" : "s"} · ${area.value.length}/2400 characters`;
        };

        area.addEventListener("input", update);
        update();

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const err = $("[data-error]", form);
            err.textContent = "";

            const lines = area.value.split("\n").map((l) => l.trim()).filter(Boolean);

            if (!lines.length) { err.textContent = "Please write at least one paragraph."; return; }
            if (lines.some((l) => l.length > 400)) { err.textContent = "Each paragraph must be 400 characters or fewer."; return; }

            try {
                await withBusy($("button[type=submit]", form), "Saving…", () => saveSetting("about", { texts: lines }));
                toast("About text updated.");
            } catch (error) { err.textContent = friendlyError(error); }
        });
    }

    /* ==================================================
       SECTION: PROJECTS
    ================================================== */

    function parseTags(raw) {
        const seen = new Set();
        return String(raw || "").split(",")
            .map((t) => t.trim().toUpperCase()).filter((t) => t && !seen.has(t) && seen.add(t));
    }

    async function renderProjects() {

        const rows = await listOrdered("projects");

        view.innerHTML = pageHead("Dynamic section", "Projects",
            "Add, edit, reorder or delete the projects shown in your Featured Work showcase.",
            '<button class="adm-btn" data-action="add"><i class="bi bi-plus-lg"></i> Add project</button>') + `
            <div class="adm-list">
                ${rows.length ? rows.map((p, i) => `
                    <div class="adm-item">
                        <img class="adm-thumb" src="${esc(assetUrl(p.image_url))}" alt="" loading="lazy">
                        <div class="adm-item-body">
                            <p class="adm-item-title">${esc(p.title)}</p>
                            <div class="adm-item-sub">${esc((p.description || "").slice(0, 110))}${(p.description || "").length > 110 ? "…" : ""}</div>
                            <div class="adm-tags">${(p.tags || []).map((t) => `<span class="adm-tag">${esc(t)}</span>`).join("")}</div>
                        </div>
                        <div class="adm-actions">
                            ${moveButtons(p.id, i, rows.length)}
                            <button class="adm-btn adm-btn--ghost adm-btn--sm" data-action="edit" data-id="${esc(p.id)}"><i class="bi bi-pencil"></i> Edit</button>
                            <button class="adm-btn adm-btn--danger adm-btn--sm" data-action="delete" data-id="${esc(p.id)}"><i class="bi bi-trash"></i></button>
                        </div>
                    </div>`).join("") : emptyState("bi-folder2-open", "No projects yet. Add your first one.")}
            </div>`;

        view.onclick = async (e) => {

            const btn = e.target.closest("[data-action]");
            if (!btn) return;

            const id = btn.dataset.id;
            const row = rows.find((r) => r.id === id);

            try {
                if (btn.dataset.action === "add") { if (await projectForm(null, rows)) renderProjects().catch(showError); }
                if (btn.dataset.action === "edit") { if (await projectForm(row, rows)) renderProjects().catch(showError); }
                if (btn.dataset.action === "up" || btn.dataset.action === "down") {
                    await moveRow("projects", rows, id, btn.dataset.action === "up" ? -1 : 1);
                    renderProjects().catch(showError);
                }
                if (btn.dataset.action === "delete" && await confirmBox(`Delete “${row.title}”? This cannot be undone.`)) {
                    await must(sb.from("projects").delete().eq("id", id));
                    await removeFile(row.image_url);
                    toast("Project deleted.");
                    renderProjects().catch(showError);
                }
            } catch (error) { toast(friendlyError(error), true); }
        };
    }

    function projectForm(project, rows) {

        const p = project || { title: "", description: "", tags: [], image_url: "", link_url: "", link_label: "View Project" };

        return openModal({
            title: project ? "Edit project" : "Add project",
            submitLabel: project ? "Save changes" : "Add project",
            bodyHtml: `
                <div class="adm-field"><label for="f_title">Title</label>
                    <input class="adm-input" id="f_title" name="title" maxlength="120" value="${esc(p.title)}" required></div>
                <div class="adm-field"><label for="f_desc">Description</label>
                    <textarea class="adm-textarea" id="f_desc" name="description" rows="4" maxlength="600" style="min-height:100px">${esc(p.description)}</textarea>
                    <span class="adm-hint adm-counter" data-count></span></div>
                <div class="adm-field"><label for="f_tags">Tags (comma separated, max 6)</label>
                    <input class="adm-input" id="f_tags" name="tags" value="${esc((p.tags || []).join(", "))}" placeholder="PYTHON, FLASK, WEB"></div>
                <div class="adm-row">
                    <div class="adm-field"><label for="f_link">Link (optional)</label>
                        <input class="adm-input" id="f_link" name="link_url" value="${esc(p.link_url)}" placeholder="https://…" inputmode="url"></div>
                    <div class="adm-field"><label for="f_label">Link text</label>
                        <input class="adm-input" id="f_label" name="link_label" maxlength="40" value="${esc(p.link_label || "View Project")}"></div>
                </div>
                ${imageField("image_url", "Project image", p.image_url, "Large images are shrunk automatically.")}`,
            onOpen: (form) => {
                bindImageFields(form);
                const area = form.elements.description, counter = $("[data-count]", form);
                const upd = () => { counter.textContent = `${area.value.length}/600`; };
                area.addEventListener("input", upd); upd();
            },
            onSubmit: async (form) => {

                const title = form.elements.title.value.trim();
                const link = form.link_url.value.trim();
                const tags = parseTags(form.tags.value);

                if (!title) throw new Error("Please enter a title.");
                if (tags.length > 6) throw new Error("Please use 6 tags or fewer.");
                if (tags.some((t) => t.length > 24)) throw new Error("Each tag must be 24 characters or fewer.");
                if (link && link !== "#" && !isHttpOrRelative(link)) throw new Error("The link must start with https://");

                const image = await resolveImage(form, "image_url", "projects", { required: true, maxSide: 1600 });

                const record = {
                    title, description: form.elements.description.value.trim(), tags,
                    image_url: image, link_url: link === "#" ? "" : link,
                    link_label: form.link_label.value.trim() || "View Project"
                };

                if (project) {
                    await must(sb.from("projects").update(record).eq("id", project.id));
                    if (project.image_url !== image) await removeFile(project.image_url);
                } else {
                    await must(sb.from("projects").insert({ ...record, sort_order: nextOrder(rows) }));
                }

                toast(project ? "Project updated." : "Project added.");
            }
        });
    }

    /* ==================================================
       SECTION: CERTIFICATES
    ================================================== */

    async function renderCertificates() {

        const rows = await listOrdered("certificates");

        view.innerHTML = pageHead("Dynamic section", "Certificates",
            "Add, edit, reorder or delete the certificates in your gallery. The first one is shown as the large tile.",
            '<button class="adm-btn" data-action="add"><i class="bi bi-plus-lg"></i> Add certificate</button>') +
            (rows.length ? `<div class="adm-thumbs">${rows.map((c, i) => `
                <div class="adm-cert">
                    <img src="${esc(assetUrl(c.image_url))}" alt="" loading="lazy">
                    <div class="adm-cert-body">
                        <div class="adm-item-title">${esc(c.title)}</div>
                        <div class="adm-actions">
                            ${moveButtons(c.id, i, rows.length)}
                            <button class="adm-btn adm-btn--ghost adm-btn--sm" data-action="edit" data-id="${esc(c.id)}"><i class="bi bi-pencil"></i></button>
                            <button class="adm-btn adm-btn--danger adm-btn--sm" data-action="delete" data-id="${esc(c.id)}"><i class="bi bi-trash"></i></button>
                        </div>
                    </div>
                </div>`).join("")}</div>` : emptyState("bi-award", "No certificates yet. Add your first one."));

        view.onclick = async (e) => {

            const btn = e.target.closest("[data-action]");
            if (!btn) return;

            const id = btn.dataset.id;
            const row = rows.find((r) => r.id === id);

            try {
                if (btn.dataset.action === "add") { if (await certificateForm(null, rows)) renderCertificates().catch(showError); }
                if (btn.dataset.action === "edit") { if (await certificateForm(row, rows)) renderCertificates().catch(showError); }
                if (btn.dataset.action === "up" || btn.dataset.action === "down") {
                    await moveRow("certificates", rows, id, btn.dataset.action === "up" ? -1 : 1);
                    renderCertificates().catch(showError);
                }
                if (btn.dataset.action === "delete" && await confirmBox(`Delete “${row.title}”? This cannot be undone.`)) {
                    await must(sb.from("certificates").delete().eq("id", id));
                    await removeFile(row.image_url);
                    toast("Certificate deleted.");
                    renderCertificates().catch(showError);
                }
            } catch (error) { toast(friendlyError(error), true); }
        };
    }

    function certificateForm(cert, rows) {

        const c = cert || { title: "", image_url: "" };

        return openModal({
            title: cert ? "Edit certificate" : "Add certificate",
            submitLabel: cert ? "Save changes" : "Add certificate",
            bodyHtml: `
                <div class="adm-field"><label for="c_title">Title</label>
                    <input class="adm-input" id="c_title" name="title" maxlength="120" value="${esc(c.title)}" required></div>
                ${imageField("image_url", "Certificate image", c.image_url, "JPG, PNG or WebP. Shown large when a visitor clicks it.")}`,
            onOpen: bindImageFields,
            onSubmit: async (form) => {

                const title = form.elements.title.value.trim();

                if (!title) throw new Error("Please enter a title.");

                const image = await resolveImage(form, "image_url", "certificates", { required: true, maxSide: 2000 });

                if (cert) {
                    await must(sb.from("certificates").update({ title, image_url: image }).eq("id", cert.id));
                    if (cert.image_url !== image) await removeFile(cert.image_url);
                } else {
                    await must(sb.from("certificates").insert({ title, image_url: image, sort_order: nextOrder(rows) }));
                }

                toast(cert ? "Certificate updated." : "Certificate added.");
            }
        });
    }

    /* ==================================================
       SECTION: SKILLS
    ================================================== */

    const STYLE_LABEL = {
        original: "Original colours",
        invert: "Invert (dark icon → white)",
        white: "White silhouette"
    };

    const styleClass = (s) => (s === "invert" ? "filter:invert(1)" : s === "white" ? "filter:brightness(0) invert(1)" : "");

    async function renderSkills() {

        const rows = await listOrdered("skills");

        view.innerHTML = pageHead("Suggested feature", "Skills",
            "The tech stack shown in the scrolling Core Tech Stack card. Skills alternate between the left and right column.",
            '<button class="adm-btn" data-action="add"><i class="bi bi-plus-lg"></i> Add skill</button>') + `
            <div class="adm-list">
                ${rows.length ? rows.map((s, i) => `
                    <div class="adm-item">
                        <img class="adm-thumb adm-thumb--icon" src="${esc(assetUrl(s.icon_url))}" style="${styleClass(s.icon_style)}" alt="" loading="lazy">
                        <div class="adm-item-body">
                            <p class="adm-item-title">${esc(s.name)}</p>
                            <div class="adm-item-sub">${esc(STYLE_LABEL[s.icon_style] || "")} · ${i % 2 === 0 ? "left" : "right"} column</div>
                        </div>
                        <div class="adm-actions">
                            ${moveButtons(s.id, i, rows.length)}
                            <button class="adm-btn adm-btn--ghost adm-btn--sm" data-action="edit" data-id="${esc(s.id)}"><i class="bi bi-pencil"></i> Edit</button>
                            <button class="adm-btn adm-btn--danger adm-btn--sm" data-action="delete" data-id="${esc(s.id)}"><i class="bi bi-trash"></i></button>
                        </div>
                    </div>`).join("") : emptyState("bi-lightning-charge", "No skills yet. Add your first one.")}
            </div>`;

        view.onclick = async (e) => {

            const btn = e.target.closest("[data-action]");
            if (!btn) return;

            const id = btn.dataset.id;
            const row = rows.find((r) => r.id === id);

            try {
                if (btn.dataset.action === "add") { if (await skillForm(null, rows)) renderSkills().catch(showError); }
                if (btn.dataset.action === "edit") { if (await skillForm(row, rows)) renderSkills().catch(showError); }
                if (btn.dataset.action === "up" || btn.dataset.action === "down") {
                    await moveRow("skills", rows, id, btn.dataset.action === "up" ? -1 : 1);
                    renderSkills().catch(showError);
                }
                if (btn.dataset.action === "delete" && await confirmBox(`Delete “${row.name}”?`)) {
                    await must(sb.from("skills").delete().eq("id", id));
                    await removeFile(row.icon_url);
                    toast("Skill deleted.");
                    renderSkills().catch(showError);
                }
            } catch (error) { toast(friendlyError(error), true); }
        };
    }

    function skillForm(skill, rows) {

        const s = skill || { name: "", icon_url: "", icon_style: "original" };

        return openModal({
            title: skill ? "Edit skill" : "Add skill",
            submitLabel: skill ? "Save changes" : "Add skill",
            bodyHtml: `
                <div class="adm-field"><label for="s_name">Skill name</label>
                    <input class="adm-input" id="s_name" name="name" maxlength="40" value="${esc(s.name)}" required></div>

                <div class="adm-field"><label for="s_dev">Quick icon from Devicon (optional)</label>
                    <div class="adm-actions" style="flex-wrap:nowrap">
                        <input class="adm-input" id="s_dev" placeholder="e.g. docker, nodejs, tailwindcss" autocomplete="off">
                        <button type="button" class="adm-btn adm-btn--ghost" data-devicon>Use</button>
                    </div>
                    <span class="adm-hint">Type the technology name and press Use, or upload your own icon below.</span></div>

                ${imageField("icon_url", "Icon", s.icon_url, "Square images (SVG or PNG) look best.")}

                <div class="adm-field"><label for="s_style">Icon colour style</label>
                    <select class="adm-select" id="s_style" name="icon_style">
                        ${Object.entries(STYLE_LABEL).map(([v, l]) => `<option value="${v}" ${s.icon_style === v ? "selected" : ""}>${l}</option>`).join("")}
                    </select>
                    <span class="adm-hint">Your cards are dark blue — use “Invert” or “White” for black icons.</span></div>`,
            onOpen: (form) => {

                bindImageFields(form);

                $("[data-devicon]", form).addEventListener("click", () => {

                    const slug = $("#s_dev", form).value.trim().toLowerCase();

                    if (!/^[a-z0-9-]+$/.test(slug)) { toast("Use letters, numbers and dashes only.", true); return; }

                    const field = $("[data-url]", form);
                    field.value = `https://cdn.jsdelivr.net/gh/devicons/devicon/icons/${slug}/${slug}-original.svg`;
                    field.dispatchEvent(new Event("input"));

                    if (!form.elements.name.value.trim()) form.elements.name.value = slug.charAt(0).toUpperCase() + slug.slice(1);
                });
            },
            onSubmit: async (form) => {

                const name = form.elements.name.value.trim();

                if (!name) throw new Error("Please enter the skill name.");

                const icon = await resolveImage(form, "icon_url", "skills", { required: true, maxSide: 256 });

                const record = { name, icon_url: icon, icon_style: form.elements.icon_style.value };

                if (skill) {
                    await must(sb.from("skills").update(record).eq("id", skill.id));
                    if (skill.icon_url !== icon) await removeFile(skill.icon_url);
                } else {
                    await must(sb.from("skills").insert({ ...record, sort_order: nextOrder(rows) }));
                }

                toast(skill ? "Skill updated." : "Skill added.");
            }
        });
    }

    /* ==================================================
       SECTION: RESUME
    ================================================== */

    async function renderResume() {

        const settings = await getSettings();
        const resume = settings.resume || {};

        view.innerHTML = pageHead("Suggested feature", "Resume",
            "Upload a new PDF to replace your resume. Every “CV” and “Download CV” button on the portfolio updates automatically.") + `
            <div class="adm-card">
                <h2>Current resume</h2>
                ${resume.url
                ? `<p class="adm-item-sub" style="margin:0 0 12px">${esc(resume.name || resume.url.split("/").pop().split("?")[0])}${resume.uploaded_at ? " · uploaded " + esc(fmtDate(resume.uploaded_at)) : ""}</p>
                       <a class="adm-btn adm-btn--ghost adm-btn--sm" href="${esc(assetUrl(resume.url))}" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right"></i> Open current PDF</a>`
                : emptyState("bi-file-earmark-pdf", "No resume uploaded yet.")}
            </div>

            <form class="adm-card" id="resumeForm" novalidate>
                <h2>Upload a new resume</h2>
                <div class="adm-field">
                    <label for="resumeFile">PDF file (max ${MAX_PDF_MB} MB)</label>
                    <input class="adm-file" id="resumeFile" type="file" accept="application/pdf">
                </div>
                <p class="adm-error" data-error role="alert"></p>
                <button class="adm-btn" type="submit"><i class="bi bi-upload"></i> Upload &amp; replace</button>
            </form>`;

        $("#resumeForm").addEventListener("submit", async (e) => {

            e.preventDefault();

            const form = e.currentTarget;
            const err = $("[data-error]", form);
            const file = $("#resumeFile", form).files[0];

            err.textContent = "";

            if (!file) { err.textContent = "Please choose a PDF file."; return; }
            if (file.type !== "application/pdf") { err.textContent = "Only PDF files are allowed."; return; }
            if (file.size > MAX_PDF_MB * 1024 * 1024) { err.textContent = `The PDF is larger than ${MAX_PDF_MB} MB.`; return; }

            try {
                await withBusy($("button[type=submit]", form), "Uploading…", async () => {
                    const url = await uploadFile(file, "resume");
                    await saveSetting("resume", { url, name: file.name, uploaded_at: new Date().toISOString() });
                    if (resume.url && resume.url !== url) await removeFile(resume.url);
                });
                toast("Resume replaced.");
                renderResume().catch(showError);
            } catch (error) { err.textContent = friendlyError(error); }
        });
    }

    /* ==================================================
       SECTION: PROFILE
    ================================================== */

    async function renderProfile() {

        const settings = await getSettings();
        const p = settings.profile || {};

        view.innerHTML = pageHead("Suggested feature", "Profile information",
            "Your contact details and social links. They update every email, WhatsApp, GitHub and LinkedIn button on the portfolio.") + `
            <form class="adm-card" id="profileForm" novalidate>
                <div class="adm-field"><label for="p_email">Email</label>
                    <input class="adm-input" id="p_email" name="email" type="email" maxlength="254" value="${esc(p.email || "")}" autocomplete="off">
                    <span class="adm-hint">Email buttons open the visitor's mail app with this address filled in.</span></div>
                <div class="adm-field"><label for="p_wa">WhatsApp number</label>
                    <input class="adm-input" id="p_wa" name="whatsapp" inputmode="tel" maxlength="20" value="${esc(p.whatsapp || "")}" placeholder="918825858292" autocomplete="off">
                    <span class="adm-hint">Digits only, with the country code and no “+” (India: 91 + number). Leave empty to hide the WhatsApp icon.</span></div>
                <div class="adm-field"><label for="p_gh">GitHub URL</label>
                    <input class="adm-input" id="p_gh" name="github" inputmode="url" maxlength="300" value="${esc(p.github || "")}" placeholder="https://github.com/your-name" autocomplete="off">
                    <span class="adm-hint">Leave empty to hide the GitHub icon.</span></div>
                <div class="adm-field"><label for="p_li">LinkedIn URL</label>
                    <input class="adm-input" id="p_li" name="linkedin" inputmode="url" maxlength="300" value="${esc(p.linkedin || "")}" placeholder="https://www.linkedin.com/in/your-name" autocomplete="off">
                    <span class="adm-hint">Leave empty to hide the LinkedIn icon.</span></div>
                <p class="adm-error" data-error role="alert"></p>
                <button class="adm-btn" type="submit"><i class="bi bi-check2"></i> Save changes</button>
            </form>`;

        $("#profileForm").addEventListener("submit", async (e) => {

            e.preventDefault();

            const form = e.currentTarget;
            const err = $("[data-error]", form);
            err.textContent = "";

            const email = form.email.value.trim();
            const whatsapp = form.whatsapp.value.replace(/[\s+\-()]/g, "");
            const github = form.github.value.trim();
            const linkedin = form.linkedin.value.trim();

            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err.textContent = "Please enter a valid email address."; return; }
            if (whatsapp && !/^\d{8,15}$/.test(whatsapp)) { err.textContent = "WhatsApp must be 8–15 digits including the country code."; return; }
            if (github && !/^https?:\/\//i.test(github)) { err.textContent = "GitHub link must start with https://"; return; }
            if (linkedin && !/^https?:\/\//i.test(linkedin)) { err.textContent = "LinkedIn link must start with https://"; return; }

            try {
                await withBusy($("button[type=submit]", form), "Saving…", () =>
                    saveSetting("profile", { email, whatsapp, github, linkedin }));
                toast("Profile updated.");
            } catch (error) { err.textContent = friendlyError(error); }
        });
    }

    /* ==================================================
       SECTION: MESSAGES
    ================================================== */

    function messageHtml(m) {
        return `
            <div class="adm-msg ${m.is_read ? "" : "is-unread"}" data-msg="${esc(m.id)}" style="margin-bottom:12px">
                <div class="adm-msg-head">
                    <span class="adm-msg-from">${m.is_read ? "" : '<span class="adm-dot" style="margin-right:8px"></span>'}${esc(m.name ? `${m.name} · ` : "")}${esc(m.email)}</span>
                    <span class="adm-item-sub">${esc(fmtDate(m.created_at))}</span>
                </div>
                <p class="adm-msg-text">${esc(m.message || "(no message text)")}</p>
                <div class="adm-actions">
                    <a class="adm-btn adm-btn--sm" href="mailto:${esc(m.email)}"><i class="bi bi-reply"></i> Reply</a>
                    <button class="adm-btn adm-btn--ghost adm-btn--sm" data-action="toggle" data-id="${esc(m.id)}">${m.is_read ? "Mark unread" : "Mark read"}</button>
                    <button class="adm-btn adm-btn--danger adm-btn--sm" data-action="delete" data-id="${esc(m.id)}"><i class="bi bi-trash"></i></button>
                </div>
            </div>`;
    }

    let messageFilter = "all";

    async function renderMessages() {

        const rows = await must(sb.from("messages").select("*").order("created_at", { ascending: false }));
        const unread = rows.filter((m) => !m.is_read).length;
        const shown = messageFilter === "unread" ? rows.filter((m) => !m.is_read) : rows;

        view.innerHTML = pageHead("Suggested feature", "Contact messages",
            "Messages sent through your portfolio's contact form. Only you can read them.",
            unread ? '<button class="adm-btn adm-btn--ghost" data-action="readall"><i class="bi bi-check2-all"></i> Mark all read</button>' : "") + `
            <div class="adm-tabs">
                <button class="adm-btn adm-btn--sm ${messageFilter === "all" ? "" : "adm-btn--ghost"}" data-filter="all">All (${rows.length})</button>
                <button class="adm-btn adm-btn--sm ${messageFilter === "unread" ? "" : "adm-btn--ghost"}" data-filter="unread">Unread (${unread})</button>
            </div>
            ${shown.length ? shown.map(messageHtml).join("") : emptyState("bi-inbox", messageFilter === "unread" ? "No unread messages." : "No messages yet.")}`;

        setUnreadBadge(unread);

        view.onclick = async (e) => {

            const filter = e.target.closest("[data-filter]");

            if (filter) { messageFilter = filter.dataset.filter; renderMessages().catch(showError); return; }

            const btn = e.target.closest("[data-action]");
            if (!btn) return;

            const row = rows.find((r) => r.id === btn.dataset.id);

            try {
                if (btn.dataset.action === "toggle") {
                    await must(sb.from("messages").update({ is_read: !row.is_read }).eq("id", row.id));
                    renderMessages().catch(showError);
                }
                if (btn.dataset.action === "readall") {
                    await must(sb.from("messages").update({ is_read: true }).eq("is_read", false));
                    renderMessages().catch(showError);
                }
                if (btn.dataset.action === "delete" && await confirmBox("Delete this message? This cannot be undone.")) {
                    await must(sb.from("messages").delete().eq("id", row.id));
                    toast("Message deleted.");
                    renderMessages().catch(showError);
                }
            } catch (error) { toast(friendlyError(error), true); }
        };
    }

    function setUnreadBadge(n) {
        const badge = $("#unreadBadge");
        if (!badge) return;
        badge.textContent = n;
        badge.hidden = !n;
    }

    async function refreshUnread() {
        try { setUnreadBadge(await count("messages", (q) => q.eq("is_read", false))); } catch (e) { /* ignore */ }
    }

    /* ==================================================
       NAVIGATION
    ================================================== */

    const SECTIONS = [
        { id: "dashboard", label: "Dashboard", icon: "bi-grid-1x2", render: renderDashboard },
        { id: "availability", label: "Availability", icon: "bi-broadcast", render: renderAvailability },
        { id: "about", label: "About me", icon: "bi-person", render: renderAbout },
        { id: "projects", label: "Projects", icon: "bi-folder2-open", render: renderProjects },
        { id: "certificates", label: "Certificates", icon: "bi-award", render: renderCertificates },
        { id: "skills", label: "Skills", icon: "bi-lightning-charge", render: renderSkills },
        { id: "resume", label: "Resume", icon: "bi-file-earmark-person", render: renderResume },
        { id: "profile", label: "Profile", icon: "bi-person-lines-fill", render: renderProfile },
        { id: "messages", label: "Messages", icon: "bi-envelope", render: renderMessages }
    ];

    function showError(error) {
        console.error(error);
        view.innerHTML = `<div class="adm-card"><h2>Something went wrong</h2>
            <p class="adm-error" style="min-height:0">${esc(friendlyError(error))}</p>
            <button class="adm-btn adm-btn--ghost adm-btn--sm" id="retryBtn">Try again</button></div>`;
        $("#retryBtn").addEventListener("click", () => navigate(currentSection));
    }

    function navigate(id) {

        const section = SECTIONS.find((s) => s.id === id) || SECTIONS[0];

        currentSection = section.id;

        if (location.hash !== "#" + section.id) history.replaceState(null, "", "#" + section.id);

        $$(".adm-nav-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.section === section.id));

        closeMenu();
        view.onclick = null;
        loading();
        window.scrollTo(0, 0);

        section.render().catch(showError);
    }

    function buildNav() {
        $("#nav").innerHTML = SECTIONS.map((s) => `
            <button class="adm-nav-btn" data-section="${s.id}" type="button">
                <i class="bi ${s.icon}"></i><span>${esc(s.label)}</span>
                ${s.id === "messages" ? '<span class="adm-badge" id="unreadBadge" hidden>0</span>' : ""}
            </button>`).join("");
    }

    function closeMenu() {
        $("#sidebar").classList.remove("is-open");
        $("#menuBtn").setAttribute("aria-expanded", "false");
    }

    /* ==================================================
       AUTH
    ================================================== */

    function showLogin(message) {
        $("#app").hidden = true;
        $("#login").hidden = false;
        $("#loginError").textContent = message || "";
        clearTimeout(idleTimer);
        const email = $("#loginEmail");
        if (email && !email.value) email.focus();
    }

    async function isAdmin() {
        const { data, error } = await sb.rpc("is_admin");
        return !error && data === true;
    }

    function resetIdleTimer() {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(async () => {
            await sb.auth.signOut();
            showLogin("You were signed out after 30 minutes of inactivity.");
        }, IDLE_LIMIT_MS);
    }

    async function enterApp(user) {

        $("#login").hidden = true;
        $("#app").hidden = false;
        $("#userEmail").textContent = user.email || "";

        buildNav();
        resetIdleTimer();
        refreshUnread();

        const start = location.hash.replace("#", "");
        navigate(SECTIONS.some((s) => s.id === start) ? start : "dashboard");
    }

    let failedLogins = 0;
    let lockedUntil = 0;

    async function onLogin(e) {

        e.preventDefault();

        const errorBox = $("#loginError");
        const button = $("#loginBtn");

        if (Date.now() < lockedUntil) {
            errorBox.textContent = `Too many attempts. Wait ${Math.ceil((lockedUntil - Date.now()) / 1000)} seconds.`;
            return;
        }

        const email = $("#loginEmail").value.trim();
        const password = $("#loginPassword").value;

        if (!email || !password) { errorBox.textContent = "Enter your email and password."; return; }

        errorBox.textContent = "";

        await withBusy(button, "Signing in…", async () => {

            const { data, error } = await sb.auth.signInWithPassword({ email, password });

            if (error || !data.session) {
                failedLogins++;
                if (failedLogins >= 5) { lockedUntil = Date.now() + 60000; failedLogins = 0; }
                errorBox.textContent = "Incorrect email or password.";
                return;
            }

            if (!(await isAdmin())) {
                await sb.auth.signOut();
                errorBox.textContent = "This account is not authorised to manage the portfolio.";
                return;
            }

            failedLogins = 0;
            $("#loginPassword").value = "";
            enterApp(data.session.user);
        });
    }

    async function boot() {

        $("#loginForm").addEventListener("submit", (e) => e.preventDefault());

        if (!configured) {
            $("#loginForm").hidden = true;
            $("#loginIntro").innerHTML = "The admin panel is not connected yet. Open <b>js/supabase-config.js</b> and add your Supabase project URL and anon key. Step-by-step instructions are in <b>SETUP_ADMIN.md</b>.";
            $("#login").hidden = false;
            return;
        }

        sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "portfolio-admin-auth" }
        });

        $("#loginForm").addEventListener("submit", onLogin);

        $("#nav").addEventListener("click", (e) => {
            const btn = e.target.closest("[data-section]");
            if (btn) navigate(btn.dataset.section);
        });

        $("#menuBtn").addEventListener("click", () => {
            const open = $("#sidebar").classList.toggle("is-open");
            $("#menuBtn").setAttribute("aria-expanded", String(open));
        });

        $("#signOutBtn").addEventListener("click", async () => {
            await sb.auth.signOut();
            showLogin("You have been signed out.");
        });

        ["click", "keydown", "touchstart", "mousemove"].forEach((evt) =>
            document.addEventListener(evt, () => { if (!$("#app").hidden) resetIdleTimer(); }, { passive: true }));

        window.addEventListener("hashchange", () => {
            const id = location.hash.replace("#", "");
            if (!$("#app").hidden && id !== currentSection && SECTIONS.some((s) => s.id === id)) navigate(id);
        });

        sb.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") showLogin(); });

        try {
            const { data } = await sb.auth.getSession();

            if (data.session && await isAdmin()) { enterApp(data.session.user); return; }

            if (data.session) await sb.auth.signOut();

        } catch (e) { /* fall through to login */ }

        showLogin();
    }

    boot();

})();
