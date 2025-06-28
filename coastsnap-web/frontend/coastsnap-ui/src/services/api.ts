/**
 * API service for all backend communications
 */
import type { 
  DownloadResponse, 
  ProcessingResponse, 
  SiteInfo, 
  GCP, 
  ShorelineData, 
  SetupStatus,
  Point2D 
} from '../types';
import { API_BASE_URL } from '../constants';
import { logger } from '../utils/logger';

class ApiService {
  baseUrl: string; // Make public for access

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // Generic HTTP methods
  async get(path: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}${path}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  async post(path: string, body?: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  // Site management
  async listSites(): Promise<SiteInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sites`);
      if (!response.ok) throw new Error('Failed to fetch sites');
      return response.json();
    } catch (error) {
      logger.error('API Error:', error);
      // Return empty array if backend is not available
      if (error instanceof Error && error.message.includes('Failed to fetch')) {
        logger.warn('Backend not available, returning empty site list');
        return [];
      }
      throw error;
    }
  }

  async addSite(siteName: string, rootId: number): Promise<{ message: string }> {
    const response = await fetch(`${this.baseUrl}/api/add_site`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site_name: siteName, root_id: rootId })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to add site');
    return data;
  }

  async setSite(siteName: string): Promise<{ message: string }> {
    const response = await fetch(`${this.baseUrl}/api/set_site/${siteName}`, {
      method: 'POST'
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to set site');
    return data;
  }

  async deleteSite(siteName: string): Promise<{ message: string }> {
    const response = await fetch(`${this.baseUrl}/api/sites/${siteName}`, {
      method: 'DELETE'
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to delete site');
    return data;
  }

  async completeSiteSetup(siteName: string): Promise<{ message: string }> {
    const response = await fetch(`${this.baseUrl}/api/sites/${siteName}/complete_setup`, {
      method: 'POST'
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to complete setup');
    return data;
  }

  // Image management
  async downloadImages(siteName: string, numImages: number): Promise<DownloadResponse> {
    const response = await fetch(`${this.baseUrl}/api/download_new_snaps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site_name: siteName, num_images: numImages })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to download images');
    return data;
  }

  async getRawImages(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/api/raw_images`);
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'Failed to fetch raw images');
    }
    return response.json();
  }

  async selectControlImage(filename: string): Promise<{ message: string; control_image_path: string }> {
    const response = await fetch(`${this.baseUrl}/api/select_control_image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to select control image');
    return data;
  }

  async uploadControlImage(file: File): Promise<{ message: string }> {
    const formData = new FormData();
    formData.append('control_image', file);
    
    const response = await fetch(`${this.baseUrl}/api/upload_control_image`, {
      method: 'POST',
      body: formData
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to upload control image');
    return data;
  }

  // GCP management
  async getGCPs(): Promise<GCP[]> {
    const response = await fetch(`${this.baseUrl}/api/gcps`);
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'Failed to fetch GCPs');
    }
    return response.json();
  }

  async saveGCPPixels(gcps: GCP[]): Promise<{ message: string }> {
    const response = await fetch(`${this.baseUrl}/api/save_gcp_pixels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gcps })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to save GCP data');
    return data;
  }

  async resetGCPPixels(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/reset_gcp_pixels`, { method: 'POST' });
    if (!response.ok) {
      throw new Error('Failed to reset GCP pixels');
    }
  }

  // Mask management
  async saveMask(polygons: number[][][]): Promise<{ message: string }> {
    const response = await fetch(`${this.baseUrl}/api/save_mask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ polygons })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to save mask');
    return data;
  }

  async saveRectifiedMask(polygons: number[][][], imageIndex: number): Promise<{ message: string }> {
    const response = await fetch(`${this.baseUrl}/api/save_rectified_mask/${imageIndex}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ polygons })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to save rectified mask');
    return data;
  }

  // Processing
  async checkSetup(): Promise<SetupStatus> {
    const response = await fetch(`${this.baseUrl}/api/check_setup`);
    if (!response.ok) throw new Error('Failed to check setup');
    return response.json();
  }

  async runProcessing(skipShorelineMapping: boolean = false): Promise<ProcessingResponse> {
    const response = await fetch(`${this.baseUrl}/api/run_processing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skip_shoreline_mapping: skipShorelineMapping })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Processing failed');
    return data;
  }

  async runShorelineMapping(): Promise<ProcessingResponse> {
    const response = await fetch(`${this.baseUrl}/api/run_shoreline_mapping`, {
      method: 'POST'
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Shoreline mapping failed');
    return data;
  }

  // Shoreline editing
  async getShorelineData(imageIndex: number): Promise<ShorelineData> {
    const response = await fetch(`${this.baseUrl}/api/shoreline_data/${imageIndex}`);
    if (!response.ok) throw new Error(`No shoreline data found for image ${imageIndex}`);
    return response.json();
  }

  async saveShorelineData(imageIndex: number, shorelinePoints: Point2D[]): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/save_shoreline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_index: imageIndex, shoreline_points: shorelinePoints })
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to save shoreline data');
    }
  }

  async resetShoreline(imageIndex: number): Promise<{ message: string }> {
    const response = await fetch(`${this.baseUrl}/api/reset_shoreline/${imageIndex}`, {
      method: 'POST'
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to reset shoreline');
    return data;
  }

  async approveShoreline(imageIndex: number): Promise<{ message: string }> {
    const response = await fetch(`${this.baseUrl}/api/approve_shoreline/${imageIndex}`, {
      method: 'POST'
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to approve shoreline');
    return data;
  }

  async getAllShorelineStatuses(): Promise<{ statuses: Record<number, boolean>; total: number }> {
    const response = await fetch(`${this.baseUrl}/api/shoreline_statuses`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to fetch shoreline statuses');
    return data;
  }

  // Image lists
  async getRectifiedImages(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/api/rectified_images`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to fetch rectified images');
    return data;
  }

  // Asset uploads
  async uploadDatabase(file: File): Promise<{ message: string }> {
    const formData = new FormData();
    formData.append('database', file);
    
    const response = await fetch(`${this.baseUrl}/api/upload_database`, {
      method: 'POST',
      body: formData
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Upload failed');
    return data;
  }

  async uploadTransects(file: File): Promise<{ message: string }> {
    const formData = new FormData();
    formData.append('transects', file);
    
    const response = await fetch(`${this.baseUrl}/api/upload_transects`, {
      method: 'POST',
      body: formData
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Upload failed');
    return data;
  }

  async downloadRegisteredOverlays(): Promise<{ message: string }> {
    const response = await fetch(`${this.baseUrl}/api/download_registered_overlays`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to generate overlays');
    return data;
  }

  // Metrics and dashboard endpoints
  async getSiteMetrics(siteName: string): Promise<any> {
    return this.get(`/api/sites/${siteName}/metrics`);
  }

  async getAllSiteMetrics(): Promise<any[]> {
    return this.get('/api/metrics/all');
  }

  async getRecentActivity(): Promise<any[]> {
    return this.get('/api/activity/recent');
  }

  // Image URL helpers
  getRawImageUrl(filename: string): string {
    return `${this.baseUrl}/api/images/raw/${filename}`;
  }

  getControlImageUrl(): string {
    return `${this.baseUrl}/api/images/control`;
  }

  getRectifiedImageUrl(index: number): string {
    return `${this.baseUrl}/api/images/rectified/${index}`;
  }

  getRectifiedWithShorelineUrl(index: number): string {
    return `${this.baseUrl}/api/images/rectified_with_shoreline/${index}`;
  }

  getRegisteredImageUrl(index: number): string {
    return `${this.baseUrl}/api/images/registered/${index}`;
  }

  getRegisteredImageWithShorelineUrl(index: number): string {
    return `${this.baseUrl}/api/images/registered_with_shoreline/${index}`;
  }
}

export default new ApiService();