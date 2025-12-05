import DOMPurify from 'dompurify';

/**
 * Safely sanitizes and injects tracking pixel code into the document head.
 * Only allows script tags from known tracking domains.
 * 
 * @param pixelCode - The raw pixel code from the database
 * @param pixelType - Type identifier for cleanup ('google' or 'meta')
 * @returns The created container element or null if invalid
 */
export function injectSanitizedPixel(
  pixelCode: string | null | undefined,
  pixelType: 'google' | 'meta'
): HTMLDivElement | null {
  if (!pixelCode || typeof pixelCode !== 'string') {
    return null;
  }

  // Trim and validate basic structure
  const trimmedCode = pixelCode.trim();
  if (!trimmedCode) {
    return null;
  }

  // Allowlist of domains for tracking pixels
  const allowedDomains = [
    'googletagmanager.com',
    'google-analytics.com',
    'googleadservices.com',
    'googlesyndication.com',
    'doubleclick.net',
    'facebook.net',
    'facebook.com',
    'connect.facebook.net',
    'analytics.google.com',
    'www.googletagmanager.com',
    'gtag',
  ];

  // Check if the code contains only allowed domains
  const urlPattern = /(?:src|href)=["']([^"']+)["']/gi;
  const matches = trimmedCode.matchAll(urlPattern);
  
  for (const match of matches) {
    const url = match[1];
    const isAllowed = allowedDomains.some(domain => 
      url.includes(domain) || url.startsWith('https://www.')
    );
    
    if (!isAllowed && !url.startsWith('data:')) {
      console.warn(`Blocked pixel injection: URL not in allowlist: ${url}`);
      return null;
    }
  }

  // Configure DOMPurify to allow script tags but sanitize content
  const config = {
    ADD_TAGS: ['script', 'noscript', 'iframe'],
    ADD_ATTR: ['async', 'defer', 'src', 'id', 'data-*', 'allow', 'allowfullscreen'],
    ALLOW_UNKNOWN_PROTOCOLS: false,
    FORCE_BODY: true,
  };

  // Sanitize the pixel code
  const sanitizedCode = DOMPurify.sanitize(trimmedCode, config);

  if (!sanitizedCode) {
    console.warn('Pixel code was completely sanitized (empty result)');
    return null;
  }

  // Create container and inject
  const container = document.createElement('div');
  container.setAttribute('data-pixel-injected', pixelType);
  container.innerHTML = sanitizedCode;
  
  // Extract and re-create script elements (innerHTML doesn't execute scripts)
  const scripts = container.querySelectorAll('script');
  scripts.forEach(originalScript => {
    const newScript = document.createElement('script');
    
    // Copy attributes
    Array.from(originalScript.attributes).forEach(attr => {
      newScript.setAttribute(attr.name, attr.value);
    });
    
    // Copy inline content
    if (originalScript.textContent) {
      newScript.textContent = originalScript.textContent;
    }
    
    // Replace original with executable script
    originalScript.parentNode?.replaceChild(newScript, originalScript);
  });

  document.head.appendChild(container);
  return container;
}

/**
 * Removes all injected pixel containers from the document head.
 */
export function removeInjectedPixels(): void {
  const scriptsToRemove = document.head.querySelectorAll('[data-pixel-injected]');
  scriptsToRemove.forEach(script => script.remove());
}
