"""
Processing pipeline service for orchestrating registration, rectification, and shoreline mapping.
"""
import os
import json
import numpy as np
import cv2
from typing import Dict, Any, List, Optional, Tuple
from imageprocessing.readDB import readDB
from imageprocessing.registration import Registration
from imageprocessing.rectification import Rectification
from imageprocessing.slmapping import mapSL
from constants import CONTROL_IMAGE_NAME
from utils.file_utils import ensure_directory_exists, list_image_files, save_json_file
from utils.logging_config import get_logger

from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from services.site_manager import SiteManager


class ProcessingService:
    """Orchestrates the image processing pipeline."""
    
    def __init__(self, site_manager: 'SiteManager', db_path: str) -> None:
        self.site_manager = site_manager
        self.db_path = db_path
        self.logger = get_logger(__name__)
    
    def run_registration_and_rectification(self, skip_mapping: bool = False) -> Dict[str, Any]:
        """
        Run the full registration and rectification pipeline.
        
        Args:
            skip_mapping: If True, skip shoreline mapping step
            
        Returns:
            Dictionary with processing results
        """
        try:
            self.logger.info("Starting Registration Process")
            
            # Validate inputs
            control_image_path = os.path.join(self.site_manager.target_img_dir, CONTROL_IMAGE_NAME)
            mask_path = os.path.join(self.site_manager.target_img_dir, 'roi_mask.npy')
            gcp_pixels_path = os.path.join(self.site_manager.target_img_dir, 'gcp_pixels.json')
            
            if not os.path.exists(control_image_path):
                raise FileNotFoundError("Control image not found.")
            if not os.path.exists(mask_path):
                raise FileNotFoundError("ROI mask not found.")
            if not os.path.exists(gcp_pixels_path):
                raise FileNotFoundError("GCP pixel data not found.")
            
            # Load mask
            mask = np.load(mask_path)
            
            # Run registration
            register = Registration(control_image_path, mask, self.site_manager.site_dir)
            register.generate_registrations()
            
            self.logger.info("Registration Complete. Starting Rectification Process")
        
            # Load inputs for rectification
            cs_input = readDB(self.db_path, self.site_manager.current_site)
            
            with open(gcp_pixels_path, 'r') as f:
                selected_gcp_data = json.load(f)
            
            uv_coordinates = [[gcp['u'], gcp['v']] for gcp in selected_gcp_data]
            
            # Run rectification
            rectifier = Rectification(cs_input, uv_coordinates, selected_gcp_data)
            rectifier.generate_rectifications()
            
            result = {
                "registration_complete": True,
                "rectification_complete": True,
                "shoreline_mapping_complete": False
            }
            
            if not skip_mapping:
                self.logger.info("Rectification Complete. Starting Shoreline Mapping Process")
                shoreline_results = self.run_shoreline_mapping()
                result["shoreline_mapping_complete"] = True
                result["shoreline_results"] = shoreline_results
                result["num_images"] = len(shoreline_results)
            
            return result
            
        except Exception as e:
            self.logger.error(f"Error in processing pipeline: {str(e)}")
            raise RuntimeError(f"Processing pipeline failed: {str(e)}")
    
    def run_shoreline_mapping(self) -> List[Dict[str, Any]]:
        """
        Run shoreline detection on rectified images.
        
        Returns:
            List of shoreline results for each image
        """
        try:
            rectified_dir = self.site_manager.rectified_dir
            shoreline_dir = self.site_manager.shoreline_dir
            ensure_directory_exists(shoreline_dir)
            
            if not os.path.isdir(rectified_dir):
                raise FileNotFoundError("Rectified images directory not found. Run rectification first.")
            
            # Load site database
            cs_input = readDB(self.db_path, self.site_manager.current_site)
            
            rectified_files = list_image_files(rectified_dir)
            
            if not rectified_files:
                raise FileNotFoundError("No rectified images found.")
            
            shoreline_results = []
            
            for i, filename in enumerate(rectified_files):
                rectified_path = os.path.join(rectified_dir, filename)
                rectified_image = cv2.imread(rectified_path)
                
                if rectified_image is None:
                    self.logger.warning(f"Could not load rectified image {filename}. Skipping.")
                    continue
                
                # Extract base name for consistent naming
                if filename.startswith('rectified_'):
                    base_name = filename[10:]  # Remove 'rectified_' prefix
                    name_without_ext = os.path.splitext(base_name)[0]
                else:
                    name_without_ext = os.path.splitext(filename)[0]
                
                # Load mask if available (still use index for backward compatibility)
                mask_arr = self._load_rectified_mask(i)
                
                # Construct transect file path
                transects_path = os.path.join(
                    self.site_manager.assets_dir, 
                    f'SLtransects_{self.site_manager.current_site}.mat'
                )
                
                # Run shoreline mapping
                mapper = mapSL(
                    cs_input, 
                    rectified_image, 
                    shoreline_dir, 
                    i, 
                    mask=mask_arr, 
                    transect_path=transects_path
                )
                
                # Prepare result data
                shoreline_data = {
                    'image_index': i,
                    'filename': filename,
                    'identifier': name_without_ext,  # Add identifier for easier matching
                    'shoreline_points': self._clean_nans(mapper.slpoints),
                    'utm_coordinates': {
                        'x': self._clean_nans(mapper.UTMx),
                        'y': self._clean_nans(mapper.UTMy)
                    },
                    'pixel_coordinates': {
                        'x': self._clean_nans(mapper.x),
                        'y': self._clean_nans(mapper.y)
                    },
                    'approved': False  # Default to not approved
                }
                
                # Save shoreline data with consistent naming
                shoreline_json_path = os.path.join(shoreline_dir, f'shoreline_{name_without_ext}.json')
                save_json_file(shoreline_data, shoreline_json_path)
                
                shoreline_results.append(shoreline_data)
        
            self.logger.info(f"Shoreline Mapping Complete. Processed {len(shoreline_results)} images")
            return shoreline_results
            
        except Exception as e:
            self.logger.error(f"Error in shoreline mapping: {str(e)}")
            raise
    
    def _load_rectified_mask(self, image_index: int) -> Optional[np.ndarray]:
        """Load mask for rectified image if available."""
        # Try common mask first
        common_mask_path = os.path.join(self.site_manager.rectified_mask_dir, 'mask_common.npy')
        if os.path.exists(common_mask_path):
            return np.load(common_mask_path)
        
        # Fall back to per-image mask
        mask_path = os.path.join(self.site_manager.rectified_mask_dir, f'mask_{image_index}.npy')
        if os.path.exists(mask_path):
            return np.load(mask_path)
        
        return None
    
    def _clean_nans(self, arr: np.ndarray) -> List:
        """Replace NaN values with None for JSON serialization."""
        arr_list = arr.tolist()
        
        def replace_nan(obj):
            if isinstance(obj, list):
                return [replace_nan(item) for item in obj]
            elif isinstance(obj, float) and np.isnan(obj):
                return None
            else:
                return obj
        
        return replace_nan(arr_list)
    
    def check_setup_status(self) -> Dict[str, bool]:
        """Check if all required setup files exist."""
        status = {
            'control_image': False,
            'gcps': False,
            'mask': False,
            'database': False,
            'transects': False,
            'complete': False
        }
        
        # Check control image
        control_image_path = os.path.join(self.site_manager.target_img_dir, CONTROL_IMAGE_NAME)
        if os.path.exists(control_image_path):
            status['control_image'] = True
        
        # Check GCPs
        gcp_file_path = os.path.join(self.site_manager.target_img_dir, 'gcp_pixels.json')
        if os.path.exists(gcp_file_path):
            status['gcps'] = True
        
        # Check mask
        mask_path = os.path.join(self.site_manager.target_img_dir, 'roi_mask.npy')
        if os.path.exists(mask_path):
            status['mask'] = True
        
        # Check database
        if os.path.exists(self.db_path):
            try:
                db = readDB(self.db_path, self.site_manager.current_site)
                status['database'] = self.site_manager.current_site in db.all_sites
            except Exception:
                status['database'] = False
        
        # Check transects
        transects_path = os.path.join(
            self.site_manager.assets_dir, 
            f'SLtransects_{self.site_manager.current_site}.mat'
        )
        if os.path.exists(transects_path):
            status['transects'] = True
        
        # Complete if all exist
        status['complete'] = all([
            status['control_image'],
            status['gcps'],
            status['mask'],
            status['database'],
            status['transects']
        ])
        
        return status