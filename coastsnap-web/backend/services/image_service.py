"""
Image handling service for managing raw images, control images, and masks.
"""
import os
import shutil
import json
from typing import List, Optional, Dict, Any, Tuple, Union
from PIL import Image, ImageDraw
import numpy as np
from constants import CONTROL_IMAGE_NAME
from utils.file_utils import (
    ensure_directory_exists, list_image_files, save_json_file
)
from utils.image_utils import (
    create_mask_from_polygons, create_masked_preview, validate_image_dimensions
)

from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from services.site_manager import SiteManager


class ImageService:
    """Handles image operations for CoastSnap processing."""
    
    def __init__(self, site_manager: 'SiteManager') -> None:
        self.site_manager = site_manager
    
    def list_raw_images(self) -> List[str]:
        """Get list of raw images for current site."""
        try:
            # list_image_files already returns sorted list with natural ordering
            return list_image_files(self.site_manager.raw_img_dir, ('.jpg',))
        except FileNotFoundError:
            raise FileNotFoundError("Raw images directory not found. Have you downloaded the snaps yet?")
    
    def select_control_image(self, filename: str) -> str:
        """Copy selected raw image as control image."""
        source_path = os.path.join(self.site_manager.raw_img_dir, filename)
        if not os.path.exists(source_path):
            raise FileNotFoundError("Source image not found.")
        
        # Ensure target directory exists
        ensure_directory_exists(self.site_manager.target_img_dir)
        
        # Define consistent name for control image
        destination_path = os.path.join(self.site_manager.target_img_dir, CONTROL_IMAGE_NAME)
        
        shutil.copy(source_path, destination_path)
        return destination_path
    
    def save_control_image_from_upload(self, file: Any) -> str:  # file is werkzeug.FileStorage
        """Save uploaded control image."""
        # Ensure directory exists
        ensure_directory_exists(self.site_manager.target_img_dir)
        
        # Save as control_image.jpg
        control_image_path = os.path.join(self.site_manager.target_img_dir, CONTROL_IMAGE_NAME)
        file.save(control_image_path)
        
        return control_image_path
    
    def create_mask(self, polygons: List[List[List[float]]], mask_type: str = 'control') -> Dict[str, str]:
        """
        Create masks from polygon data.
        
        Args:
            polygons: List of polygons, each polygon is a list of [x, y] points
            mask_type: 'control' for control image mask or 'rectified' for rectified image mask
        
        Returns:
            Dictionary with paths to created files
        """
        if mask_type == 'control':
            image_path = os.path.join(self.site_manager.target_img_dir, CONTROL_IMAGE_NAME)
            if not os.path.exists(image_path):
                raise FileNotFoundError("Control image not found.")
            
            output_dir = self.site_manager.target_img_dir
            json_path = os.path.join(output_dir, 'roi_polygons.json')
            npy_path = os.path.join(output_dir, 'roi_mask.npy')
            preview_path = os.path.join(output_dir, 'control_image_masked.png')
        else:
            raise ValueError(f"Unsupported mask type: {mask_type}")
        
        # Save raw polygon data
        save_json_file(polygons, json_path)
        
        # Get image dimensions and create mask
        img_size = validate_image_dimensions(image_path)
        np_mask = create_mask_from_polygons(polygons, img_size)
        
        # Save NumPy array mask
        np.save(npy_path, np_mask)
        
        # Create preview image
        create_masked_preview(image_path, np_mask, preview_path)
        
        return {
            'json_path': json_path,
            'npy_path': npy_path,
            'preview_path': preview_path
        }
    
    def create_rectified_mask(self, polygons: List[List[List[float]]], image_index: int) -> Dict[str, str]:
        """Create mask for rectified images."""
        rectified_dir = self.site_manager.rectified_dir
        if not os.path.isdir(rectified_dir):
            raise FileNotFoundError("Rectified images directory not found.")
        
        # Use the same natural sorting as list_image_files
        rectified_files = list_image_files(rectified_dir)
        
        if image_index < 0 or image_index >= len(rectified_files):
            raise ValueError(f"Invalid image index {image_index}")
        
        rectified_path = os.path.join(rectified_dir, rectified_files[image_index])
        
        # Load image to get dimensions
        img = Image.open(rectified_path)
        width, height = img.size
        
        # Save polygon data
        mask_dir = self.site_manager.rectified_mask_dir
        polygons_json_path = os.path.join(mask_dir, f'polygons_{image_index}.json')
        save_json_file(polygons, polygons_json_path)
        
        # Create binary mask
        np_mask = create_mask_from_polygons(polygons, (width, height))
        npy_path = os.path.join(mask_dir, f'mask_{image_index}.npy')
        np.save(npy_path, np_mask)
        
        # Also save as common mask
        npy_common = os.path.join(mask_dir, 'mask_common.npy')
        np.save(npy_common, np_mask)
        
        # Save preview
        preview_path = os.path.join(mask_dir, f'mask_preview_{image_index}.png')
        create_masked_preview(rectified_path, np_mask, preview_path)
        
        return {
            'json_path': polygons_json_path,
            'npy_path': npy_path,
            'common_path': npy_common,
            'preview_path': preview_path
        }
    
    def list_rectified_images(self) -> List[str]:
        """Get list of rectified images."""
        rectified_dir = self.site_manager.rectified_dir
        if not os.path.isdir(rectified_dir):
            raise FileNotFoundError("Rectified images directory not found.")
        
        return list_image_files(rectified_dir)
    
    def list_registered_images(self) -> List[str]:
        """Get list of registered images."""
        registered_dir = self.site_manager.registered_dir
        if not os.path.isdir(registered_dir):
            raise FileNotFoundError("Registered images directory not found.")
        
        return list_image_files(registered_dir)
    
    def get_control_image_path(self) -> str:
        """Get path to control image."""
        return os.path.join(self.site_manager.target_img_dir, CONTROL_IMAGE_NAME)
    
    def get_mask_path(self) -> str:
        """Get path to control image mask."""
        return os.path.join(self.site_manager.target_img_dir, 'roi_mask.npy')