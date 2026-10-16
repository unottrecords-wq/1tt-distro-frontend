// 1. LISTEN TO AUTH STATE CHANGES
supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    // User is signed in — Show dashboard & load catalog
    showDashboard(session.user);
  } else {
    // User is signed out — Show sign-in interface
    showAuth();
  }
});

// 2. TOGGLE SIGNUP VS LOGIN FIELDS
const toggleSignupBtn = document.getElementById("toggle-signup-btn");
const signupFields = document.getElementById("signup-extra-fields");
let isSignUpMode = false;

toggleSignupBtn.addEventListener("click", () => {
  isSignUpMode = !isSignUpMode;
  if (isSignUpMode) {
    signupFields.classList.remove("hidden");
    document.getElementById("login-btn").textContent = "Create Account";
    toggleSignupBtn.textContent = "Back to Login";
  } else {
    signupFields.classList.add("hidden");
    document.getElementById("login-btn").textContent = "Log In";
    toggleSignupBtn.textContent = "Register New Artist";
  }
});

// 3. HANDLE LOGIN & SIGNUP SUBMISSION
document.getElementById("auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if (isSignUpMode) {
    const artistName = document.getElementById("artist-name").value;
    const legalName = document.getElementById("legal-name").value;

    authStatus.textContent = "Creating artist account...";

    // Pass artist metadata directly into user sign-up
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: "https://1tt-distro.vercel.app/auth/callback",
        data: {
          artist_name: artistName,
          legal_name: legalName
        }
      }
    });

    if (error) {
      authStatus.textContent = "Sign up error: " + error.message;
    } else {
      authStatus.textContent = "🎉 Account created! Please check your email to confirm registration.";
    }

  } else {
    authStatus.textContent = "Logging in...";
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      authStatus.textContent = "Login error: " + error.message;
    } else {
      authStatus.textContent = "Success! Redirecting...";
    }
  }
});

// 4. LOGOUT HANDLER
document.getElementById("logout-btn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  showAuth();
});
