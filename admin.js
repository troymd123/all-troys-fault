// All Troy's Fault — admin console logic v2
(function () {
  const API = CONFIG.API_BASE;
  const SESSION_KEY = "atf_admin_pw";
  // Track current lists for reorder
  let videosList = [], photosList = [], currentMerch = [];
  // Track edit state
  let editingVideoId = null, editingVideoItem = null;
  let editingPhotoId = null, editingPhotoItem = null;
  let editingMerchId = null, editingMerchItem = null;

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
      if (btn.dataset.tab === "subscribers") loadSubCount();
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
      const countStr = `${data.count} SMS subscriber${data.count===1?"":"s"}`;
      const el   = document.getElementById("subCount");
      if (el) el.textContent = countStr;
      const el2  = document.getElementById("subCountPanel");
      if (el2) el2.textContent = countStr;
      if (data.subscribers) renderSubscribers(data.subscribers);
    } catch {}
  }

  function renderSubscribers(subs) {
    const list = document.getElementById("subscriberList");
    if (!list) return;
    if (!subs.length) {
      list.innerHTML = `<div class="empty-state">No subscribers yet.</div>`;
      return;
    }
    list.innerHTML = subs.map(s => {
      const email   = s.email || s.phone || "";
      const name    = s.name  || "";
      const date    = s.createdAt ? new Date(s.createdAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "";
      const display = name ? `${esc(name)} &mdash; ${esc(email)}` : esc(email);
      return `
      <div class="admin-row">
        <div class="meta">
          <div class="title">${display}</div>
          ${date ? `<div class="sub">${date}</div>` : ""}
        </div>
        <div class="row-actions">
          <button class="danger" data-sub-id="${s.id}">Remove</button>
        </div>
      </div>`;
    }).join("");

    list.querySelectorAll("[data-sub-id]").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Remove this subscriber?")) return;
        try {
          const res  = await fetch(`${API}/api/admin/subscribers`, {
            method: "POST", headers: {"Content-Type":"application/json"},
            body: JSON.stringify({password: getPassword(), action: "delete", id: btn.dataset.subId})
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed.");
          const countStr = `${data.count} SMS subscriber${data.count===1?"":"s"}`;
          const el  = document.getElementById("subCount");
          const el2 = document.getElementById("subCountPanel");
          if (el)  el.textContent  = countStr;
          if (el2) el2.textContent = countStr;
          renderSubscribers(data.subscribers);
        } catch(err) { alert(err.message); }
      });
    });
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
          </div>
        </div>
        <div class="row-actions">
          <button class="reorder-btn" data-idx="${idx}" data-dir="up" ${idx===0?"disabled":""}>&#8593;</button>
          <button class="reorder-btn" data-idx="${idx}" data-dir="down" ${idx===arr.length-1?"disabled":""}>&#8595;</button>
          <button data-edit="${v.id}">Edit</button>
          <button class="danger" data-delete="${v.id}">Delete</button>
        </div>
      </div>`).join("");
    videoList.querySelectorAll(".reorder-btn").forEach(btn => btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.idx), toIdx = btn.dataset.dir==="up" ? idx-1 : idx+1;
      const nl = [...videosList]; const [m]=nl.splice(idx,1); nl.splice(toIdx,0,m);
      try { renderVideos(await callApi("videos","reorder",null,null,nl.map(i=>i.id))); } catch(err){alert(err.message);}
    }));
    videoList.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", () => {
      const v = videosList.find(x => x.id===btn.dataset.edit); if(!v) return;
      editingVideoId = v.id; editingVideoItem = v;
      videoForm.querySelector('[name="title"]').value    = v.title||"";
      videoForm.querySelector('[name="url"]').value      = v.url||"";
      videoForm.querySelector('[name="thumbUrl"]').value = "";
      videoForm.querySelector('[name="thumbFile"]').value = "";
      videoForm.querySelector('button[type="submit"]').textContent = "Update video";
      videoForm.scrollIntoView({behavior:"smooth",block:"center"});
    }));
    videoList.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", async () => {
      if(!confirm("Delete this video?")) return;
      try { renderVideos(await callApi("videos","delete",null,btn.dataset.delete)); } catch(err){alert(err.message);}
    }));
  }

  videoForm.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = videoForm.querySelector('button[type="submit"]');
    const url  = videoForm.querySelector('[name="url"]').value.trim();
    const title = videoForm.querySelector('[name="title"]').value.trim();
    const thumbFile = videoForm.querySelector('[name="thumbFile"]').files[0];
    const thumbUrl  = videoForm.querySelector('[name="thumbUrl"]').value.trim();
    if(!url){alert("A video link is required.");return;}
    btn.disabled=true; btn.textContent="Saving…";
    try {
      const thumbnail = thumbFile ? await compressImage(thumbFile, 640, 0.78)
        : thumbUrl ? thumbUrl
        : (editingVideoItem ? editingVideoItem.thumbnail||"" : "");
      const action = editingVideoId ? "update" : "add";
      renderVideos(await callApi("videos", action, {title, url, thumbnail}, editingVideoId));
      videoForm.reset(); editingVideoId=null; editingVideoItem=null;
      videoForm.querySelector('button[type="submit"]').textContent="Add video";
    } catch(err){alert(err.message);}
    finally{btn.disabled=false;}
  });
  document.getElementById("videoCancelEdit").addEventListener("click", () => {
    videoForm.reset(); editingVideoId=null; editingVideoItem=null;
    videoForm.querySelector('button[type="submit"]').textContent="Add video";
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
          <button data-edit="${p.id}">Edit</button>
          <button class="danger" data-delete="${p.id}">Delete</button>
        </div>
      </div>`).join("");
    photoList.querySelectorAll(".reorder-btn").forEach(btn => btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.idx), toIdx = btn.dataset.dir==="up" ? idx-1 : idx+1;
      const nl = [...photosList]; const [m]=nl.splice(idx,1); nl.splice(toIdx,0,m);
      try { renderPhotos(await callApi("photos","reorder",null,null,nl.map(i=>i.id))); } catch(err){alert(err.message);}
    }));
    photoList.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", () => {
      const p = photosList.find(x => x.id===btn.dataset.edit); if(!p) return;
      editingPhotoId = p.id; editingPhotoItem = p;
      photoForm.querySelector('[name="caption"]').value  = p.caption||"";
      photoForm.querySelector('[name="photoUrl"]').value = "";
      photoForm.querySelector('[name="photoFile"]').value = "";
      photoForm.querySelector('button[type="submit"]').textContent = "Update photo";
      photoForm.scrollIntoView({behavior:"smooth",block:"center"});
    }));
    photoList.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", async () => {
      if(!confirm("Delete this photo?")) return;
      try { renderPhotos(await callApi("photos","delete",null,btn.dataset.delete)); } catch(err){alert(err.message);}
    }));
  }

  photoForm.addEventListener("submit", async e => {
    e.preventDefault();
    const btn     = photoForm.querySelector('button[type="submit"]');
    const file    = photoForm.querySelector('[name="photoFile"]').files[0];
    const url     = photoForm.querySelector('[name="photoUrl"]').value.trim();
    const caption = photoForm.querySelector('[name="caption"]').value.trim();
    const existingImage = editingPhotoItem ? editingPhotoItem.image||"" : "";
    if(!file && !url && !existingImage){alert("Upload a photo or paste an image URL.");return;}
    btn.disabled=true; btn.textContent="Saving…";
    try {
      const image  = file ? await compressImage(file, 900, 0.8) : url || existingImage;
      const action = editingPhotoId ? "update" : "add";
      renderPhotos(await callApi("photos", action, {image, caption}, editingPhotoId));
      photoForm.reset(); editingPhotoId=null; editingPhotoItem=null;
      photoForm.querySelector('button[type="submit"]').textContent="Add photo";
    } catch(err){alert(err.message);}
    finally{btn.disabled=false;}
  });
  document.getElementById("photoCancelEdit").addEventListener("click", () => {
    photoForm.reset(); editingPhotoId=null; editingPhotoItem=null;
    photoForm.querySelector('button[type="submit"]').textContent="Add photo";
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
          <button data-edit="${m.id}">Edit</button>
          <button class="danger" data-delete="${m.id}">Delete</button>
        </div>
      </div>`).join("");
    merchList.querySelectorAll(".reorder-btn").forEach(btn => btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.idx), toIdx = btn.dataset.dir==="up" ? idx-1 : idx+1;
      const nl = [...currentMerch]; const [mv]=nl.splice(idx,1); nl.splice(toIdx,0,mv);
      try { renderMerch(await callApi("merch","reorder",null,null,nl.map(i=>i.id))); } catch(err){alert(err.message);}
    }));
    merchList.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", () => {
      const m = currentMerch.find(x => x.id===btn.dataset.edit); if(!m) return;
      editingMerchId = m.id; editingMerchItem = m;
      merchForm.querySelector('[name="title"]').value     = m.title||"";
      merchForm.querySelector('[name="storeName"]').value = m.storeName||"";
      merchForm.querySelector('[name="storeUrl"]').value  = m.storeUrl||"";
      merchForm.querySelector('[name="imageUrl"]').value  = "";
      merchForm.querySelector('[name="imageFile"]').value = "";
      merchForm.querySelector('button[type="submit"]').textContent = "Update item";
      merchForm.scrollIntoView({behavior:"smooth",block:"center"});
    }));
    merchList.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", async () => {
      if(!confirm("Delete this merch item?")) return;
      try { renderMerch(await callApi("merch","delete",null,btn.dataset.delete)); } catch(err){alert(err.message);}
    }));
  }

  merchForm.addEventListener("submit", async e => {
    e.preventDefault();
    const btn       = merchForm.querySelector('button[type="submit"]');
    const title     = merchForm.querySelector('[name="title"]').value.trim();
    const storeName = merchForm.querySelector('[name="storeName"]').value.trim();
    const storeUrl  = merchForm.querySelector('[name="storeUrl"]').value.trim();
    const file      = merchForm.querySelector('[name="imageFile"]').files[0];
    const imageUrl  = merchForm.querySelector('[name="imageUrl"]').value.trim();
    const existingImage = editingMerchItem ? editingMerchItem.image||"" : "";
    if(!title||!storeName||!storeUrl){alert("Title, store name, and store link are required.");return;}
    if(!file && !imageUrl && !existingImage){alert("Add a design image or paste an image URL.");return;}
    btn.disabled=true; btn.textContent="Saving…";
    try {
      const image  = file ? await compressImage(file) : imageUrl || existingImage;
      const action = editingMerchId ? "update" : "add";
      renderMerch(await callApi("merch", action, {title, storeName, storeUrl, image}, editingMerchId));
      merchForm.reset(); editingMerchId=null; editingMerchItem=null;
      merchForm.querySelector('button[type="submit"]').textContent="Add item";
    } catch(err){alert(err.message);}
    finally{btn.disabled=false;}
  });
  document.getElementById("merchCancelEdit").addEventListener("click", () => {
    merchForm.reset(); editingMerchId=null; editingMerchItem=null;
    merchForm.querySelector('button[type="submit"]').textContent="Add item";
  });


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
