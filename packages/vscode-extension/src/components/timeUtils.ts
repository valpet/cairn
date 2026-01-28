/**
 * Minimum hours threshold for displaying "Yesterday" instead of "Xh ago"
 * 
 * This prevents confusing displays like "Yesterday" for times that were only
 * 13 hours ago but happened to cross midnight. A 12-hour threshold ensures
 * "Yesterday" only appears for times that feel substantially in the past.
 */
const YESTERDAY_HOUR_THRESHOLD = 12;

/**
 * Format a date as a relative time string (e.g., "Just now", "5 minutes ago")
 */
export const formatRelativeTime = (date: Date | string): string => {
  const now = Date.now();
  const updatedDate = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(updatedDate.getTime())) {
    return 'Unknown';
  }
  
  const nowDate = new Date(now);
  const diffMs = now - updatedDate.getTime();
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMinutes / 60);
  
  // Calculate calendar day difference (not 24-hour periods)
  const startOfToday = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
  const startOfUpdateDay = new Date(updatedDate.getFullYear(), updatedDate.getMonth(), updatedDate.getDate());
  const daysDiff = Math.floor((startOfToday.getTime() - startOfUpdateDay.getTime()) / (24 * 60 * 60 * 1000));
  
  const diffWeeks = Math.floor(daysDiff / 7);
  const diffMonths = Math.floor(daysDiff / 30);
  const diffYears = Math.floor(daysDiff / 365);
  
  // Check if it's from yesterday (previous calendar day and >12h ago)
  const isYesterday = daysDiff === 1;
  
  if (diffMinutes < 1) {
    return 'Just now';
  } else if (isYesterday && diffHours >= YESTERDAY_HOUR_THRESHOLD) {
    return 'Yesterday';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    // Show hours for anything less than 24 hours old, regardless of calendar day
    return `${diffHours}h ago`;
  } else if (daysDiff < 7) {
    return `${daysDiff}d ago`;
  } else if (diffWeeks < 4) {
    return `${diffWeeks}w ago`;
  } else if (diffMonths < 12) {
    return `${diffMonths}mo ago`;
  } else {
    return `${diffYears}y ago`;
  }
};

/**
 * Format a date as a full timestamp string for tooltips
 */
export const formatFullTimestamp = (date: Date | string): string => {
  const updatedDate = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(updatedDate.getTime())) {
    return 'Unknown date';
  }
  
  // Format as: "Jan 27, 2026 at 3:45 PM"
  const dateOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };
  
  const datePart = updatedDate.toLocaleDateString('en-US', dateOptions);
  const timePart = updatedDate.toLocaleTimeString('en-US', timeOptions);
  
  return `${datePart} at ${timePart}`;
};
