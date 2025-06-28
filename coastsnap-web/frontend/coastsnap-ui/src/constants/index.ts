/**
 * Application constants
 */

// Use direct URL for development since proxy might not be working
// In production, this should be the actual backend URL
export const API_BASE_URL = 'http://localhost:8000';

export const CANVAS_DIMENSIONS = {
  WIDTH: 800,
  HEIGHT: 600
} as const;

export const TARGET_EDIT_POINTS = 50; // Target number of points for shoreline editing

export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png'] as const;

export const FILE_ACCEPT_TYPES = {
  IMAGE: 'image/*',
  EXCEL: '.xlsx',
  MAT: '.mat'
} as const;