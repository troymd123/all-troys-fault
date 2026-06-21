// All Troy's Fault — admin console logic
(function () {
  const API_BASE = CONFIG.API_BASE;
  const SESSION_KEY = "atf_admin_pw";

  const loginView = document.getElementById("loginView");
  const dashView = document.getElementById("dashView");
  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");
  const logoutBtn = document.getElementById("logoutBtn");

  function getPassword() {
    return sessionStorage.getItem(SESSION_KEY);
  }

  function showDashboard() {
    loginView.style.display = "none";
    dashView.style.display = "block";
    loadAll();
  }

  function showLogin() {
    loginView.style.display = "block";
    dashView.style.display = "none";
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = document.getElementById("loginPassword").value;
    loginError.textContent = "";
    const btn = loginForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Checking…";
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed.");
      sessionStorage.setItem(SESSION_KEY, password);
      loginForm.reset();
      showDashboard();
    } catch (err) {
      loginError.textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = "Enter";
    }
  });

  logoutBtn.addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    showLogin();
  });

  /* ---------- Tabs ---------- */
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".admin-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`panel-${btn.dataset.tab}`).classList.add("active");
    });
  });

  /* ---------- API helper ---------- */
  async function callApi(type, action, item, itemId) {
    const res = await fetch(`${API_BASE}/api/admin/data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: getPassword(), type, action, item, itemId }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        sessionStorage.removeItem(SESSION_KEY);
        showLogin();
      }
      throw new Error(data.error || "Request failed.");
    }
    return data.list;
  }

  async function fetchPublic(type) {
    const res = await fetch(`${API_BASE}/api/${type}`);
    return res.json();
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  /* ---------- Image compression for merch uploads ---------- */
  function compressImage(file, maxWidth = 700, quality = 0.75) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxWidth / img.width);
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = () => reject(new Error("Could not read that image."));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error("Could not read that file."));
      reader.readAsDataURL(file);
    });
  }

  /* =========================================================
     EVENTS
     ========================================================= */
  const eventForm = document.getElementById("eventForm");
  const eventList = document.getElementById("eventList");
  let editingEventId = null;

  function renderEvents(events) {
    if (!events.length) {
      eventList.innerHTML = `<div class="empty-state">No shows added yet.</div>`;
      return;
    }
    eventList.innerHTML = events
      .slice()
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
      .map(
        (e) => `
          <div class="admin-row">
            <div class="meta">
              <div class="title">${escapeHtml(e.date || "")} — ${escapeHtml(e.venue || "")}</div>
              <div class="sub">${escapeHtml(e.location || "")}${e.time ? " · " + escapeHtml(e.time) : ""}</div>
            </div>
            <div class="row-actions">
              <button data-edit="${e.id}">Edit</button>
              <button class="danger" data-delete="${e.id}">Delete</button>
            </div>
          </div>`
      )
      .join("");

    eventList.querySelectorAll("[data-edit]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const ev = events.find((x) => x.id === btn.dataset.edit);
        if (!ev) return;
        editingEventId = ev.id;
        eventForm.venue.value = ev.venue || "";
        eventForm.location.value = ev.location || "";
        eventForm.date.value = ev.date || "";
        eventForm.time.value = ev.time || "";
        eventForm.ticketUrl.value = ev.ticketUrl || "";
        eventForm.notes.value = ev.notes || "";
        eventForm.querySelector('button[type="submit"]').textContent = "Update show";
        eventForm.scrollIntoView({ behavior: "smooth", block: "center" });
      })
    );
    eventList.querySelectorAll("[data-delete]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this show?")) return;
        try {
          const list = await callApi("events", "delete", null, btn.dataset.delete);
          renderEvents(list);
        } catch (err) {
          alert(err.message);
        }
      })
    );
  }

  eventForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const item = {
      venue: eventForm.venue.value.trim(),
      location: eventForm.location.value.trim(),
      date: eventForm.date.value,
      time: eventForm.time.value,
      ticketUrl: eventForm.ticketUrl.value.trim(),
      notes: eventForm.notes.value.trim(),
    };
    if (!item.venue || !item.date) {
      alert("Venue and date are required.");
      return;
    }
    try {
      const list = await callApi("events", editingEventId ? "update" : "add", item, editingEventId);
      renderEvents(list);
      eventForm.reset();
      editingEventId = null;
      eventForm.querySelector('button[type="submit"]').textContent = "Add show";
    } catch (err) {
      alert(err.message);
    }
  });

  document.getElementById("eventCancelEdit").addEventListener("click", () => {
    eventForm.reset();
    editingEventId = null;
    eventForm.querySelector('button[type="submit"]').textContent = "Add show";
  });

  /* =========================================================
     VIDEOS
     ========================================================= */
  const videoForm = document.getElementById("videoForm");
  const videoList = document.getElementById("videoList");

  function renderVideos(videos) {
    if (!videos.length) {
      videoList.innerHTML = `<div class="empty-state">No videos added yet.</div>`;
      return;
    }
    videoList.innerHTML = videos
      .slice()
      .reverse()
      .map(
        (v) => `
          <div class="admin-row">
            <div class="meta">
              <div class="title">${escapeHtml(v.title || "Untitled clip")}</div>
              <div class="sub">${escapeHtml(v.url)}</div>
            </div>
            <div class="row-actions">
              <button class="danger" data-delete="${v.id}">Delete</button>
            </div>
          </div>`
      )
      .join("");

    videoList.querySelectorAll("[data-delete]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this video?")) return;
        try {
          const list = await callApi("videos", "delete", null, btn.dataset.delete);
          renderVideos(list);
        } catch (err) {
          alert(err.message);
        }
      })
    );
  }

  videoForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const item = {
      title: videoForm.title.value.trim(),
      url: videoForm.url.value.trim(),
    };
    if (!item.url) {
      alert("A video link is required.");
      return;
    }
    try {
      const list = await callApi("videos", "add", item);
      renderVideos(list);
      videoForm.reset();
    } catch (err) {
      alert(err.message);
    }
  });

  /* =========================================================
     MERCH
     ========================================================= */
  const merchForm = document.getElementById("merchForm");
  const merchList = document.getElementById("merchList");

  function renderMerch(items) {
    if (!items.length) {
      merchList.innerHTML = `<div class="empty-state">No merch items added yet.</div>`;
      return;
    }
    merchList.innerHTML = items
      .slice()
      .reverse()
      .map(
        (m) => `
          <div class="admin-row">
            <div class="admin-meta-row">
              <img class="admin-thumb" src="${escapeHtml(m.image || "")}" alt="">
              <div class="meta">
                <div class="title">${escapeHtml(m.title || "")}</div>
                <div class="sub">${escapeHtml(m.storeName || "")}</div>
              </div>
            </div>
            <div class="row-actions">
              <button class="danger" data-delete="${m.id}">Delete</button>
            </div>
          </div>`
      )
      .join("");

    merchList.querySelectorAll("[data-delete]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this merch item?")) return;
        try {
          const list = await callApi("merch", "delete", null, btn.dataset.delete);
          renderMerch(list);
        } catch (err) {
          alert(err.message);
        }
      })
    );
  }

  merchForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = merchForm.querySelector('button[type="submit"]');
    const title = merchForm.title.value.trim();
    const storeName = merchForm.storeName.value.trim();
    const storeUrl = merchForm.storeUrl.value.trim();
    const imageUrl = merchForm.imageUrl.value.trim();
    const file = merchForm.imageFile.files[0];

    if (!title || !storeName || !storeUrl) {
      alert("Title, store name, and store link are required.");
      return;
    }
    if (!file && !imageUrl) {
      alert("Add a sample design — either upload an image or paste an image URL.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Saving…";
    try {
      const image = file ? await compressImage(file) : imageUrl;
      const list = await callApi("merch", "add", { title, storeName, storeUrl, image });
      renderMerch(list);
      merchForm.reset();
    } catch (err) {
      alert(err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Add item";
    }
  });

  /* ---------- Load everything ---------- */
  async function loadAll() {
    try {
      const [events, videos, merch] = await Promise.all([
        fetchPublic("events"),
        fetchPublic("videos"),
        fetchPublic("merch"),
      ]);
      renderEvents(events);
      renderVideos(videos);
      renderMerch(merch);
    } catch (err) {
      console.error(err);
    }
  }

  /* ---------- Init: auto-login if session password still valid ---------- */
  (async function init() {
    const pw = getPassword();
    if (!pw) {
      showLogin();
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        showDashboard();
      } else {
        sessionStorage.removeItem(SESSION_KEY);
        showLogin();
      }
    } catch (err) {
      showLogin();
    }
  })();
})();
