// All Troy's Fault — admin console logic v2
(function () {
  const API = CONFIG.API_BASE;
  const SESSION_KEY = "atf_admin_pw";
  // Track current lists for reorder
  let videosList = [], photosList = [], currentMerch = [];

  const loginView = document.getElementById("loginView");
  const dashView  = document.getElementById("dashView");
  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");
  const logoutBtn  = document.getElementById("logoutBtn");

  function getPassword() { return sessionStorage.getItem(SESSION_KEY); }
  function showDashboard() { loginView.style.display="none"; dashView.style.display="block"; loadAll(); loadSubCount(); }
  function showLogin()     { loginView.style.display="block"; dashView.style.display="none"; }

  loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    const password = document.getElementById("loginPassword").value;
    loginError.textContent = "";
    const btn = loginForm.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = "Checking\u2026";
    try {
      const res = await fetch(`${API}/api/admin/login`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({password}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed.");
      sessionStorage.setItem(SESSION_KEY, password);
      loginForm.reset();
      showDashboard();
    } catch(err) { loginError.textContent = err.message; }
    finally { btn.disabled=false; btn.textContent="Enter"; }
  });

  logoutBtn.addEventListener("click", () => { sessionStorage.removeItem(SESSION_KEY); showLogin(); });

  /* ── Tabs ───────────────────────────────────────────────── */
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".admin-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`panel-${btn.dataset.tab}`).classList.add("active");
    });
  });

  /* ── API helper ─────────────────────────────────────────── */
  async function callApi(type, action, item, itemId, orderedIds) {
    const res  = await fetch(`${API}/api/admin/data`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({password:getPassword(), type, action, item, itemId, orderedIds}) });
    const data = await res.json();
    if (!res.ok) { if (res.status===401){sessionStorage.removeItem(SESSION_KEY);showLogin();} throw new Error(data.error||"Request failed."); }
    return data.list;
  }

  async function fetchPublic(type) { return fetch(`${API}/api/${type}`).then(r => r.json()); }

  function esc(str) { const d=document.createElement("div"); d.textContent=str==null?"":String(str); return d.innerHTML; }

  /* ── Subscriber count ───────────────────────────────────── */
  async function loadSubCount() {
    try {
      const res  = await fetch(`${API}/api/admin/subscribers`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({password:getPassword()}) });
      const data = await res.json();
      const el   = document.getElementById("subCount");
      if (el && data.count !== undefined) el.textContent = `${data.count} SMS subscriber${data.count===1?"":"s"}`;
    } catch {}
  }

  /* ── Image compression ──────────────────────────────────── */
  function compressImage(file, maxWidth=700, quality=0.75) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const scale  = Math.min(1, maxWidth/img.width);
          const canvas = document.createElement("canvas");
          canvas.width  = Math.round(img.width*scale);
          canvas.height = Math.round(img.height*scale);
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = () => reject(new Error("Could not read image."));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error("Could not read file."));
      reader.readAsDataURL(file);
    });
  }

  /* ═══════════════════════════════════════════════
     EVENTS
  ════════════════════════════════════════════════ */
  const eventForm  = document.getElementById("eventForm");
  const eventList  = document.getElementById("eventList");
  let editingEventId = null;

  function renderEvents(events) {
    if (!events.length) { eventList.innerHTML=`<div class="empty-state">No shows added yet.</div>`; return; }
    eventList.innerHTML = events.slice().sort((a,b)=>(a.date||"").localeCompare(b.date||"")).map(e => `
      <div class="admin-row">
        <div class="meta">
          <div class="title">${esc(e.date||"")} &mdash; ${esc(e.venue||"")}</div>
          <div class="sub">${esc(e.location||"")}${e.time?" &middot; "+esc(e.time):""}</div>
        </div>
        <div class="row-actions">
          <button data-edit="${e.id}">Edit</button>
          <button class="danger" data-delete="${e.id}">Delete</button>
        </div>
      </div>`).join("");
    eventList.querySelectorAll("[data-edit]").forEach(btn => {
      btn.addEventListener("click", () => {
        const ev = events.find(x => x.id===btn.dataset.edit); if(!ev) return;
        editingEventId = ev.id;
        eventForm.querySelector('[name="venue"]').value     = ev.venue||"";
        eventForm.querySelector('[name="location"]').value  = ev.location||"";
        eventForm.querySelector('[name="address"]').value   = ev.address||"";
        eventForm.querySelector('[name="date"]').value      = ev.date||"";
        eventForm.querySelector('[name="time"]').value      = ev.time||"";
        eventForm.querySelector('[name="ticketUrl"]').value = ev.ticketUrl||"";
        eventForm.querySelector('[name="notes"]').value     = ev.notes||"";
        eventForm.querySelector('button[type="submit"]').textContent = "Update show";
        eventForm.scrollIntoView({behavior:"smooth",block:"center"});
      });
    });
    eventList.querySelectorAll("[data-delete]").forEach(btn => {
      btn.addEventListener("click", async () => {
        if(!confirm("Delete this show?")) return;
        try { renderEvents(await callApi("events","delete",null,btn.dataset.delete)); } catch(err){alert(err.message);}
      });
    });
  }

  eventForm.addEventListener("submit", async e => {
    e.preventDefault();
    const item = {
      venue:     eventForm.querySelector('[name="venue"]').value.trim(),
      location:  eventForm.querySelector('[name="location"]').value.trim(),
      address:   eventForm.querySelector('[name="address"]').value.trim(),
      date:      eventForm.querySelector('[name="date"]').value,
      time:      eventForm.querySelector('[name="time"]').value,
      ticketUrl: eventForm.querySelector('[name="ticketUrl"]').value.trim(),
      notes:     eventForm.querySelector('[name="notes"]').value.trim(),
    };
    if(!item.venue||!item.date){alert("Venue and date are required.");return;}
    try {
      renderEvents(await callApi("events", editingEventId?"update":"add", item, editingEventId));
      eventForm.reset(); editingEventId=null;
      eventForm.querySelector('button[type="submit"]').textContent="Add show";
    } catch(err){alert(err.message);}
  });

  document.getElementById("eventCancelEdit").addEventListener("click", () => {
    eventForm.reset(); editingEventId=null;
    eventForm.querySelector('button[type="submit"]').textContent="Add show";
  });

  /* ═══════════════════════════════════════════════
     VIDEOS
  ════════════════════════════════════════════════ */
  const videoForm = document.getElementById("videoForm");
  const videoList = document.getElementById("videoList");

  function renderVideos(videos) {
    videosList = [...videos];
    if (!videos.length) { videoList.innerHTML=`<div class="empty-state">No videos added yet.</div>`; return; }
    videoList.innerHTML = videos.map((v, idx, arr) => `
      <div class="admin-row">
        <div class="admin-meta-row">
          ${v.thumbnail ? `<img class="admin-thumb" src="${esc(v.thumbnail)}" alt="">` : ""}
          <div class="meta">
            <div class="title">${esc(v.title||"Untitled")}</div>
            <div class="sub">${esc(v.url||"")}</div>
          </div>
        </div>
        <div class="row-actions">
          <button class="reorder-btn" data-idx="${idx}" data-dir="up" ${idx===0?"disabled":""}>&#8593;</button>
          <button class="reorder-btn" data-idx="${idx}" data-dir="down" ${idx===arr.length-1?"disabled":""}>&#8595;</button>
          <button class="danger" data-delete="${v.id}">Delete</button>
        </div>
      </div>`).join("");
    videoList.querySelectorAll(".reorder-btn").forEach(btn => btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.idx), toIdx = btn.dataset.dir==="up" ? idx-1 : idx+1;
      const nl = [...videosList]; const [m]=nl.splice(idx,1); nl.splice(toIdx,0,m);
      try { renderVideos(await callApi("videos","reorder",null,null,nl.map(i=>i.id))); } catch(err){alert(err.message);}
    }));
    videoList.querySelectorAll("[data-delete]").forEach(btn =>
      btn.addEventListener("click", async () => {
        if(!confirm("Delete this video?")) return;
        try { renderVideos(await callApi("videos","delete",null,btn.dataset.delete)); } catch(err){alert(err.message);}
      })
    );
  }

  videoForm.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = videoForm.querySelector('button[type="submit"]');
    const url  = videoForm.querySelector('[name="url"]').value.trim();
    const title = videoForm.querySelector('[name="title"]').value.trim();
    const thumbFile = videoForm.querySelector('[name="thumbFile"]').files[0];
    const thumbUrl  = videoForm.querySelector('[name="thumbUrl"]').value.trim();
    if(!url){alert("A video link is required.");return;}
    btn.disabled=true; btn.textContent="Saving\u2026";
    try {
      const thumbnail = thumbFile ? await compressImage(thumbFile, 640, 0.78) : thumbUrl;
      renderVideos(await callApi("videos","add",{title, url, thumbnail}));
      videoForm.reset();
    } catch(err){alert(err.message);}
    finally{btn.disabled=false; btn.textContent="Add video";}
  });

  /* ═══════════════════════════════════════════════
     PHOTOS
  ════════════════════════════════════════════════ */
  const photoForm = document.getElementById("photoForm");
  const photoList = document.getElementById("photoList");

  function renderPhotos(photos) {
    photosList = [...photos];
    if (!photos.length) { photoList.innerHTML=`<div class="empty-state">No photos added yet.</div>`; return; }
    photoList.innerHTML = photos.map((p, idx, arr) => `
      <div class="admin-row">
        <div class="admin-meta-row">
          <img class="admin-thumb" src="${esc(p.image||"")}" alt="">
          <div class="meta">
            <div class="title">${esc(p.caption||"Untitled photo")}</div>
          </div>
        </div>
        <div class="row-actions">
          <button class="reorder-btn" data-idx="${idx}" data-dir="up" ${idx===0?"disabled":""}>&#8593;</button>
          <button class="reorder-btn" data-idx="${idx}" data-dir="down" ${idx===arr.length-1?"disabled":""}>&#8595;</button>
          <button class="danger" data-delete="${p.id}">Delete</button>
        </div>
      </div>`).join("");
    photoList.querySelectorAll(".reorder-btn").forEach(btn => btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.idx), toIdx = btn.dataset.dir==="up" ? idx-1 : idx+1;
      const nl = [...photosList]; const [m]=nl.splice(idx,1); nl.splice(toIdx,0,m);
      try { renderPhotos(await callApi("photos","reorder",null,null,nl.map(i=>i.id))); } catch(err){alert(err.message);}
    }));
    photoList.querySelectorAll("[data-delete]").forEach(btn =>
      btn.addEventListener("click", async () => {
        if(!confirm("Delete this photo?")) return;
        try { renderPhotos(await callApi("photos","delete",null,btn.dataset.delete)); } catch(err){alert(err.message);}
      })
    );
  }

  photoForm.addEventListener("submit", async e => {
    e.preventDefault();
    const btn       = photoForm.querySelector('button[type="submit"]');
    const file      = photoForm.querySelector('[name="photoFile"]').files[0];
    const url       = photoForm.querySelector('[name="photoUrl"]').value.trim();
    const caption   = photoForm.querySelector('[name="caption"]').value.trim();
    if(!file && !url){alert("Upload a photo or paste an image URL.");return;}
    btn.disabled=true; btn.textContent="Saving\u2026";
    try {
      const image = file ? await compressImage(file, 900, 0.8) : url;
      renderPhotos(await callApi("photos","add",{image, caption}));
      photoForm.reset();
    } catch(err){alert(err.message);}
    finally{btn.disabled=false; btn.textContent="Add photo";}
  });

  /* ═══════════════════════════════════════════════
     MERCH
  ════════════════════════════════════════════════ */
  const merchForm = document.getElementById("merchForm");
  const merchList = document.getElementById("merchList");

  function renderMerch(items) {
    currentMerch = [...items];
    if (!items.length) { merchList.innerHTML=`<div class="empty-state">No merch items yet.</div>`; return; }
    merchList.innerHTML = items.map((m, idx, arr) => `
      <div class="admin-row">
        <div class="admin-meta-row">
          <img class="admin-thumb" src="${esc(m.image||"")}" alt="">
          <div class="meta">
            <div class="title">${esc(m.title||"")}</div>
            <div class="sub">${esc(m.storeName||"")}</div>
          </div>
        </div>
        <div class="row-actions">
          <button class="reorder-btn" data-idx="${idx}" data-dir="up" ${idx===0?"disabled":""}>&#8593;</button>
          <button class="reorder-btn" data-idx="${idx}" data-dir="down" ${idx===arr.length-1?"disabled":""}>&#8595;</button>
          <button class="danger" data-delete="${m.id}">Delete</button>
        </div>
      </div>`).join("");
    merchList.querySelectorAll(".reorder-btn").forEach(btn => btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.idx), toIdx = btn.dataset.dir==="up" ? idx-1 : idx+1;
      const nl = [...currentMerch]; const [mv]=nl.splice(idx,1); nl.splice(toIdx,0,mv);
      try { renderMerch(await callApi("merch","reorder",null,null,nl.map(i=>i.id))); } catch(err){alert(err.message);}
    }));
    merchList.querySelectorAll("[data-delete]").forEach(btn =>
      btn.addEventListener("click", async () => {
        if(!confirm("Delete this merch item?")) return;
        try { renderMerch(await callApi("merch","delete",null,btn.dataset.delete)); } catch(err){alert(err.message);}
      })
    );
  }

  merchForm.addEventListener("submit", async e => {
    e.preventDefault();
    const btn       = merchForm.querySelector('button[type="submit"]');
    const title     = merchForm.querySelector('[name="title"]').value.trim();
    const storeName = merchForm.querySelector('[name="storeName"]').value.trim();
    const storeUrl  = merchForm.querySelector('[name="storeUrl"]').value.trim();
    const file      = merchForm.querySelector('[name="imageFile"]').files[0];
    const imageUrl  = merchForm.querySelector('[name="imageUrl"]').value.trim();
    if(!title||!storeName||!storeUrl){alert("Title, store name, and store link are required.");return;}
    if(!file&&!imageUrl){alert("Add a design image or paste an image URL.");return;}
    btn.disabled=true; btn.textContent="Saving\u2026";
    try {
      const image = file ? await compressImage(file) : imageUrl;
      renderMerch(await callApi("merch","add",{title, storeName, storeUrl, image}));
      merchForm.reset();
    } catch(err){alert(err.message);}
    finally{btn.disabled=false; btn.textContent="Add item";}
  });


  /* ═══════════════════════════════════════════════
     BACKGROUND PHOTOS
  ════════════════════════════════════════════════ */
  const BG_SLOTS = ["hero","shows","videos","merch","book","follow"];

  async function loadBgPhotos() {
    try {
      const res    = await fetch(`${API}/api/sitephotos`);
      const photos = await res.json();
      BG_SLOTS.forEach(slot => {
        const thumb = document.getElementById(`bgThumb-${slot}`);
        if (thumb && photos[slot]) {
          thumb.src = photos[slot];
          thumb.classList.add("visible");
        }
      });
    } catch {}
  }

  async function saveBg(slot) {
    const status  = document.getElementById("bgStatus");
    const file    = document.getElementById(`bgFile-${slot}`).files[0];
    const urlVal  = document.getElementById(`bgUrl-${slot}`).value.trim();
    if (!file && !urlVal) { status.textContent = "Upload a photo or paste a URL."; status.className = "form-status err"; return; }
    status.textContent = "Saving…"; status.className = "form-status";
    try {
      const image = file ? await compressImage(file, 1200, 0.78) : urlVal;
      const res   = await fetch(`${API}/api/admin/sitephotos`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: getPassword(), slot, image }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");
      const thumb = document.getElementById(`bgThumb-${slot}`);
      if (thumb) { thumb.src = image; thumb.classList.add("visible"); }
      document.getElementById(`bgFile-${slot}`).value = "";
      document.getElementById(`bgUrl-${slot}`).value  = "";
      status.textContent = `✓ ${slot} background saved.`;
      status.className = "form-status ok";
    } catch(err) { status.textContent = err.message; status.className = "form-status err"; }
  }

  async function clearBg(slot) {
    if (!confirm(`Clear the ${slot} background photo?`)) return;
    const status = document.getElementById("bgStatus");
    try {
      const res  = await fetch(`${API}/api/admin/sitephotos`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: getPassword(), slot, image: "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Clear failed.");
      const thumb = document.getElementById(`bgThumb-${slot}`);
      if (thumb) { thumb.src = ""; thumb.classList.remove("visible"); }
      status.textContent = `✓ ${slot} background cleared.`;
      status.className = "form-status ok";
    } catch(err) { status.textContent = err.message; status.className = "form-status err"; }
  }

  // Expose to inline onclick handlers in admin.html
  window.saveBg  = saveBg;
  window.clearBg = clearBg;

  /* ── Load all ───────────────────────────────────────────── */
  async function loadAll() {
    try {
      const [events, videos, photos, merch] = await Promise.all([
        fetchPublic("events"), fetchPublic("videos"), fetchPublic("photos"), fetchPublic("merch"),
      ]);
      renderEvents(events); renderVideos(videos); renderPhotos(photos); renderMerch(merch);
      loadBgPhotos();
    } catch(err){console.error(err);}
  }

  /* ── Init ───────────────────────────────────────────────── */
  (async function init() {
    const pw = getPassword();
    if (!pw) { showLogin(); return; }
    try {
      const res = await fetch(`${API}/api/admin/login`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({password:pw}) });
      res.ok ? showDashboard() : (sessionStorage.removeItem(SESSION_KEY), showLogin());
    } catch { showLogin(); }
  })();
})();
