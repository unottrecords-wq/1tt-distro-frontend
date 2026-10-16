const SUPABASE_URL = "https://hnlfqpscrgkxtwjtsqkj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhubGZxcHNjcmdreHR3anRzcWtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwOTQ0NDUsImV4cCI6MjEwNzY3MDQ0NX0.dlZDpZww9YQ0nvi9YjNiNENcF9y66t-WVGL2cY8IwnE";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const authSection = document.getElementById("auth-section");
const dashboardSection = document.getElementById("dashboard-section");
const authStatus = document.getElementById("auth-status");
const releaseForm = document.getElementById("release-form");
const uploadStatus = document.getElementById("upload-status");
const catalogList = document.getElementById("catalog-list");
const userEmailDisplay = document.getElementById("user-email-display");

window.addEventListener("DOMContentLoaded", async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    showDashboard(session.user);
  }
});

supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    showDashboard(session.user);
  } else {
    showAuth();
  }
});

function showDashboard(user) {
  authSection.classList.add("hidden");
  dashboardSection.classList.remove("hidden");
  userEmailDisplay.textContent = `Signed in as: ${user.email}`;
  loadCatalog(user.id);
}

function showAuth() {
  authSection.classList.remove("hidden");
  dashboardSection.classList.add("hidden");
}

// LOGIN & SIGNUP
document.getElementById("login-btn").addEventListener("click", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  authStatus.textContent = "Logging in...";
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) authStatus.textContent = "Error: " + error.message;
});

document.getElementById("signup-btn").addEventListener("click", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  authStatus.textContent = "Creating artist account...";
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: "https://1tt-distro.vercel.app/auth/callback" }
  });
  if (error) authStatus.textContent = "Error: " + error.message;
  else authStatus.textContent = "Check email for confirmation link!";
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await supabase.auth.signOut();
});

// FETCH CATALOG RELEASES
async function loadCatalog(userId) {
  try {
    const { data: artist } = await supabase
      .from("artists")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!artist) {
      catalogList.innerHTML = "<p>No artist profile found.</p>";
      return;
    }

    const { data: releases, error } = await supabase
      .from("releases")
      .select("*")
      .eq("artist_id", artist.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!releases || releases.length === 0) {
      catalogList.innerHTML = "<p>No releases submitted yet.</p>";
      return;
    }

    catalogList.innerHTML = releases.map(r => `
      <div class="catalog-item">
        <img src="${r.cover_art_url}" class="catalog-thumb" alt="Cover" />
        <div class="catalog-info">
          <strong>${r.title}</strong> (${r.release_type})
          <br/><small>Status: <span class="badge">${r.status}</span> | Label: ${r.record_label}</small>
        </div>
      </div>
    `).join("");

  } catch (err) {
    catalogList.innerHTML = "Failed to load catalog: " + err.message;
  }
}

// SUBMIT NEW RELEASE & MASTER AUDIO
releaseForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  uploadStatus.textContent = "Uploading artwork and audio master...";

  const releaseTitle = document.getElementById("release-title").value;
  const releaseType = document.getElementById("release-type").value;
  const upc = document.getElementById("release-upc").value || null;
  const coverFile = document.getElementById("cover-art-file").files[0];

  const trackTitle = document.getElementById("track-title").value;
  const isrc = document.getElementById("track-isrc").value || null;
  const composerName = document.getElementById("composer-name").value;
  const audioFile = document.getElementById("audio-file").files[0];

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: artist } = await supabase
      .from("artists")
      .select("id")
      .eq("user_id", user.id)
      .single();

    // 1. Upload Cover Art
    const coverPath = `${artist.id}/${Date.now()}_${coverFile.name}`;
    const { error: coverErr } = await supabase.storage
      .from("cover-art")
      .upload(coverPath, coverFile);
    if (coverErr) throw coverErr;

    const { data: { publicUrl: coverUrl } } = supabase.storage
      .from("cover-art")
      .getPublicUrl(coverPath);

    // 2. Upload WAV Master
    const audioPath = `${artist.id}/${Date.now()}_${audioFile.name}`;
    const { error: audioErr } = await supabase.storage
      .from("audio-masters")
      .upload(audioPath, audioFile);
    if (audioErr) throw audioErr;

    // 3. Create Release Row
    const { data: release, error: relErr } = await supabase
      .from("releases")
      .insert({
        artist_id: artist.id,
        title: releaseTitle,
        release_type: releaseType,
        upc: upc,
        cover_art_url: coverUrl,
        status: "Draft",
        record_label: "1TT RECORDS",
        p_line: "℗ 2026 1TT RECORDS",
        c_line: "© 2026 1TT PUBLISHING"
      })
      .select()
      .single();
    if (relErr) throw relErr;

    // 4. Create Track Row
    const { error: trackErr } = await supabase
      .from("tracks")
      .insert({
        release_id: release.id,
        track_number: 1,
        title: trackTitle,
        isrc: isrc,
        composer_legal_name: composerName,
        audio_file_url: audioPath
      });
    if (trackErr) throw trackErr;

    uploadStatus.textContent = `🎉 "${releaseTitle}" submitted successfully with audio master!`;
    releaseForm.reset();
    loadCatalog(user.id);

  } catch (err) {
    uploadStatus.textContent = "Error: " + err.message;
  }
});
