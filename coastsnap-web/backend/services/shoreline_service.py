"""
Shoreline data management service for handling shoreline detection results and editing.
"""
import os
import json
import numpy as np
import cv2
from typing import Dict, Any, List, Optional, Tuple
from scipy.optimize import curve_fit
import numpy.matlib as matlib
from imageprocessing.readDB import readDB
from constants import COLOR_YELLOW, OVERLAYS_DIR

from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from services.site_manager import SiteManager


class ShorelineService:
    """Manages shoreline data loading, saving, and visualization."""
    
    def __init__(self, site_manager: 'SiteManager', db_path: str) -> None:
        self.site_manager = site_manager
        self.db_path = db_path
    
    def _get_shoreline_filename(self, image_index: int) -> str:
        """Get shoreline filename - handles both old and new naming schemes."""
        shoreline_dir = self.site_manager.shoreline_dir
        
        # First try old format (shoreline_0.json)
        old_format = os.path.join(shoreline_dir, f'shoreline_{image_index}.json')
        if os.path.exists(old_format):
            return old_format
        
        # Get rectified files to find the identifier
        rectified_dir = self.site_manager.rectified_dir
        if os.path.isdir(rectified_dir):
            rectified_files = sorted([f for f in os.listdir(rectified_dir) 
                                    if f.lower().endswith(('.png', '.jpg', '.jpeg'))])
            if 0 <= image_index < len(rectified_files):
                filename = rectified_files[image_index]
                if filename.startswith('rectified_'):
                    base_name = filename[10:]  # Remove 'rectified_' prefix
                    name_without_ext = os.path.splitext(base_name)[0]
                    new_format = os.path.join(shoreline_dir, f'shoreline_{name_without_ext}.json')
                    if os.path.exists(new_format):
                        return new_format
        
        # If neither exists, return the old format path (for new files)
        return old_format
    
    def get_shoreline_data(self, image_index: int) -> Dict[str, Any]:
        """Load shoreline data for a specific image."""
        shoreline_file = self._get_shoreline_filename(image_index)
        
        if not os.path.exists(shoreline_file):
            raise FileNotFoundError(f"Shoreline data for image {image_index} not found.")
        
        with open(shoreline_file, 'r') as f:
            return json.load(f)
    
    def save_edited_shoreline(self, image_index: int, shoreline_points: List[Dict[str, float]]) -> None:
        """Save manually edited shoreline data."""
        shoreline_dir = self.site_manager.shoreline_dir
        shoreline_file = self._get_shoreline_filename(image_index)
        
        # Load original file to preserve other data
        if os.path.exists(shoreline_file):
            with open(shoreline_file, 'r') as f:
                original_data = json.load(f)
        else:
            original_data = {}
        
        # Convert from {x, y} objects to [x, y] arrays
        converted_points = []
        for point in shoreline_points:
            if isinstance(point, dict) and 'x' in point and 'y' in point:
                converted_points.append([point['x'], point['y']])
            elif isinstance(point, list) and len(point) >= 2:
                converted_points.append([point[0], point[1]])
            else:
                converted_points.append(point)
        
        # Update with edited data
        original_data.update({
            'image_index': image_index,
            'shoreline_points': converted_points,
            'edited': True,
            'last_edited': str(np.datetime64('now', 's'))
        })
        
        with open(shoreline_file, 'w') as f:
            json.dump(original_data, f, indent=4)
    
    def reset_shoreline(self, image_index: int) -> None:
        """Reset shoreline to original detection."""
        shoreline_file = self._get_shoreline_filename(image_index)
        
        if not os.path.exists(shoreline_file):
            raise FileNotFoundError(f"Shoreline data for image {image_index} not found.")
        
        with open(shoreline_file, 'r') as f:
            data = json.load(f)
        
        # Remove edited data
        keys_to_remove = ['shoreline_points', 'edited', 'last_edited']
        for key in keys_to_remove:
            if key in data:
                del data[key]
        
        with open(shoreline_file, 'w') as f:
            json.dump(data, f, indent=4)
    
    def approve_shoreline(self, image_index: int) -> None:
        """Mark a shoreline as approved."""
        shoreline_file = self._get_shoreline_filename(image_index)
        
        if not os.path.exists(shoreline_file):
            raise FileNotFoundError(f"Shoreline data for image {image_index} not found.")
        
        with open(shoreline_file, 'r') as f:
            data = json.load(f)
        
        # Set approved to True
        data['approved'] = True
        
        with open(shoreline_file, 'w') as f:
            json.dump(data, f, indent=4)
    
    def generate_registered_overlay(self, image_index: int) -> bytes:
        """
        Generate overlay of shoreline on registered image.
        
        Returns:
            Image bytes for the overlay
        """
        registered_dir = self.site_manager.registered_dir
        if not os.path.isdir(registered_dir):
            raise FileNotFoundError("Registered images directory not found.")
        
        registered_files = sorted([f for f in os.listdir(registered_dir) 
                                  if f.lower().endswith(('.jpg', '.jpeg', '.png'))])
        
        if image_index < 0 or image_index >= len(registered_files):
            raise ValueError(f"Invalid image index {image_index}")
        
        # Load registered image
        registered_path = os.path.join(registered_dir, registered_files[image_index])
        registered_image = cv2.imread(registered_path)
        if registered_image is None:
            raise FileNotFoundError("Failed to load registered image")
        
        # Load shoreline data
        shoreline_data = self.get_shoreline_data(image_index)
        shoreline_points = shoreline_data.get('shoreline_points', [])
        if not shoreline_points:
            raise ValueError("No shoreline points found")
        
        # Load rectification parameters
        rect_params = self._load_rectification_params()
        
        # Project shoreline to registered image
        overlay_image = self._create_shoreline_overlay(
            registered_image, 
            shoreline_points, 
            rect_params
        )
        
        # Convert to bytes
        _, buffer = cv2.imencode('.jpg', overlay_image)
        return buffer.tobytes()
    
    def generate_all_overlays(self) -> Dict[str, Any]:
        """Generate overlay images for all registered images with shorelines."""
        registered_dir = self.site_manager.registered_dir
        shoreline_dir = self.site_manager.shoreline_dir
        overlay_dir = self.site_manager.overlays_dir
        
        if not os.path.isdir(registered_dir):
            raise FileNotFoundError("Registered images directory not found.")
        
        os.makedirs(overlay_dir, exist_ok=True)
        
        registered_files = sorted([f for f in os.listdir(registered_dir)
                                  if f.lower().endswith(('.jpg', '.jpeg', '.png'))])
        
        if not registered_files:
            raise FileNotFoundError("No registered images to package.")
        
        generated_files = []
        
        for idx, fname in enumerate(registered_files):
            try:
                # Load registered image
                registered_path = os.path.join(registered_dir, fname)
                registered_image = cv2.imread(registered_path)
                if registered_image is None:
                    continue
                
                # Check if shoreline exists - use the new naming lookup
                try:
                    shoreline_data = self.get_shoreline_data(idx)
                except FileNotFoundError:
                    continue
                
                shoreline_points = shoreline_data.get('shoreline_points', [])
                if not shoreline_points:
                    continue
                
                # Load rectification parameters
                rect_params = self._load_rectification_params()
                
                # Create overlay
                overlay = self._create_shoreline_overlay(
                    registered_image,
                    shoreline_points,
                    rect_params
                )
                
                # Save overlay
                out_path = os.path.join(overlay_dir, f'registered_overlay_{idx + 1}.jpg')
                cv2.imwrite(out_path, overlay)
                generated_files.append(out_path)
                
            except Exception:
                continue
        
        return {
            "generated_count": len(generated_files),
            "files": generated_files,
            "folder": overlay_dir
        }
    
    def _load_rectification_params(self) -> Dict[str, Any]:
        """Load saved rectification parameters."""
        rectification_dir = self.site_manager.rectified_dir
        rect_params_file = os.path.join(rectification_dir, 'rectification_params.json')
        
        if os.path.exists(rect_params_file):
            with open(rect_params_file, 'r') as f:
                return json.load(f)
        else:
            # Fallback parameters
            return {
                'beta6': [0.0, 0.0, 17.301, -0.445004330, 1.31435889, -0.00347993678],
                'fx': 1420.0,
                'fy': 1420.0
            }
    
    def _create_shoreline_overlay(
        self, 
        registered_image: np.ndarray, 
        shoreline_points: List[List[float]], 
        rect_params: Dict[str, Any]
    ) -> np.ndarray:
        """Create overlay of shoreline on registered image."""
        # Extract parameters
        beta6 = np.array(rect_params['beta6'])
        fx = rect_params['fx']
        fy = rect_params['fy']
        
        NV, NU = registered_image.shape[:2]
        c0U = NU / 2
        c0V = NV / 2
        
        # Sample points for visibility - use all points for better visibility
        sampled_points = shoreline_points[::5]  # Every 5th point for smoother line
        
        # Convert to 3D coordinates
        shoreline_xyz = []
        for point in sampled_points:
            if len(point) >= 2 and point[0] is not None and point[1] is not None:
                # The shoreline points are already in the relative coordinate system
                shoreline_xyz.append([point[0], point[1], 0.0])
        
        if not shoreline_xyz:
            return registered_image
        
        shoreline_xyz = np.array(shoreline_xyz)
        
        # Transform to image coordinates
        UV_shoreline = self._findUV6DOF(
            shoreline_xyz, beta6[0], beta6[1], beta6[2], 
            beta6[3], beta6[4], beta6[5], fx, fy, c0U, c0V
        )
        
        # Filter valid points
        valid_points = []
        for u, v in UV_shoreline:
            if 0 <= u < NU and 0 <= v < NV and not (np.isnan(u) or np.isnan(v)):
                valid_points.append([int(u), int(v)])
        
        if len(valid_points) < 2:
            return registered_image
        
        # Draw overlay
        overlay_image = registered_image.copy()
        valid_points = np.array(valid_points)
        
        # Draw thick yellow line with circles at points
        for i in range(len(valid_points) - 1):
            cv2.line(overlay_image, tuple(valid_points[i]), tuple(valid_points[i+1]), 
                    COLOR_YELLOW, 12)
        
        # Draw circles at points for better visibility
        for point in valid_points:
            cv2.circle(overlay_image, tuple(point), 8, COLOR_YELLOW, -1)
        
        return overlay_image
    
    def _angles2R(self, a: float, t: float, s: float) -> np.ndarray:
        """Convert angles to rotation matrix."""
        R = np.zeros((3, 3))
        R[0,0] = np.cos(a) * np.cos(s) + np.sin(a) * np.cos(t) * np.sin(s)
        R[0,1] = -np.cos(s) * np.sin(a) + np.sin(s) * np.cos(t) * np.cos(a)
        R[0,2] = np.sin(s) * np.sin(t)
        R[1,0] = -np.sin(s) * np.cos(a) + np.cos(s) * np.cos(t) * np.sin(a)
        R[1,1] = np.sin(s) * np.sin(a) + np.cos(s) * np.cos(t) * np.cos(a)
        R[1,2] = np.cos(s) * np.sin(t)
        R[2,0] = np.sin(t) * np.sin(a)
        R[2,1] = np.sin(t) * np.cos(a)
        R[2,2] = -np.cos(t)
        return R
    
    def _findUV6DOF(self, xyz: np.ndarray, b0: float, b1: float, b2: float, 
                    b3: float, b4: float, b5: float, fx: float, fy: float, 
                    c0U: float, c0V: float) -> np.ndarray:
        """Project 3D points to 2D image coordinates."""
        K = np.array([[fx, 0, c0U], [0, -fy, c0V], [0, 0, 1]], dtype=float)
        R = self._angles2R(b3, b4, b5)
        I = np.eye(3)
        C = np.array([b0, b1, b2], dtype=float).reshape((3, 1))
        P = K @ R @ np.hstack((I, -C))
        P = P / P[2, 3]
        UV = P @ np.vstack((xyz.T, np.ones((1, len(xyz)))))
        UV = UV / np.tile(UV[2, :], (3, 1))
        return np.column_stack((UV[0, :], UV[1, :]))