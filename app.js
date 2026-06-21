// All Troy's Fault — public site logic
(function () {
  const API_BASE = CONFIG.API_BASE;

  /* ---------- Mobile nav ---------- */
  const navToggle = document.getElementById("navToggle");
  const navLinks = document.getElementById("navLinks");
  if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => navLinks.classList.toggle("open"));
    navLinks.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => navLinks.classList.remove("open"))
    );
  }

  /* ---------- Logo fallback ---------- */
  document.querySelectorAll("img[data-logo]").forEach((img) => {
    img.addEventListener("error", () => {
      img.style.display = "none";
      const fallback = img.parentElement.querySelector("[data-logo-fallback]");
      if (fallback) fallback.style.display = "flex";
    });
  });

  /* ---------- Scroll reveal ---------- */
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("in"));
  }

  /* ---------- Helpers ---------- */
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function youtubeId(url) {
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
    return m ? m[1] : null;
  }

  function detectPlatform(url) {
    if (/youtu\.?be/.test(url)) return "youtube";
    if (/instagram\.com/.test(url)) return "instagram";
    if (/tiktok\.com/.test(url)) return "tiktok";
    if (/facebook\.com/.test(url)) return "facebook";
    return "video";
  }

  function formatDate(dateStr) {
    // dateStr expected as YYYY-MM-DD
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return {
      dow: date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
      dom: String(d).padStart(2, "0"),
      mon: date.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
      sortKey: date.getTime(),
    };
  }

  function formatTime(timeStr) {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
  }

  /* ---------- Shows ---------- */
  async function loadEvents() {
    const list = document.getElementById("showList");
    if (!list) return;
    try {
      const res = await fetch(`${API_BASE}/api/events`);
      const events = await res.json();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const upcoming = events
        .filter((e) => {
          if (!e.date) return false;
          const [y, m, d] = e.date.split("-").map(Number);
          return new Date(y, m - 1, d) >= today;
        })
        .sort((a, b) => a.date.localeCompare(b.date));

      if (!upcoming.length) {
        list.innerHTML = `<div class="empty-state">No shows on the books right now — check back soon, or follow us so you don't miss the announcement.</div>`;
        return;
      }

      list.innerHTML = upcoming
        .map((e) => {
          const d = formatDate(e.date);
          return `
            <div class="ticket reveal in">
              <div class="ticket-date">
                <span class="dow">${d.dow}</span>
                <span class="dom">${d.dom}</span>
                <span class="mon">${d.mon}</span>
              </div>
              <div class="ticket-info">
                <div class="venue">${escapeHtml(e.venue || "TBA")}</div>
                <div class="place">${escapeHtml(e.location || "")}</div>
                ${e.notes ? `<div class="note">${escapeHtml(e.notes)}</div>` : ""}
              </div>
              <div class="ticket-time">
                ${e.time ? formatTime(e.time) : ""}
                ${e.ticketUrl ? `<br><a class="ticket-link" href="${escapeHtml(e.ticketUrl)}" target="_blank" rel="noopener">Details →</a>` : ""}
              </div>
            </div>`;
        })
        .join("");
    } catch (err) {
      list.innerHTML = `<div class="empty-state">Couldn't load the schedule right now. Try refreshing in a bit.</div>`;
    }
  }

  /* ---------- Videos ---------- */
  async function loadVideos() {
    const grid = document.getElementById("videoGrid");
    if (!grid) return;
    try {
      const res = await fetch(`${API_BASE}/api/videos`);
      const videos = await res.json();

      if (!videos.length) {
        grid.innerHTML = `<div class="empty-state">No videos posted yet — live footage is coming soon.</div>`;
        return;
      }

      grid.innerHTML = videos
        .slice()
        .reverse()
        .map((v) => {
          const platform = detectPlatform(v.url);
          if (platform === "youtube") {
            const id = youtubeId(v.url);
            if (id) {
              return `
                <div class="video-card reveal in">
                  <div class="video-frame">
                    <iframe src="https://www.youtube.com/embed/${id}" title="${escapeHtml(v.title || "")}" allowfullscreen loading="lazy"></iframe>
                  </div>
                  <div class="video-title">${escapeHtml(v.title || "")}</div>
                </div>`;
            }
          }
          const labels = { instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", video: "Video" };
          return `
            <a class="video-link-tile reveal in" href="${escapeHtml(v.url)}" target="_blank" rel="noopener">
              <span class="platform">${labels[platform]}</span>
              <span style="font-weight:600;">${escapeHtml(v.title || "Watch clip")}</span>
              <span class="watch">Watch →</span>
            </a>`;
        })
        .join("");
    } catch (err) {
      grid.innerHTML = `<div class="empty-state">Couldn't load videos right now. Try refreshing in a bit.</div>`;
    }
  }

  /* ---------- Merch ---------- */
  async function loadMerch() {
    const grid = document.getElementById("merchGrid");
    if (!grid) return;
    try {
      const res = await fetch(`${API_BASE}/api/merch`);
      const items = await res.json();

      if (!items.length) {
        grid.innerHTML = `<div class="empty-state">The merch table's still being set up — check back soon.</div>`;
        return;
      }

      grid.innerHTML = items
        .slice()
        .reverse()
        .map(
          (item) => `
            <a class="merch-card reveal in" href="${escapeHtml(item.storeUrl)}" target="_blank" rel="noopener">
              <img class="merch-img" src="${escapeHtml(item.image || "")}" alt="${escapeHtml(item.title || "")}" loading="lazy">
              <div class="merch-body">
                <div class="merch-title">${escapeHtml(item.title || "")}</div>
                <div class="merch-store">Shop on ${escapeHtml(item.storeName || "store")}</div>
              </div>
            </a>`
        )
        .join("");
    } catch (err) {
      grid.innerHTML = `<div class="empty-state">Couldn't load merch right now. Try refreshing in a bit.</div>`;
    }
  }

  /* ---------- Booking form ---------- */
  const bookingForm = document.getElementById("bookingForm");
  if (bookingForm) {
    bookingForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const status = document.getElementById("formStatus");
      const submitBtn = bookingForm.querySelector('button[type="submit"]');
      const payload = {
        name: bookingForm.name.value.trim(),
        email: bookingForm.email.value.trim(),
        phone: bookingForm.phone.value.trim(),
        eventDate: bookingForm.eventDate.value,
        venue: bookingForm.venue.value.trim(),
        message: bookingForm.message.value.trim(),
      };

      if (!payload.name || !payload.email) {
        status.textContent = "Please fill in your name and email.";
        status.className = "form-status err";
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Sending…";
      status.textContent = "";
      status.className = "form-status";

      try {
        const res = await fetch(`${API_BASE}/api/booking`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Something went wrong.");
        status.textContent = "Got it — we'll be in touch soon. Thanks for reaching out!";
        status.className = "form-status ok";
        bookingForm.reset();
      } catch (err) {
        status.textContent = err.message || "Couldn't send that — try again, or email us directly.";
        status.className = "form-status err";
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send request";
      }
    });
  }

  loadEvents();
  loadVideos();
  loadMerch();
})();
