// Recommender Hub4U — Final Script (AniList + TMDB + Local Data)
const app = document.getElementById("app");
const loader = document.getElementById("loader");
const moodWrap = document.getElementById("moodWrap");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const filePrompt = document.getElementById("filePrompt");
const fileInput = document.getElementById("fileInput");
const typeSelect = document.getElementById("typeSelect");
const sortSelect = document.getElementById("sortSelect");

let db = { animes: [], movies: [], webseries: [] };

// ---------- Load Data ----------
window.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch("./data.json", { cache: "no-store" });
    if (!res.ok) throw new Error("no data.json");
    const raw = await res.json();
    initData(raw);
  } catch {
    loader.style.display = "none";
    app.style.display = "block";
    filePrompt.classList.remove("hidden");
    fileInput.addEventListener("change", handleFile);
  }
});

function handleFile(e) {
  const f = e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const raw = JSON.parse(ev.target.result);
    initData(raw);
  };
  reader.readAsText(f);
}

function initData(raw) {
  loader.style.display = "none";
  app.style.display = "block";
  db.animes = raw.animes || raw.anime || raw.Anime || [];
  db.movies = raw.movies || raw.movie || raw.Movies || raw.Movie || [];
  db.webseries = raw.webseries || raw.series || raw.Series || raw.Webseries || raw.WebSeries || [];

  buildMoods();
}

// ---------- Utilities ----------
function allItems() {
  const m = (arr, t) => (arr || []).map((x) => ({ ...x, type: t }));
  return [
    ...m(db.animes, "Anime"),
    ...m(db.movies, "Movie"),
    ...m(db.webseries, "Web Series"),
  ];
}

// ---------- Mood Buttons ----------
function buildMoods() {
  const set = new Set();
  allItems().forEach((it) => {
    if (Array.isArray(it.moods)) it.moods.forEach((m) => set.add(m.trim()));
    else if (typeof it.moods === "string")
      it.moods.split(",").map((s) => s.trim()).forEach((m) => set.add(m));
  });
  moodWrap.innerHTML = "";
  Array.from(set)
    .sort()
    .forEach((m) => {
      const btn = document.createElement("button");
      btn.className = "mood-btn";
      btn.textContent = m;
      btn.onclick = () => openRecommendations(m);
      moodWrap.appendChild(btn);
    });
}

// ---------- Search & Filters ----------
searchBtn.addEventListener("click", () => {
  const q = searchInput.value.trim();
  if (q) openRecommendations(q);
});
searchInput.addEventListener("keydown", (e) => e.key === "Enter" && searchBtn.click());

function openRecommendations(query) {
  const selectedType = typeSelect.value;
  const sortMode = sortSelect.value;

  const items = allItems().filter((it) => {
    if (selectedType !== "all" && it.type !== selectedType) return false;
    const text = `${it.title || ""} ${it.Description || ""} ${(it.moods || []).join(" ")}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });

  if (sortMode === "rating")
    items.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  else items.sort((a, b) => (a.title || "").localeCompare(b.title || ""));

  const html = buildResultPage(query, items);
  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
}

// ---------- Build Result Page ----------
function buildResultPage(query, items) {
  const css = `
  body{font-family:Inter,system-ui,Arial;background:#060b14;color:#fff;padding:20px;margin:0;}
  h1{margin:0 0 16px;}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px;}
  .card{background:rgba(255,255,255,0.05);backdrop-filter:blur(10px);border-radius:12px;display:flex;gap:12px;padding:12px;align-items:flex-start;}
  .poster{width:110px;height:160px;object-fit:cover;border-radius:8px;}
  .meta{flex:1;}
  .title{font-size:17px;margin:0;}
  .sub{color:#9fb6c8;font-size:13px;}
  .desc{color:#d6e6f4;font-size:14px;margin-top:6px;}
  `;

  const script = `
  const items = ${JSON.stringify(items)};
  async function fetchImage(title, type){
    const cacheKey = "poster::"+title;
    const cached = localStorage.getItem(cacheKey);
    if(cached) return cached;

    let img = null;
    try {
      if(type === "Anime"){
        // AniList API
        const q = \`query{Media(search:"\${title}",type:ANIME){coverImage{large}}}\`;
        const r = await fetch("https://graphql.anilist.co", {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ query: q })
        });
        const j = await r.json();
        img = j.data?.Media?.coverImage?.large || null;
      } else {
        // TMDB API
        const tmdb = await fetch("https://api.themoviedb.org/3/search/multi?api_key=5d0d2b86dfd346a03f17a64d1fbc27c3&query="+encodeURIComponent(title));
        const j = await tmdb.json();
        if(j.results && j.results[0] && j.results[0].poster_path)
          img = "https://image.tmdb.org/t/p/w500" + j.results[0].poster_path;
      }
    } catch(e){}

    if(!img) img = placeholder(title,type);
    localStorage.setItem(cacheKey, img);
    return img;
  }

  function placeholder(title,type){
    const color=["#7c3aed","#06b6d4","#f59e0b","#ef4444"][title.length%4];
    return "data:image/svg+xml;utf8,"+encodeURIComponent(
      \`<svg xmlns='http://www.w3.org/2000/svg' width='300' height='450'>
        <rect width='100%' height='100%' rx='16' fill='\${color}'/>
        <text x='20' y='230' fill='white' font-size='22' font-family='Arial'>\${title}</text>
        <text x='20' y='260' fill='white' font-size='14'>\${type}</text>
      </svg>\`
    );
  }

  async function render(){
    const grid = document.getElementById("grid");
    for(const it of items){
      const div = document.createElement("div");
      div.className = "card";
      const title = it.title || "Untitled";
      const type = it.type || "";
      const desc = it.Description || "";
      const rating = it.rating || "N/A";
      const img = await fetchImage(title,type);
      div.innerHTML = \`
        <img class='poster' src="\${img}"/>
        <div class='meta'>
          <h3 class='title'>\${title}</h3>
          <div class='sub'>\${type} • ⭐\${rating}</div>
          <p class='desc'>\${desc.slice(0,200)}...</p>
        </div>\`;
      grid.appendChild(div);
    }
  }

  render();
  `;

  return `
  <!doctype html>
  <html><head>
    <meta charset="utf-8">
    <title>${query}</title>
    <style>${css}</style>
  </head>
  <body>
    <h1>${query} Recommendations (${items.length})</h1>
    <div id="grid" class="grid"></div>
    <script>${script}</script>
  </body></html>`;
}
