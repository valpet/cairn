// Cairn Documentation JavaScript

document.addEventListener('DOMContentLoaded', function() {
  // Add copy-to-clipboard functionality to code blocks
  const codeBlocks = document.querySelectorAll('pre code');

  codeBlocks.forEach(function(codeBlock) {
    const pre = codeBlock.parentNode;
    const button = document.createElement('button');
    button.className = 'copy-button';
    button.textContent = 'Copy';
    button.addEventListener('click', function() {
      navigator.clipboard.writeText(codeBlock.textContent).then(function() {
        button.textContent = 'Copied!';
        setTimeout(function() {
          button.textContent = 'Copy';
        }, 2000);
      });
    });

    pre.style.position = 'relative';
    pre.appendChild(button);
  });

  // Add styles for copy button
  const style = document.createElement('style');
  style.textContent = `
    .copy-button {
      position: absolute;
      top: 10px;
      right: 10px;
      background: var(--bg-color);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 12px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s;
    }

    pre:hover .copy-button {
      opacity: 1;
    }

    .copy-button:hover {
      background: var(--code-bg);
    }
  `;
  document.head.appendChild(style);

  // Highlight current page in navigation
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.nav-links a');

  navLinks.forEach(function(link) {
    if (link.getAttribute('href') === currentPath) {
      link.classList.add('current');
    }
  });

  // Add navigation styles
  const navStyle = document.createElement('style');
  navStyle.textContent = `
    .nav-links a.current {
      background-color: var(--primary-color);
      color: white;
    }
  `;
  document.head.appendChild(navStyle);
});