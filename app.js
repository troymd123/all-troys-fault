// All Troy's Fault — public site logic v2
(function () {
  const API = CONFIG.API_BASE;

  /* ── Mobile nav ─────────────────────────────────────────── */
  const navToggle = document.getElementById("navToggle");
  const navLinks  = document.getElementById("navLinks");
  if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => navLinks.classList.toggle("open"));
    navLinks.querySelectorAll("a").forEach(a =>
      a.addEventListener("click", () => navLinks.classList.remove("open"))
    );
  }

  /* ── Scroll reveal ──────────────────────────────────────── */
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.1 });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add("in"));
  }

  /* ── Carousel buttons ───────────────────────────────────── */
  document.querySelectorAll(".carousel-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const carousel = document.getElementById(btn.dataset.target);
      if (!carousel) return;
      const slide = carousel.querySelector(".merch-slide, .photo-slide, .video-slide");
      const step  = slide ? slide.offsetWidth + 18 : 260;
      carousel.scrollBy({ left: btn.classList.contains("next") ? step : -step, behavior: "smooth" });
    });
  });

  /* ── Lightbox ───────────────────────────────────────────── */
  const lightbox     = document.getElementById("lightbox");
  const lightboxImg  = document.getElementById("lightboxImg");
  const lightboxClose = document.getElementById("lightboxClose");
  function openLightbox(src, alt) {
    lightboxImg.src = src; lightboxImg.alt = alt || "";
    lightbox.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeLightbox() {
    lightbox.classList.remove("open");
    document.body.style.overflow = "";
  }
  if (lightboxClose) lightboxClose.addEventListener("click", closeLightbox);
  if (lightbox) lightbox.addEventListener("click", e => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeLightbox(); });

  /* ── Helpers ────────────────────────────────────────────── */
  function esc(str) {
    const d = document.createElement("div");
    d.textContent = str == null ? "" : String(str);
    return d.innerHTML;
  }

  function youtubeId(url) {
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
    return m ? m[1] : null;
  }

  function driveId(url) {
    const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
    return m ? m[1] : null;
  }

  function formatDate(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return {
      dow: dt.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
      dom: String(d).padStart(2, "0"),
      mon: dt.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
      ts:  dt.getTime(),
    };
  }

  function formatTime(t) {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  }

  /* ── Shows ──────────────────────────────────────────────── */
  /* Format date as M/D/YYYY for ticket */
  function fmtDateSlash(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return `${m}/${d}/${y}`;
  }

  async function loadEvents() {
    const list = document.getElementById("showList");
    if (!list) return;
    try {
      const events = await fetch(`${API}/api/events`).then(r => r.json());
      const today  = new Date(); today.setHours(0, 0, 0, 0);
      const upcoming = events
        .filter(e => { if (!e.date) return false; const [y,m,d] = e.date.split("-").map(Number); return new Date(y,m-1,d) >= today; })
        .sort((a, b) => a.date.localeCompare(b.date));
      if (!upcoming.length) {
        list.innerHTML = `<div class="empty-state">No shows on the books right now &mdash; follow us so you don't miss the announcement.</div>`;
        return;
      }
      list.innerHTML = upcoming.map(e => {
        // Stub values derived from date
        const ticketNum = (e.id || "0000000000").substring(0, 10).toUpperCase().padEnd(10, "0");
        const logoImg = `<img src="logo.png" alt="ATF" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <div class="ticket-logo-fallback" style="display:none;">ATF</div>`;
        const mapsUrl = e.address
          ? `https://maps.google.com/?q=${encodeURIComponent(e.address)}`
          : "";
        return `
        <div class="ticket-new${mapsUrl ? " has-maps" : ""}"${mapsUrl ? ` data-maps="${esc(mapsUrl)}"` : ""}>
          <div class="ticket-logo-col">${logoImg}</div>
          <div class="ticket-main-col">
            <div class="ticket-venue-badge">${esc(e.venue || "TBA")}</div>
            <div class="ticket-event-type">Concert</div>
            <hr class="ticket-rule">
            <div class="ticket-detail-row">
              <span class="td-l">${esc(e.venue || "TBA")}</span>
              <span class="td-r">${fmtDateSlash(e.date)}</span>
            </div>
            <div class="ticket-detail-row sub">
              <span class="td-l">${esc(e.location || "")}</span>
              <span class="td-r">${e.time ? formatTime(e.time) : ""}</span>
            </div>
            ${e.notes ? `<div class="ticket-notes-tag">${esc(e.notes)}</div>` : ""}
            ${mapsUrl ? `<div class="ticket-maps-hint">&#128205; Tap for directions</div>` : ""}
            ${e.ticketUrl ? `<a class="ticket-buy-link" href="${esc(e.ticketUrl)}" target="_blank" rel="noopener">Get tickets &rarr;</a>` : ""}
          </div>
          <div class="ticket-stub-col">
            <div class="stub-field">
              <span class="stub-lbl">SEAT</span>
              <span class="stub-val">01</span>
            </div>
            <div class="stub-sep"></div>
            <div class="stub-field">
              <span class="stub-lbl">ROW</span>
              <span class="stub-val">02</span>
            </div>
            <div class="stub-sep"></div>
            <div class="stub-field">
              <span class="stub-lbl">GATE</span>
              <span class="stub-val">MANY</span>
            </div>
            <div class="stub-sep"></div>
            <div class="stub-barcode"></div>
            <div class="stub-num">
              <span class="stub-num-lbl">TICKET NUMBER:</span>
              <span class="stub-num-val">${ticketNum}</span>
            </div>
          </div>
        </div>`;
      }).join("");

      // Maps tap handler — clicking anywhere on a ticket (except links) opens maps
      list.querySelectorAll(".ticket-new[data-maps]").forEach(ticket => {
        ticket.addEventListener("click", e => {
          if (e.target.closest("a")) return;
          window.open(ticket.dataset.maps, "_blank");
        });
      });
    } catch {
      list.innerHTML = `<div class="empty-state">Couldn't load the schedule right now. Try refreshing.</div>`;
    }
  }

  /* ── Videos — carousel, single-play, fullscreen ─────────── */
  async function loadVideos() {
    const carousel = document.getElementById("videoCarousel");
    if (!carousel) return;
    try {
      const videos = await fetch(`${API}/api/videos`).then(r => r.json());
      if (!videos.length) {
        carousel.innerHTML = `<div class="empty-state" style="min-width:280px;">No videos posted yet.</div>`;
        return;
      }

      carousel.innerHTML = videos.slice().map(v => {
        const ytId  = youtubeId(v.url || "");
        const drvId = driveId(v.url || "");
        const thumb = v.thumbnail || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : "");
        const embed = ytId  ? `https://www.youtube.com/embed/${ytId}?autoplay=1&controls=1&rel=0&fs=1`
                    : drvId ? `https://drive.google.com/file/d/${drvId}/preview`
                    : "";

        const thumbContent = thumb
          ? `<img src="${esc(thumb)}" alt="${esc(v.title||"")}" loading="lazy">`
          : `<div class="video-no-thumb">No preview</div>`;

        return `
        <div class="video-slide" data-embed="${esc(embed)}" data-url="${esc(v.url||"")}">
          <div class="video-thumb-state">
            ${thumbContent}
            <div class="play-btn"><svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg></div>
          </div>
          <div class="video-iframe-state">
            <iframe src="" allowfullscreen allow="autoplay; fullscreen" loading="lazy"></iframe>
            <button class="video-fs-btn" title="Full screen">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="15,3 21,3 21,9"/><polyline points="9,21 3,21 3,15"/>
                <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
              </svg>
            </button>
            <button class="video-stop-btn" title="Close video">&#10005;</button>
          </div>
          <div class="video-slide-title">${esc(v.title||"")}</div>
        </div>`;
      }).join("");

      // Stop all playing videos except the specified one
      function stopAll(except) {
        carousel.querySelectorAll(".video-slide.is-playing").forEach(s => {
          if (s === except) return;
          s.classList.remove("is-playing");
          const f = s.querySelector(".video-iframe-state iframe");
          if (f) f.src = ""; // clears the video, stopping playback
        });
      }

      carousel.querySelectorAll(".video-slide").forEach(slide => {
        // Thumbnail click → play
        slide.querySelector(".video-thumb-state").addEventListener("click", () => {
          const embed = slide.dataset.embed;
          if (!embed) { window.open(slide.dataset.url, "_blank"); return; }
          stopAll(slide);
          const iframe = slide.querySelector(".video-iframe-state iframe");
          if (iframe) iframe.src = embed;
          slide.classList.add("is-playing");
        });

        // Fullscreen button
        const fsBtn = slide.querySelector(".video-fs-btn");
        if (fsBtn) fsBtn.addEventListener("click", e => {
          e.stopPropagation();
          const container = slide.querySelector(".video-iframe-state");
          (container.requestFullscreen || container.webkitRequestFullscreen ||
           container.mozRequestFullScreen || (() => {})).call(container);
        });

        // Stop / close button
        const stopBtn = slide.querySelector(".video-stop-btn");
        if (stopBtn) stopBtn.addEventListener("click", e => {
          e.stopPropagation();
          slide.classList.remove("is-playing");
          const iframe = slide.querySelector(".video-iframe-state iframe");
          if (iframe) iframe.src = "";
        });
      });

    } catch {
      carousel.innerHTML = `<div class="empty-state" style="min-width:280px;">Couldn't load videos right now.</div>`;
    }
  }


  /* ── Photos carousel ────────────────────────────────────── */
  async function loadPhotos() {
    const carousel = document.getElementById("photoCarousel");
    if (!carousel) return;
    try {
      const photos = await fetch(`${API}/api/photos`).then(r => r.json());
      if (!photos.length) { carousel.innerHTML = `<div class="empty-state" style="min-width:280px;">No photos yet.</div>`; return; }
      carousel.innerHTML = photos.slice().map(p => `
        <div class="photo-slide reveal in" data-src="${esc(p.image||"")}" data-alt="${esc(p.caption||"")}">
          <img src="${esc(p.image||"")}" alt="${esc(p.caption||"")}" loading="lazy">
          ${p.caption ? `<div class="photo-caption">${esc(p.caption)}</div>` : ""}
        </div>`).join("");

      carousel.querySelectorAll(".photo-slide").forEach(slide => {
        slide.addEventListener("click", () => openLightbox(slide.dataset.src, slide.dataset.alt));
      });
    } catch {
      carousel.innerHTML = `<div class="empty-state" style="min-width:280px;">Couldn't load photos.</div>`;
    }
  }

  /* ── Merch carousel ─────────────────────────────────────── */
  async function loadMerch() {
    const carousel = document.getElementById("merchCarousel");
    if (!carousel) return;
    try {
      const items = await fetch(`${API}/api/merch`).then(r => r.json());
      if (!items.length) { carousel.innerHTML = `<div class="empty-state" style="min-width:230px;">Merch coming soon.</div>`; return; }
      carousel.innerHTML = items.slice().map(m => `
        <a class="merch-slide reveal in" href="${esc(m.storeUrl||"#")}" target="_blank" rel="noopener">
          <img src="${esc(m.image||"")}" alt="${esc(m.title||"")}" loading="lazy">
          <div class="merch-body">
            <div class="merch-title">${esc(m.title||"")}</div>
            <div class="merch-store">Shop on ${esc(m.storeName||"store")}</div>
          </div>
        </a>`).join("");
    } catch {
      carousel.innerHTML = `<div class="empty-state" style="min-width:230px;">Couldn't load merch.</div>`;
    }
  }

  /* ── Booking form ───────────────────────────────────────── */
  const bookingForm = document.getElementById("bookingForm");
  if (bookingForm) {
    bookingForm.addEventListener("submit", async e => {
      e.preventDefault();
      const status    = document.getElementById("formStatus");
      const submitBtn = bookingForm.querySelector('button[type="submit"]');
      const payload   = {
        bookingType: bookingForm.bookingType.value,
        name:        bookingForm.name.value.trim(),
        email:       bookingForm.email.value.trim(),
        phone:       bookingForm.phone.value.trim(),
        eventDate:   bookingForm.eventDate.value,
        venue:       bookingForm.venue.value.trim(),
        message:     bookingForm.message.value.trim(),
      };
      if (!payload.bookingType) { status.textContent = "Please select what you're booking."; status.className = "form-status err"; return; }
      if (!payload.name || !payload.email) { status.textContent = "Name and email are required."; status.className = "form-status err"; return; }
      submitBtn.disabled = true; submitBtn.textContent = "Sending\u2026";
      status.textContent = ""; status.className = "form-status";
      try {
        const res  = await fetch(`${API}/api/booking`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Something went wrong.");
        status.textContent = "Got it \u2014 we'll be in touch soon!";
        status.className = "form-status ok";
        bookingForm.reset();
      } catch (err) {
        status.textContent = err.message || "Couldn't send that. Try again or email us directly.";
        status.className = "form-status err";
      } finally {
        submitBtn.disabled = false; submitBtn.textContent = "Send request";
      }
    });
  }

  /* ── Newsletter subscribe ───────────────────────────────── */
  const subBtn    = document.getElementById("subBtn");
  const subStatus = document.getElementById("subStatus");
  if (subBtn) {
    subBtn.addEventListener("click", async () => {
      const phone = (document.getElementById("subPhone").value || "").trim();
      const name  = (document.getElementById("subName").value  || "").trim();
      if (!phone) { subStatus.textContent = "Enter your phone number."; subStatus.className = "form-status err"; return; }
      subBtn.disabled = true; subBtn.textContent = "Signing up\u2026";
      subStatus.textContent = ""; subStatus.className = "form-status";
      try {
        const res  = await fetch(`${API}/api/newsletter/subscribe`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ phone, name }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Couldn't sign you up.");
        subStatus.textContent = data.already ? "You're already on the list!" : "You're in! Watch for a welcome text.";
        subStatus.className = "form-status ok";
        document.getElementById("subPhone").value = "";
        document.getElementById("subName").value  = "";
      } catch (err) {
        subStatus.textContent = err.message;
        subStatus.className = "form-status err";
      } finally {
        subBtn.disabled = false; subBtn.textContent = "Subscribe";
      }
    });
  }


  /* ── Site background photos ─────────────────────────────── */
  async function loadSitePhotos() {
    try {
      const photos = await fetch(`${API}/api/sitephotos`).then(r => r.json());
      document.querySelectorAll("[data-bg-key]").forEach(section => {
        const key = section.dataset.bgKey;
        if (photos[key]) {
          section.style.setProperty("--section-bg", `url(${photos[key]})`);
          section.classList.add("has-bg-photo");
        }
      });
      // Hero background
      if (photos.hero) {
        const heroBg = document.querySelector(".hero-bg-photo");
        if (heroBg) heroBg.style.backgroundImage = `url(${photos.hero})`;
      }
    } catch { /* fail silently — default dark bg is fine */ }
  }

  loadEvents();
  loadVideos();
  loadPhotos();
  loadMerch();
  loadSitePhotos();
})();
