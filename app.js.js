const SUPABASE_URL = "https://hnlfqpscrgkxtwjtsqkj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhubGZxcHNjcmdreHR3anRzcWtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwOTQ0NDUsImV4cCI6MjEwNzY3MDQ0NX0.dlZDpZww9YQ0nvi9YjNiNENcF9y66t-WVGL2cY8IwnE";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM ELEMENTS
const authSection = document.getElementById("auth-section");
const dashboardSection = document.getElementById("dashboard-section");
const authForm = document.getElementById("auth-form");
const authStatus = document.getElementById("auth-status");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("login-btn");
const signupBtn = document.getElementById("signup-btn");
const logoutBtn = document.getElementById("logout-btn");
const userEmailDisplay = document.getElementById("user-email-display");

// 2. CHECK SESSION & LISTEN FOR AUTH CHANGES
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
  if (authSection) authSection.classList.add("hidden");
  if (dashboardSection) dashboardSection.classList.remove("hidden");
  if (userEmailDisplay) userEmailDisplay.textContent = `Signed in as: ${user.email}`;
}

function showAuth() {
  if (authSection) authSection.classList.remove("hidden");
  if (dashboardSection) dashboardSection.classList.add("hidden");
}

// 3. LOG IN LOGIC
loginBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    authStatus.textContent = "Please provide both email and password.";
    return;
  }

  authStatus.textContent = "Logging in...";

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (error) {
    authStatus.textContent = "Login failed: " + error.message;
  } else {
    authStatus.textContent = "Logged in successfully!";
  }
});

// 4. SIGN UP LOGIC
signupBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    authStatus.textContent = "Please enter an email and password to register.";
    return;
  }

  authStatus.textContent = "Creating artist account...";

  const { data, error } = await supabase.auth.signUp({
    email: email,
    password: password,
    options: {
      emailRedirectTo: "https://1tt-distro.vercel.app/auth/callback"
    }
  });

  if (error) {
    authStatus.textContent = "Registration failed: " + error.message;
  } else {
    authStatus.textContent = "🎉 Account created! Please check your email inbox to confirm registration.";
  }
});

// 5. SIGN OUT LOGIC
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    showAuth();
  });
