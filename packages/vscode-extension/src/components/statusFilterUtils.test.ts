import { describe, it, expect } from 'vitest';
import { 
  getStatusIcon, 
  getStatusLabel, 
  toggleStatusFilter, 
  removeStatusFilter, 
  clearAllFilters 
} from './statusFilterUtils';

describe('Status Filter Utilities', () => {
  describe('getStatusIcon', () => {
    it('should return correct icon for ready status', () => {
      expect(getStatusIcon('ready')).toBe('🚀');
    });

    it('should return correct icon for open status', () => {
      expect(getStatusIcon('open')).toBe('📋');
    });

    it('should return correct icon for in_progress status', () => {
      expect(getStatusIcon('in_progress')).toBe('⚡');
    });

    it('should return correct icon for closed status', () => {
      expect(getStatusIcon('closed')).toBe('✅');
    });

    it('should return correct icon for blocked status', () => {
      expect(getStatusIcon('blocked')).toBe('🚫');
    });

    it('should return default icon for unknown status', () => {
      expect(getStatusIcon('unknown')).toBe('📋');
    });

    it('should return default icon for empty string', () => {
      expect(getStatusIcon('')).toBe('📋');
    });
  });

  describe('getStatusLabel', () => {
    it('should return correct label for ready status', () => {
      expect(getStatusLabel('ready')).toBe('Ready');
    });

    it('should return correct label for open status', () => {
      expect(getStatusLabel('open')).toBe('Open');
    });

    it('should return correct label for in_progress status', () => {
      expect(getStatusLabel('in_progress')).toBe('In Progress');
    });

    it('should return correct label for closed status', () => {
      expect(getStatusLabel('closed')).toBe('Closed');
    });

    it('should return correct label for blocked status', () => {
      expect(getStatusLabel('blocked')).toBe('Blocked');
    });

    it('should return the status itself for unknown status', () => {
      expect(getStatusLabel('custom_status')).toBe('custom_status');
    });

    it('should return empty string for empty string status', () => {
      expect(getStatusLabel('')).toBe('');
    });
  });

  describe('toggleStatusFilter', () => {
    it('should add status when not present', () => {
      const statuses = new Set(['open', 'closed']);
      const result = toggleStatusFilter('in_progress', statuses);
      
      expect(result.has('in_progress')).toBe(true);
      expect(result.has('open')).toBe(true);
      expect(result.has('closed')).toBe(true);
      expect(result.size).toBe(3);
    });

    it('should remove status when already present', () => {
      const statuses = new Set(['open', 'in_progress', 'closed']);
      const result = toggleStatusFilter('in_progress', statuses);
      
      expect(result.has('in_progress')).toBe(false);
      expect(result.has('open')).toBe(true);
      expect(result.has('closed')).toBe(true);
      expect(result.size).toBe(2);
    });

    it('should not modify original set', () => {
      const original = new Set(['open']);
      const result = toggleStatusFilter('closed', original);
      
      expect(original.size).toBe(1);
      expect(original.has('closed')).toBe(false);
      expect(result.size).toBe(2);
      expect(result.has('closed')).toBe(true);
    });

    it('should handle empty set', () => {
      const statuses = new Set<string>();
      const result = toggleStatusFilter('open', statuses);
      
      expect(result.has('open')).toBe(true);
      expect(result.size).toBe(1);
    });

    it('should handle toggling the only status in set', () => {
      const statuses = new Set(['open']);
      const result = toggleStatusFilter('open', statuses);
      
      expect(result.has('open')).toBe(false);
      expect(result.size).toBe(0);
    });

    it('should handle toggling same status multiple times', () => {
      const statuses = new Set(['open']);
      const result1 = toggleStatusFilter('closed', statuses);
      const result2 = toggleStatusFilter('closed', result1);
      
      expect(result2.has('closed')).toBe(false);
      expect(result2.has('open')).toBe(true);
      expect(result2.size).toBe(1);
    });
  });

  describe('removeStatusFilter', () => {
    it('should remove status when present', () => {
      const statuses = new Set(['open', 'in_progress', 'closed']);
      const result = removeStatusFilter('in_progress', statuses);
      
      expect(result.has('in_progress')).toBe(false);
      expect(result.has('open')).toBe(true);
      expect(result.has('closed')).toBe(true);
      expect(result.size).toBe(2);
    });

    it('should do nothing when status not present', () => {
      const statuses = new Set(['open', 'closed']);
      const result = removeStatusFilter('in_progress', statuses);
      
      expect(result.has('open')).toBe(true);
      expect(result.has('closed')).toBe(true);
      expect(result.size).toBe(2);
    });

    it('should not modify original set', () => {
      const original = new Set(['open', 'closed']);
      const result = removeStatusFilter('closed', original);
      
      expect(original.size).toBe(2);
      expect(original.has('closed')).toBe(true);
      expect(result.size).toBe(1);
      expect(result.has('closed')).toBe(false);
    });

    it('should handle empty set', () => {
      const statuses = new Set<string>();
      const result = removeStatusFilter('open', statuses);
      
      expect(result.size).toBe(0);
    });

    it('should handle removing last status', () => {
      const statuses = new Set(['open']);
      const result = removeStatusFilter('open', statuses);
      
      expect(result.size).toBe(0);
    });

    it('should handle removing non-existent status from non-empty set', () => {
      const statuses = new Set(['open', 'closed']);
      const result = removeStatusFilter('blocked', statuses);
      
      expect(result.has('open')).toBe(true);
      expect(result.has('closed')).toBe(true);
      expect(result.has('blocked')).toBe(false);
      expect(result.size).toBe(2);
    });
  });

  describe('clearAllFilters', () => {
    it('should return empty set', () => {
      const result = clearAllFilters();
      
      expect(result.size).toBe(0);
      expect(result instanceof Set).toBe(true);
    });

    it('should return a new set each time', () => {
      const result1 = clearAllFilters();
      const result2 = clearAllFilters();
      
      expect(result1).not.toBe(result2);
      expect(result1.size).toBe(0);
      expect(result2.size).toBe(0);
    });
  });
});
