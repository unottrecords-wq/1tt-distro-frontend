// Initialize Supabase Client
const SUPABASE_URL = "https://hnlfqpscrgkxtwjtsqkj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhubGZxcHNjcmdreHR3anRzcWtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAzNjYwOTMsImV4cCI6MjA1NTk0MjA5M30.6iX0Psh2m3o3XqD-K-Zp4QG_Yd16X_4j0p5Uv9L7pM8";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
const authSection = document.getElementById("auth-section");
const dashboardSection = document.getElementById("dashboard-section");
const emailInput = document.getElementById("email-input");
const passwordInput = document.getElementById("password-input");
const signInBtn = document.getElementById("signin-btn");
const signUpBtn = document.getElementById("signup-btn");
const signOutBtn = document.getElementById("signout-btn");
const userEmailDisplay = document.getElementById("user-email-display");

const releaseForm = document.getElementById("release-form");
const coverInput = document.getElementById("cover-input");
const audioInput = document.getElementById("audio-input");
const releaseTitleInput = document.getElementById("release-title");
const releaseTypeSelect = document.getElementById("release-type");
const upcInput = document.getElementById("upc-input");
const isrcInput = document.getElementById("isrc-input");
const labelInput = document.getElementById("label-input");
const composerInput = document.getElementById("composer-input");
const pLineInput = document.getElementById("p-line-input");
const cLineInput = document.getElementById("c-line-input");
const uploadStatus = document.getElementById("upload-status");
const catalogList = document.getElementById("catalog-list");

// --- 1. AUTHENTICATION --- //

async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    showDashboard(session.user);
  } else {
    showAuth();
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      showDashboard(session.user);
    } else {
      showAuth();
    }
  });
}

signInBtn.addEventListener("click", async () => {
  const email = emailInput.value;
  const password = passwordInput.value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) alert("Sign In Failed: " + error.message);
});

signUpBtn.addEventListener("click", async () => {
  const email = emailInput.value;
  const password = passwordInput.value;
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: "https://1tt-distro.vercel.app/auth/callback" }
  });
  if (error) alert("Sign Up Failed: " + error.message);
  else alert("Check your email for confirmation link!");
});

signOutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
});

function showAuth() {
  authSection.classList.remove("hidden");
  dashboardSection.classList.add("hidden");
}

async function showDashboard(user) {
  authSection.classList.add("hidden");
  dashboardSection.classList.remove("hidden");
  userEmailDisplay.textContent = `Signed in as: ${user.email}`;

  // Get or Create Artist Profile
  let { data: artist } = await supabase
    .from("artists")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!artist) {
    const { data: newArtist, error } = await supabase
      .from("artists")
      .insert({ user_id: user.id, name: user.email.split("@")[0] })
      .select("id")
      .single();
    if (!error) artist = newArtist;
  }

  if (artist) {
    loadCatalog(user.id);
    subscribeToCatalogUpdates(artist.id);
  }
}

// --- 2. REALTIME LISTENER --- //

function subscribeToCatalogUpdates(artistId) {
  const channel = supabase
    .channel('public:releases')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'releases',
        filter: `artist_id=eq.${artistId}`
      },
      (payload) => {
        const updatedRelease = payload.new;
        if (uploadStatus) {
          uploadStatus.textContent = `⚡ Update: "${updatedRelease.title}" status changed to [${updatedRelease.status}]!`;
        }
        const { data: { user } } = supabase.auth.getUser();
        if (user) loadCatalog(user.id);
      }
    )
    .subscribe();

  return channel;
}

// --- 3. SUBMIT RELEASE (CREATE) --- //

releaseForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  uploadStatus.textContent = "Uploading files and creating submission...";

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated.");

    const { data: artist } = await supabase
      .from("artists")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!artist) throw new Error("Artist profile missing.");

    const coverFile = coverInput.files[0];
    const audioFile = audioInput.files[0];

    if (!coverFile || !audioFile) throw new Error("Please select both cover artwork and master audio file.");

    // Upload Cover Art
    const coverPath = `${artist.id}/${Date.now()}_${coverFile.name}`;
    const { error: coverErr } = await supabase.storage
      .from("cover-art")
      .upload(coverPath, coverFile);
    if (coverErr) throw coverErr;

    const { data: { publicUrl: coverUrl } } = supabase.storage
      .from("cover-art")
      .getPublicUrl(coverPath);

    // Upload Private Audio Master
    const audioPath = `${artist.id}/${Date.now()}_${audioFile.name}`;
    const { error: audioErr } = await supabase.storage
      .from("audio-masters")
      .upload(audioPath, audioFile);
    if (audioErr) throw audioErr;

    // Insert Release Row
    const { data: release, error: releaseErr } = await supabase
      .from("releases")
      .insert({
        artist_id: artist.id,
        title: releaseTitleInput.value,
        release_type: releaseTypeSelect.value,
        upc: upcInput.value || null,
        cover_art_url: coverUrl,
        status: "Draft",
        record_label: labelInput.value || "1TT RECORDS",
        p_line: pLineInput.value || "℗ 2026 1TT RECORDS",
        c_line: cLineInput.value || "© 2026 1TT PUBLISHING"
      })
      .select()
      .single();

    if (releaseErr) throw releaseErr;

    // Insert Track Row
    const { error: trackErr } = await supabase
      .from("tracks")
      .insert({
        release_id: release.id,
        title: releaseTitleInput.value,
        isrc: isrcInput.value || null,
        audio_file_url: audioPath,
        composer_legal_name: composerInput.value || "Abongile Gando"
      });

    if (trackErr) throw trackErr;

    uploadStatus.textContent = "✅ Release successfully submitted to 1TT DISTRO!";
    releaseForm.reset();
    loadCatalog(user.id);

  } catch (err) {
    uploadStatus.textContent = "❌ Error: " + err.message;
  }
});

// --- 4. CATALOG LOADER & PRIVATE AUDIO PREVIEW (READ) --- //

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
      .select(`*, tracks (*)`)
      .eq("artist_id", artist.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!releases || releases.length === 0) {
      catalogList.innerHTML = "<p>No releases submitted yet.</p>";
      return;
    }

    let htmlContent = "";

    for (const r of releases) {
      const track = r.tracks && r.tracks[0];
      let audioPreviewHtml = "";

      if (track && track.audio_file_url) {
        // Create 1-hour signed URL for private master playback
        const { data: signedData, error: signedErr } = await supabase.storage
          .from("audio-masters")
          .createSignedUrl(track.audio_file_url, 3600);

        if (!signedErr && signedData) {
          audioPreviewHtml = `
            <div class="audio-player-container">
              <label class="player-label">🎵 Master Preview: ${track.title}</label>
              <audio controls controlsList="nodownload" src="${signedData.signedUrl}"></audio>
            </div>
          `;
        }
      }

      htmlContent += `
        <div class="catalog-card">
          <div class="catalog-header">
            <img src="${r.cover_art_url}" class="catalog-thumb" alt="Cover" />
            <div class="catalog-info">
              <strong>${r.title}</strong> (${r.release_type})
              <br/><small>Status: <span class="badge status-${r.status.toLowerCase()}">${r.status}</span> | Label: ${r.record_label}</small>
            </div>
          </div>
          ${audioPreviewHtml}
        </div>
      `;
    }

    catalogList.innerHTML = htmlContent;

  } catch (err) {
    catalogList.innerHTML = "<p>Failed to load catalog: " + err.message + "</p>";
  }
}

// Start Auth Init on Load
initAuth();
