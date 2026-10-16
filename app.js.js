// ==========================================
// 1TT DISTRO — MAIN APPLICATION LOGIC
// ==========================================

// Initialize Supabase Client
const SUPABASE_URL = "https://hnlfqpscrgkxtwjtsqkj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhubGZxcHNjcmdreHR3anRzcWtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAwMDAwMDB9"; 

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
const authSection = document.getElementById("auth-section");
const dashboardSection = document.getElementById("dashboard-section");
const emailInput = document.getElementById("email-input");
const passwordInput = document.getElementById("password-input");
const signinBtn = document.getElementById("signin-btn");
const signupBtn = document.getElementById("signup-btn");
const signoutBtn = document.getElementById("signout-btn");
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

// ==========================================
// 1. AUTHENTICATION & SESSION MANAGEMENT
// ==========================================

async function initAuth() {
  const { data: { session }, error } = await supabase.auth.getSession();
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

function showAuth() {
  if (authSection) authSection.classList.remove("hidden");
  if (dashboardSection) dashboardSection.classList.add("hidden");
  if (userEmailDisplay) userEmailDisplay.textContent = "";
}

async function showDashboard(user) {
  if (authSection) authSection.classList.add("hidden");
  if (dashboardSection) dashboardSection.classList.remove("hidden");
  if (userEmailDisplay) userEmailDisplay.textContent = `Signed in as ${user.email}`;

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
    loadCatalog(user.id, artist.id);
    subscribeToCatalogUpdates(artist.id);
  }
}

// Sign In Event
if (signinBtn) {
  signinBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
      alert("Please enter both email and password.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert("Sign-in failed: " + error.message);
    }
  });
}

// Sign Up Event
if (signupBtn) {
  signupBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
      alert("Please enter both email and password to sign up.");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: "https://1tt-distro.vercel.app/auth/callback" }
    });

    if (error) {
      alert("Sign-up failed: " + error.message);
    } else {
      alert("Account created successfully! Check your email for confirmation if required.");
    }
  });
}

// Sign Out Event
if (signoutBtn) {
  signoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    showAuth();
  });
}

// ==========================================
// 2. REALTIME LISTENER
// ==========================================

function subscribeToCatalogUpdates(artistId) {
  return supabase
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
          uploadStatus.style.color = "#58a6ff";
        }
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) loadCatalog(user.id, artistId);
        });
      }
    )
    .subscribe();
}

// ==========================================
// 3. RELEASE SUBMISSION WORKFLOW
// ==========================================

if (releaseForm) {
  releaseForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (uploadStatus) {
      uploadStatus.textContent = "Uploading assets and submitting release...";
      uploadStatus.style.color = "#58a6ff";
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No active user session found.");

      const { data: artist } = await supabase
        .from("artists")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!artist) throw new Error("Artist profile missing.");

      const coverFile = coverInput.files[0];
      const audioFile = audioInput.files[0];

      if (!coverFile || !audioFile) {
        throw new Error("Please select both cover artwork and master audio files.");
      }

      // 1. Upload Cover Art
      const coverPath = `${artist.id}/${Date.now()}_${coverFile.name}`;
      const { error: coverErr } = await supabase.storage
        .from("cover-art")
        .upload(coverPath, coverFile);
      if (coverErr) throw coverErr;

      const { data: { publicUrl: coverUrl } } = supabase.storage
        .from("cover-art")
        .getPublicUrl(coverPath);

      // 2. Upload Private Audio Master
      const audioPath = `${artist.id}/${Date.now()}_${audioFile.name}`;
      const { error: audioErr } = await supabase.storage
        .from("audio-masters")
        .upload(audioPath, audioFile);
      if (audioErr) throw audioErr;

      // 3. Insert Release Row
      const upc = upcInput.value.trim() || generateRandomCode("UPC");
      const { data: release, error: releaseErr } = await supabase
        .from("releases")
        .insert({
          artist_id: artist.id,
          title: releaseTitleInput.value.trim(),
          release_type: releaseTypeSelect.value,
          upc: upc,
          cover_art_url: coverUrl,
          status: "Draft",
          label_name: labelInput.value.trim() || "1TT RECORDS",
          composer_name: composerInput.value.trim() || "Abongile Gando",
          p_line: pLineInput.value.trim() || "℗ 2026 1TT RECORDS",
          c_line: cLineInput.value.trim() || "© 2026 1TT PUBLISHING"
        })
        .select()
        .single();

      if (releaseErr) throw releaseErr;

      // 4. Insert Track Row
      const isrc = isrcInput.value.trim() || generateRandomCode("ISRC");
      const { error: trackErr } = await supabase
        .from("tracks")
        .insert({
          release_id: release.id,
          title: releaseTitleInput.value.trim(),
          isrc: isrc,
          audio_file_path: audioPath,
          composer: composerInput.value.trim() || "Abongile Gando"
        });

      if (trackErr) throw trackErr;

      if (uploadStatus) {
        uploadStatus.textContent = "✅ Release successfully submitted to 1TT DISTRO!";
        uploadStatus.style.color = "#3fb950";
      }
      releaseForm.reset();
      loadCatalog(user.id, artist.id);

    } catch (err) {
      console.error(err);
      if (uploadStatus) {
        uploadStatus.textContent = "❌ Error: " + err.message;
        uploadStatus.style.color = "#f85149";
      }
    }
  });
}

// ==========================================
// 4. CATALOG LOADER & PRIVATE AUDIO PREVIEW
// ==========================================

async function loadCatalog(userId, artistId) {
  if (!catalogList) return;

  catalogList.innerHTML = `<p class="loading-text">Loading catalog...</p>`;

  try {
    const { data: releases, error } = await supabase
      .from("releases")
      .select("*, tracks(*)")
      .eq("artist_id", artistId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!releases || releases.length === 0) {
      catalogList.innerHTML = `<p class="empty-text">No releases found. Submit your first project above!</p>`;
      return;
    }

    catalogList.innerHTML = "";

    for (const release of releases) {
      const card = document.createElement("div");
      card.className = "release-card";

      let audioPlayerHtml = `<p class="no-audio">No audio preview available</p>`;
      const track = release.tracks && release.tracks[0];

      if (track && track.audio_file_path) {
        const { data: signedData, error: signedErr } = await supabase.storage
          .from("audio-masters")
          .createSignedUrl(track.audio_file_path, 3600);

        if (!signedErr && signedData && signedData.signedUrl) {
          audioPlayerHtml = `
            <audio controls controlsList="nodownload" class="audio-player">
              <source src="${signedData.signedUrl}" type="audio/mpeg">
              Your browser does not support the audio element.
            </audio>
          `;
        }
      }

      card.innerHTML = `
        <div class="card-header" style="display: flex; gap: 15px; align-items: center; margin-bottom: 12px;">
          <img src="${release.cover_art_url || 'https://via.placeholder.com/150'}" alt="Cover Art" class="catalog-cover" style="width: 80px; height: 80px; object-fit: cover; border-radius: 6px;" />
          <div class="card-meta">
            <h4 style="margin: 0 0 5px 0;">${release.title}</h4>
            <p class="release-type" style="margin: 0 0 5px 0;">${release.release_type} • <span class="status-badge ${release.status.toLowerCase()}">${release.status}</span></p>
            <p class="small-text" style="margin: 0; font-size: 12px; color: #8b949e;">UPC: ${release.upc || 'N/A'} | Label: ${release.label_name || '1TT RECORDS'}</p>
          </div>
        </div>
        <div class="card-player">
          ${audioPlayerHtml}
        </div>
      `;

      catalogList.appendChild(card);
    }

  } catch (err) {
    console.error(err);
    catalogList.innerHTML = `<p class="error-text">Failed to load catalog: ${err.message}</p>`;
  }
}

function generateRandomCode(prefix) {
  const randomNum = Math.floor(100000000 + Math.random() * 900000000);
  return `${prefix}-2026-${randomNum}`;
}

// Initialize Auth on Load
initAuth();
