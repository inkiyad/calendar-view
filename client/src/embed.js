// Generates embeddable HTML code for the calendar
export function getEmbedCode(options = {}) {
  const { darkMode = false, hostUrl = window.location.origin } = options;
  
  // Construct URL with parameters
  const params = new URLSearchParams();
  params.set('embed', 'true');
  if (darkMode) params.set('theme', 'dark');
  
  const embedUrl = `${hostUrl}/?${params.toString()}`;
  
  // Responsive iframe with aspect ratio preservation
  return `<!-- Calendar View Embed Code -->
<div style="position: relative; width: 100%; max-width: 1200px; margin: 0 auto;">
  <iframe 
    src="${embedUrl}" 
    style="width: 100%; height: 700px; border: none; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" 
    title="Events Calendar"
    loading="lazy">
  </iframe>
</div>

<!-- For dark mode, use: ${hostUrl}/?embed=true&theme=dark -->`;
}
