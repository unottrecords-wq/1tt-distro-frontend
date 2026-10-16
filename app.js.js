// UPDATED CATALOG LOADER WITH PRIVATE AUDIO PREVIEW STREAMING
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

    // Fetch releases alongside linked track audio paths
    const { data: releases, error } = await supabase
      .from("releases")
      .select(`
        *,
        tracks (*)
      `)
      .eq("artist_id", artist.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!releases || releases.length === 0) {
      catalogList.innerHTML = "<p>No releases submitted yet.</p>";
      return;
    }

    // Render releases and generate signed preview URLs for master audio tracks
    let htmlContent = "";

    for (const r of releases) {
      const track = r.tracks && r.tracks[0];
      let audioPreviewHtml = "";

      if (track && track.audio_file_url) {
        // Generate a 1-hour secure signed URL for private audio streaming
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
              <br/><small>Status: <span class="badge">${r.status}</span> | Label: ${r.record_label}</small>
            </div>
          </div>
          ${audioPreviewHtml}
        </div>
      `;
    }

    catalogList.innerHTML = htmlContent;

  } catch (err) {
    catalogList.innerHTML = "Failed to load catalog: " + err.message;
  }
}
