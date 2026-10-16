// REALTIME LISTENER FOR RELEASE STATUS UPDATES
function subscribeToCatalogUpdates(artistId) {
  const channel = supabase
    .channel('public:releases')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',             // Listen specifically for status/metadata updates
        schema: 'public',
        table: 'releases',
        filter: `artist_id=eq.${artistId}` // Only listen to changes for this specific artist
      },
      (payload) => {
        console.log('Realtime update received:', payload);
        
        // Notify artist and refresh their live catalog list instantly
        const updatedRelease = payload.new;
        uploadStatus.textContent = `⚡ Update: "${updatedRelease.title}" status changed to [${updatedRelease.status}]!`;
        
        // Reload catalog UI automatically
        const { data: { user } } = supabase.auth.getUser();
        if (user) loadCatalog(user.id);
      }
    )
    .subscribe();

  return channel;
}
