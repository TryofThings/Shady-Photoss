// Pexels API Key
const API_KEY = 'gA503AsEZJORFqlTLCrSSj3HXq7n6V5yFo0IZq1nviq4sc1CDfZ4ELCx'; // Replace with your actual Pexels API key

// Global state variables
let currentPage = 1;
let currentQuery = 'trending';
let currentMediaType = 'photo';
let isFetching = false;
let previousFocusElement = null; // For accessibility: track element that opened lightbox

// DOM Element References
const gallery = document.getElementById('gallery');
const favorites = document.getElementById('favorites');
const lightbox = document.getElementById('lightbox');
const lightboxContent = document.getElementById('lightboxContent');
const searchInput = document.getElementById('searchInput');
const typeSelect = document.getElementById('typeSelect');
const searchButton = document.getElementById('searchButton');
const autoplayToggle = document.getElementById('autoplayToggle');
const compactViewToggle = document.getElementById('compactViewToggle');
const darkModeToggle = document.getElementById('darkModeToggle');
const backToTopButton = document.querySelector('.back-to-top');

// --- Utility Functions ---

/**
 * Displays a toast notification.
 * @param {string} msg - The message to display.
 * @param {'success' | 'error' | 'info'} type - Type of toast (influences color).
 */
function showToast(msg, type = 'success') {
  let backgroundColor = '#333';
  if (type === 'error') backgroundColor = '#d32f2f';
  if (type === 'info') backgroundColor = '#2196f3';

  Toastify({
    text: msg,
    duration: 2500, // Slightly longer duration
    gravity: 'bottom',
    position: 'right', // Can be 'left', 'center', 'right'
    backgroundColor: backgroundColor,
    stopOnFocus: true, // Dismiss toast on focus
  }).showToast();
}

/** Toggles dark mode and saves preference. */
function toggleDarkMode() {
  document.body.classList.toggle('dark');
  const isDarkMode = document.body.classList.contains('dark');
  localStorage.setItem('darkMode', isDarkMode);
  // Update button text/icon for better feedback if desired
  darkModeToggle.textContent = isDarkMode ? '☀️' : '🌙';
  showToast(`Dark mode ${isDarkMode ? 'enabled' : 'disabled'}`, 'info');
}

/** Shows the main gallery and hides favorites. */
function showHome() {
  gallery.style.display = 'grid';
  favorites.style.display = 'none';
  // Ensure we are fetching if home is clicked and gallery is empty
  if (gallery.children.length === 0 && !isFetching) {
      searchMedia(true);
  }
}

/** Shows the favorites gallery and hides main gallery. */
function showFavorites() {
  gallery.style.display = 'none';
  favorites.style.display = 'grid';
  displayFavorites();
}

/**
 * Opens the lightbox with specified content.
 * @param {string} contentHtml - HTML string for the lightbox content (e.g., img or video tag).
 */
function openLightbox(contentHtml) {
  previousFocusElement = document.activeElement; // Save currently focused element
  lightboxContent.innerHTML = contentHtml;
  lightbox.style.display = 'flex';
  lightbox.focus(); // Move focus to lightbox for keyboard navigation
}

/** Closes the lightbox. */
function closeLightbox() {
  lightbox.style.display = 'none';
  lightboxContent.innerHTML = ''; // Clear content
  if (previousFocusElement) {
    previousFocusElement.focus(); // Return focus to the element that opened it
  }
}

/** Scrolls the page to the top. */
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/** Toggles compact view and saves preference. */
function toggleCompact() {
  document.body.classList.toggle('compact');
  localStorage.setItem('compactView', compactViewToggle.checked);
  showToast(`Compact view ${compactViewToggle.checked ? 'enabled' : 'disabled'}`, 'info');
}

/** Resets all saved favorites and refreshes the display. */
function resetFavorites() {
  localStorage.removeItem('pexelsFavorites');
  showToast('Favorites reset successfully.', 'info');
  displayFavorites(); // Refresh favorites display
}

/**
 * Increments the view count for a specific media item.
 * @param {string} src - The source URL of the media.
 * @returns {number} The updated view count.
 */
function incrementViews(src) {
  const views = JSON.parse(localStorage.getItem('pexelsViews')) || {};
  views[src] = (views[src] || 0) + 1;
  localStorage.setItem('pexelsViews', JSON.stringify(views));
  return views[src];
}

/**
 * Saves a media item to favorites.
 * @param {string} src - The source URL of the media.
 * @param {string} photographer - The name of the photographer/artist.
 * @param {'photo' | 'video'} type - The type of media.
 * @param {string} alt - The alt text for the media.
 */
function saveFavorite(src, photographer, type, alt = '') {
  let favs = JSON.parse(localStorage.getItem('pexelsFavorites')) || [];
  // Check for duplicates before adding
  if (!favs.some(fav => fav.src === src)) {
    favs.push({ src, photographer, type, alt });
    localStorage.setItem('pexelsFavorites', JSON.stringify(favs));
    showToast('Saved to favorites!');
  } else {
    showToast('This item is already in your favorites.', 'info');
  }
}

/**
 * Deletes a favorite item by its index.
 * @param {number} index - The index of the item to delete in the favorites array.
 */
function deleteFavorite(index) {
  let favs = JSON.parse(localStorage.getItem('pexelsFavorites')) || [];
  if (index > -1 && index < favs.length) {
    favs.splice(index, 1);
    localStorage.setItem('pexelsFavorites', JSON.stringify(favs));
    showToast('Deleted from favorites.');
    displayFavorites(); // Refresh favorites display
  }
}

/**
 * Performs a quick search using a predefined tag.
 * @param {string} tag - The tag to search for.
 */
function quickSearch(tag) {
  searchInput.value = tag;
  searchMedia();
}

/** Placeholder for autocomplete logic (not implemented with Pexels API). */
function autocompleteSearch() {
  // Pexels API doesn't offer a direct "autocomplete" or "trending terms" endpoint.
  // For a real-world scenario, you might have a custom backend or a limited
  // hardcoded list for suggestions. This function currently does nothing,
  // but the event listener is present if functionality is added later.
}

// --- Search & Display Functions ---

/**
 * Displays skeleton loaders in the gallery.
 * @param {number} count - The number of skeletons to display.
 */
function showSkeletons(count) {
  gallery.innerHTML = Array(count).fill('<div class="item skeleton"></div>').join('');
}

/**
 * Fetches media from Pexels API and displays it.
 * @param {boolean} [reset=true] - If true, clears existing gallery content and resets page.
 */
async function searchMedia(reset = true) {
  if (isFetching) return; // Prevent concurrent fetches

  const newQuery = searchInput.value.trim();
  const newMediaType = typeSelect.value;

  if (reset) {
    gallery.innerHTML = ''; // Clear existing items for a new search
    currentPage = 1;
    currentQuery = newQuery || 'trending'; // Default to 'trending' if search input is empty
    currentMediaType = newMediaType;
    showSkeletons(15); // Show initial skeletons for better UX
  } else {
    // For infinite scroll, ensure we are continuing the same search
    if (newQuery !== currentQuery || newMediaType !== currentMediaType) {
        // If search parameters changed mid-scroll, do nothing or reset if user intends a new search
        // For simplicity, we'll just not fetch more for the old parameters.
        return;
    }
  }

  const endpoint = currentMediaType === 'photo' ? 'https://api.pexels.com/v1/search' : 'https://api.pexels.com/videos/search';
  const fetchUrl = `${endpoint}?query=${encodeURIComponent(currentQuery)}&per_page=15&page=${currentPage}`;

  isFetching = true;
  searchButton.textContent = 'Searching...';
  searchButton.disabled = true;

  try {
    const response = await fetch(fetchUrl, {
      headers: { Authorization: API_KEY }
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('API rate limit exceeded. Please try again in a minute.');
      }
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();

    if (reset) {
      gallery.innerHTML = ''; // Clear skeletons after successful fetch for a new search
    }

    const items = currentMediaType === 'photo' ? data.photos : data.videos;

    if (items.length === 0 && reset) {
      gallery.innerHTML = '<p class="no-results">No results found for your search.</p>';
      showToast('No results found for your search.', 'info');
      return; // Stop here if no results
    } else if (items.length === 0 && !reset) {
      showToast('No more results to load.', 'info');
      return; // No more items on scroll
    }

    items.forEach(item => {
      let src, altText, photographer;
      if (currentMediaType === 'photo') {
        src = item.src.large;
        photographer = item.photographer;
        altText = item.alt || `Photo by ${photographer}`;
      } else { // Video
        // Prefer medium/sd/hd quality, fallback to first available if others not present
        const videoFile = item.video_files.find(file => file.quality === 'medium' || file.quality === 'sd' || file.quality === 'hd') || item.video_files[0];
        src = videoFile ? videoFile.link : null;
        photographer = item.user.name;
        altText = `Video by ${photographer}`;
      }

      if (!src) return; // Skip if no valid source is found (e.g., video has no files)

      const views = incrementViews(src);

      const content = document.createElement('div');
      content.className = 'item';
      content.innerHTML = `
        ${currentMediaType === 'photo'
          ? `<img src="${src}" alt="${altText}" loading="lazy" onclick="openLightbox('<img src=\'${src}\' alt=\'${altText}\' loading=\'lazy\' />')">`
          : `<video src="${src}" ${autoplayToggle.checked ? 'autoplay muted loop' : ''} controls loading="lazy" aria-label="${altText}" poster="${item.image || ''}" onclick="event.stopPropagation(); openLightbox('<video src=\'${src}\' controls autoplay loop muted poster=\'${item.image || ''}\' aria-label=\'${altText}\'></video>')"></video>`}
        <div class="item-info">
          <p>${photographer} | 👁️ ${views}</p>
          <div>
            <button onclick="saveFavorite('${src}', '${photographer}', '${currentMediaType}', '${altText.replace(/'/g, "\\'")}')" aria-label="Add to Favorites">❤️</button>
            <a href="${src}" download target="_blank" aria-label="Download Media">⬇️</a>
          </div>
        </div>
      `;
      gallery.appendChild(content);
    });
    currentPage++;
  } catch (error) {
    console.error('Error fetching media:', error);
    if (reset) {
      gallery.innerHTML = '<p class="no-results">Failed to load media. Please check your connection or try a different search term.</p>';
    }
    showToast(`Error loading media: ${error.message}`, 'error');
  } finally {
    isFetching = false;
    searchButton.textContent = 'Search';
    searchButton.disabled = false;
  }
}

/** Displays favorite media items from local storage. */
function displayFavorites() {
  favorites.innerHTML = '';
  const favs = JSON.parse(localStorage.getItem('pexelsFavorites')) || [];

  if (favs.length === 0) {
    favorites.innerHTML = '<p class="no-results">You haven\'t added any favorites yet! Click the ❤️ button on media to save them here.</p>';
    return;
  }

  favs.forEach((item, index) => {
    const content = document.createElement('div');
    content.className = 'item';
    content.innerHTML = `
      ${item.type === 'photo'
        ? `<img src="${item.src}" alt="${item.alt}" loading="lazy" onclick="openLightbox('<img src=\'${item.src}\' alt=\'${item.alt}\' loading=\'lazy\' />')">`
        : `<video src="${item.src}" controls loading="lazy" aria-label="${item.alt}" poster="${item.poster || ''}" onclick="event.stopPropagation(); openLightbox('<video src=\'${item.src}\' controls autoplay loop muted poster=\'${item.poster || ''}\' aria-label=\'${item.alt}\'></video>')"></video>`}
      <div class="item-info">
        <p>${item.photographer}</p>
        <div>
          <button onclick="deleteFavorite(${index})" aria-label="Delete from Favorites">🗑️</button>
          <a href="${item.src}" download target="_blank" aria-label="Download Media">⬇️</a>
        </div>
      </div>
    `;
    favorites.appendChild(content);
  });
}

// --- Event Listeners ---

// Infinite Scrolling & Back to Top Button visibility
window.addEventListener('scroll', () => {
  // Toggle Back to Top button visibility
  backToTopButton.style.display = window.scrollY > 300 ? 'block' : 'none';

  // Infinite scrolling logic
  // Only trigger if currently viewing the main gallery
  const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
  if (gallery.style.display !== 'none' && (scrollTop + clientHeight >= scrollHeight - 500) && !isFetching) {
    searchMedia(false); // Fetch more on scroll, without resetting the search parameters
  }
});

// Initial search when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Load Dark Mode preference
  if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark');
    darkModeToggle.textContent = '☀️';
  }

  // Load Autoplay Videos preference
  autoplayToggle.checked = localStorage.getItem('autoplayVideos') === 'true';
  autoplayToggle.addEventListener('change', () => {
    localStorage.setItem('autoplayVideos', autoplayToggle.checked);
    showToast(`Autoplay videos ${autoplayToggle.checked ? 'enabled' : 'disabled'}`, 'info');
  });

  // Load Compact View preference
  compactViewToggle.checked = localStorage.getItem('compactView') === 'true';
  if (compactViewToggle.checked) {
    document.body.classList.add('compact');
  }
  compactViewToggle.addEventListener('change', toggleCompact); // Use the dedicated toggle function

  // Event listeners for controls
  searchButton.addEventListener('click', () => searchMedia(true));
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      searchMedia(true);
    }
  });
  typeSelect.addEventListener('change', () => searchMedia(true)); // Trigger search on type change
  darkModeToggle.addEventListener('click', toggleDarkMode);

  // Close lightbox with Escape key
  lightbox.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeLightbox();
    }
  });

  // Initial media load (trending)
  searchMedia();
});
