/**
 * Type definitions for CoastSnap application
 */

// API Response types
export interface DownloadResponse {
  message: string;
  new_files?: string[];
  error?: string;
}

export interface ProcessingResponse {
  message: string;
  shoreline_results?: ShorelineData[];
  num_images?: number;
  error?: string;
}

// Data model types
export interface GCP {
  name: string;
  x: number;
  y: number;
  z: number;
  u?: number; // Pixel coordinate
  v?: number; // Pixel coordinate
}

export interface SiteInfo {
  site_name: string;
  root_id: number;
  setup_complete?: boolean;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface ShorelineData {
  image_index: number;
  filename: string;
  shoreline_points: number[][];
  edited?: boolean;
  last_edited?: string;
  approved?: boolean;
  utm_coordinates?: {
    x: (number | null)[];
    y: (number | null)[];
  };
  pixel_coordinates?: {
    x: (number | null)[];
    y: (number | null)[];
  };
}

export interface SetupStatus {
  control_image: boolean;
  gcps: boolean;
  mask: boolean;
  database: boolean;
  transects: boolean;
  complete: boolean;
}

// Component prop types
export interface MaskCreatorProps {
  onSave: (polygons: number[][][]) => Promise<void>;
  setStatus: (status: string) => void;
}

export interface RectifiedMaskCreatorProps {
  imageUrl: string;
  imageIndex: number;
  totalImages: number;
  onSave: (polygons: number[][][], imageIndex: number) => Promise<void>;
  onNext: () => void;
  onPrevious: () => void;
  canGoNext: boolean;
  canGoPrevious: boolean;
}

export interface ShorelineEditorProps {
  imageIndex: number;
  onSave: (shorelinePoints: Point2D[]) => Promise<void>;
  onNext: () => void;
  onPrevious: () => void;
  canGoNext: boolean;
  canGoPrevious: boolean;
}

export interface ImageSelectorProps {
  images: string[];
  currentIndex: number;
  onSelectImage: (index: number) => void;
  onConfirmSelection: () => Promise<void>;
  isLoading: boolean;
  apiBaseUrl: string;
}

export interface GCPSelectorProps {
  gcpList: GCP[];
  onSaveGCPs: (gcps: GCP[]) => Promise<void>;
  onReset: () => void;
  apiBaseUrl: string;
}

// Canvas/Stage types
export interface StagePosition {
  x: number;
  y: number;
}

export interface BoxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Coordinate conversion bounds
export const WORLD_BOUNDS = {
  xMin: -400,
  xMax: 100,
  yMin: 0,
  yMax: 600
} as const;