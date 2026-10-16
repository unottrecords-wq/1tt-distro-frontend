async function showDashboard(user) {
  authSection.classList.add("hidden");
  dashboardSection.classList.remove("hidden");
  userEmailDisplay.textContent = `Signed in as: ${user.email}`;

  // 1. Fetch artist record ID linked to user
  const { data: artist } = await supabase
    .from("artists")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (artist) {
    // 2. Load catalog list for UI
    loadCatalog(user.id);

    // 3. Trigger Realtime Listener on Sign-In
    subscribeToCatalogUpdates(artist.id);
  }
}
