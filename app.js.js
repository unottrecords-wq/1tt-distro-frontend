// 1. INITIALIZE SUPABASE CLIENT (Pre-configured for 1TT DISTRO)
const SUPABASE_URL = "https://hnlfqpscrgkxtwjtsqkj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhubGZxcHNjcmdreHR3anRzcWtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwOTQ0NDUsImV4cCI6MjEwNzY3MDQ0NX0.dlZDpZww9YQ0nvi9YjNiNENcF9y66t-WVGL2cY8IwnE";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM ELEMENTS
const authSection = document.getElementById("auth-section");
const dashboardSection = document.getElementById("dashboard-section");
const authForm = document.getElementById("auth-form");
const authStatus = document.getElementById("auth-status");
const releaseForm = document.getElementById("release-form");
const uploadStatus = document.getElementById("upload-status");

// 2. CHECK SESSION STATUS ON LOAD
window.addEventListener("DOMContentLoaded", async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    showDashboard();
  }
});

// LISTEN FOR AUTH STATE CHANGES
supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    showDashboard();
  } else {
    showAuth();
  }
});

function showDashboard() {
  authSection.classList.add("hidden");
  dashboardSection.classList.remove("hidden");
}

function showAuth() {
  authSection.classList.remove("hidden");
  dashboardSection.classList.add("hidden");
}

// 3. USER LOGIN & SIGNUP HANDLERS
document.getElementById("login-btn").addEventListener("click", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  authStatus.textContent = "Logging in...";
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  
  if (error) {
    authStatus.textContent = "Error: " + error.message;
  } else {
    authStatus.textContent = "Success!";
  }
});

document.getElementById("signup-btn").addEventListener("click", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  authStatus.textContent = "Creating artist account...";
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: "https://1tt-distro.vercel.app/auth/callback"
    }
  });

  if (error) {
    authStatus.textContent = "Error: " + error.message;
  } else {
    authStatus.textContent = "Account created! Please check your email to confirm registration.";
  }
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await supabase.auth.signOut();
});

// 4. CREATE RELEASE & UPLOAD COVER ARTWORK TO BUCKET
releaseForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  uploadStatus.textContent = "Processing submission...";

  const title = document.getElementById("title").value;
  const releaseType = document.getElementById("release_type").value;
  const upc = document.getElementById("upc").value || null;
  const fileInput = document.getElementById("cover_art");
  const coverFile = fileInput.files[0];

  try {
    // A. Get authenticated user & matching artist profile
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: artist, error: artistErr } = await supabase
      .from("artists")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (artistErr || !artist) throw new Error("Artist profile not found.");

    // B. Upload Artwork to `cover-art` Bucket
    const fileExt = coverFile.name.split('.').pop();
    const filePath = `${artist.id}/${Date.now()}.${fileExt}`;

    const { error: uploadErr } = await supabase.storage
      .from("cover-art")
      .upload(filePath, coverFile);

    if (uploadErr) throw uploadErr;

    // C. Get Public URL for Cover Artwork
    const { data: { publicUrl } } = supabase.storage
      .from("cover-art")
      .getPublicUrl(filePath);

    // D. Insert Release Record into Database
    const { data: newRelease, error: releaseErr } = await supabase
      .from("releases")
      .insert({
        artist_id: artist.id,
        title: title,
        release_type: releaseType,
        upc: upc,
        cover_art_url: publicUrl,
        status: "Draft",
        record_label: "1TT RECORDS",
        p_line: "℗ 2026 1TT RECORDS",
        c_line: "© 2026 1TT PUBLISHING"
      })
      .select()
      .single();

    if (releaseErr) throw releaseErr;

    uploadStatus.textContent = `🎉 Release "${newRelease.title}" successfully created with cover artwork!`;
    releaseForm.reset();

  } catch (err) {
    uploadStatus.textContent = "Submission failed: " + err.message;
  }
});