import { describe, it, expect, beforeEach, vi } from 'vitest';
import { formatRelativeTime, formatFullTimestamp } from './timeUtils';

describe('timeUtils', () => {
  beforeEach(() => {
    // Mock Date.now() to return a fixed timestamp
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-27T15:00:00.000Z'));
  });

  describe('formatRelativeTime', () => {
    it('should return "Just now" for times less than 1 minute ago', () => {
      const now = new Date(Date.now());
      const fiveSecondsAgo = new Date(now.getTime() - 5 * 1000);
      const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000);
      const fiftyNineSecondsAgo = new Date(now.getTime() - 59 * 1000);
      
      expect(formatRelativeTime(fiveSecondsAgo)).toBe('Just now');
      expect(formatRelativeTime(thirtySecondsAgo)).toBe('Just now');
      expect(formatRelativeTime(fiftyNineSecondsAgo)).toBe('Just now');
    });

    it('should return "Yesterday" for times from previous calendar day and >12h ago', () => {
      const now = new Date(Date.now());
      
      // Create a date that's yesterday (previous calendar day) and >12h ago
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0); // Yesterday at midnight = ~15h ago from the mocked time
      
      expect(formatRelativeTime(yesterday)).toBe('Yesterday');
    });

    it('should use calendar days not 24-hour periods', () => {
      // Mock time is 2026-01-27 at 12:00:00 (noon)
      const now = new Date(Date.now());
      
      // Something from 11 PM yesterday (only ~13 hours ago but previous calendar day)
      const yesterdayLate = new Date(now);
      yesterdayLate.setDate(now.getDate() - 1);
      yesterdayLate.setHours(23, 0, 0, 0);
      
      expect(formatRelativeTime(yesterdayLate)).toBe('Yesterday');
      
      // Something from 1 AM today (11 hours ago but same calendar day)
      const todayEarly = new Date(now);
      todayEarly.setHours(1, 0, 0, 0);
      
      const hoursAgo = Math.floor((now.getTime() - todayEarly.getTime()) / (60 * 60 * 1000));
      expect(formatRelativeTime(todayEarly)).toBe(`${hoursAgo}h ago`);
    });

    it('should return hours for times <12h ago even if from yesterday', () => {
      // Test the bug: something from yesterday (<12h) should show hours, not "1d ago"
      // Current time: Jan 27 at 15:00:00 (mocked time)
      // Task from: Jan 27 at 04:00:00 (11h ago, same day)
      const now = new Date(Date.now());
      const elevenHoursAgo = new Date(now.getTime() - 11 * 60 * 60 * 1000);
      
      expect(formatRelativeTime(elevenHoursAgo)).toBe('11h ago');
      
      // Better test: something that actually crosses midnight
      // Set mock time to Jan 28 at 02:00:00
      vi.setSystemTime(new Date('2026-01-28T02:00:00.000Z'));
      const nowAfterMidnight = new Date(Date.now());
      
      // Task from Jan 27 at 20:00:00 (6 hours ago, but yesterday)
      const sixHoursAgoYesterday = new Date('2026-01-27T20:00:00.000Z');
      expect(formatRelativeTime(sixHoursAgoYesterday)).toBe('6h ago');
      
      // Reset to original mock time
      vi.setSystemTime(new Date('2026-01-27T15:00:00.000Z'));
    });

    it('should return minutes for times less than 1 hour ago', () => {
      const now = new Date(Date.now());
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
      const fiftyNineMinutesAgo = new Date(now.getTime() - 59 * 60 * 1000);
      
      expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m ago');
      expect(formatRelativeTime(thirtyMinutesAgo)).toBe('30m ago');
      expect(formatRelativeTime(fiftyNineMinutesAgo)).toBe('59m ago');
    });

    it('should return hours for times less than 24 hours ago', () => {
      const now = new Date(Date.now());
      
      // All from today (same calendar day)
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);
      const elevenHoursAgo = new Date(now.getTime() - 11 * 60 * 60 * 1000);
      
      expect(formatRelativeTime(oneHourAgo)).toBe('1h ago');
      expect(formatRelativeTime(fiveHoursAgo)).toBe('5h ago');
      expect(formatRelativeTime(elevenHoursAgo)).toBe('11h ago');
    });

    it('should return days for times 24+ hours ago (crossing into multiple calendar days)', () => {
      const now = new Date(Date.now());
      
      // Create dates that are 2, 3, and 6 calendar days ago
      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(now.getDate() - 2);
      twoDaysAgo.setHours(12, 0, 0, 0);
      
      const threeDaysAgo = new Date(now);
      threeDaysAgo.setDate(now.getDate() - 3);
      threeDaysAgo.setHours(12, 0, 0, 0);
      
      const sixDaysAgo = new Date(now);
      sixDaysAgo.setDate(now.getDate() - 6);
      sixDaysAgo.setHours(12, 0, 0, 0);
      
      expect(formatRelativeTime(twoDaysAgo)).toBe('2d ago');
      expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago');
      expect(formatRelativeTime(sixDaysAgo)).toBe('6d ago');
    });

    it('should return weeks for times less than 1 month ago', () => {
      const now = new Date(Date.now());
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const threeWeeksAgo = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);
      
      expect(formatRelativeTime(oneWeekAgo)).toBe('1w ago');
      expect(formatRelativeTime(twoWeeksAgo)).toBe('2w ago');
      expect(formatRelativeTime(threeWeeksAgo)).toBe('3w ago');
    });

    it('should return months for times less than 1 year ago', () => {
      const now = new Date(Date.now());
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      const elevenMonthsAgo = new Date(now.getTime() - 330 * 24 * 60 * 60 * 1000);
      
      expect(formatRelativeTime(oneMonthAgo)).toBe('1mo ago');
      expect(formatRelativeTime(sixMonthsAgo)).toBe('6mo ago');
      expect(formatRelativeTime(elevenMonthsAgo)).toBe('11mo ago');
    });

    it('should return years for times more than 1 year ago', () => {
      const now = new Date(Date.now());
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      const twoYearsAgo = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);
      
      expect(formatRelativeTime(oneYearAgo)).toBe('1y ago');
      expect(formatRelativeTime(twoYearsAgo)).toBe('2y ago');
    });

    it('should handle string dates', () => {
      const now = new Date(Date.now());
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      
      expect(formatRelativeTime(fiveMinutesAgo.toISOString())).toBe('5m ago');
    });

    it('should return "Unknown" for invalid dates', () => {
      expect(formatRelativeTime('invalid-date')).toBe('Unknown');
      expect(formatRelativeTime(new Date('invalid'))).toBe('Unknown');
    });
  });

  describe('formatFullTimestamp', () => {
    it('should format dates as full timestamp strings', () => {
      const date = new Date('2026-01-27T15:45:30.000Z');
      const formatted = formatFullTimestamp(date);
      
      // Format should include month, day, year, time
      expect(formatted).toContain('Jan');
      expect(formatted).toContain('27');
      expect(formatted).toContain('2026');
      expect(formatted).toContain('at');
    });

    it('should handle string dates', () => {
      const formatted = formatFullTimestamp('2026-01-27T15:45:30.000Z');
      
      expect(formatted).toContain('Jan');
      expect(formatted).toContain('27');
      expect(formatted).toContain('2026');
    });

    it('should return "Unknown date" for invalid dates', () => {
      expect(formatFullTimestamp('invalid-date')).toBe('Unknown date');
      expect(formatFullTimestamp(new Date('invalid'))).toBe('Unknown date');
    });

    it('should use 12-hour format with AM/PM', () => {
      const morningDate = new Date('2026-01-27T09:30:00.000Z');
      const eveningDate = new Date('2026-01-27T21:30:00.000Z');
      
      const morningFormatted = formatFullTimestamp(morningDate);
      const eveningFormatted = formatFullTimestamp(eveningDate);
      
      // Should contain AM or PM (depending on timezone)
      expect(morningFormatted.match(/AM|PM/)).toBeTruthy();
      expect(eveningFormatted.match(/AM|PM/)).toBeTruthy();
    });
  });
});
