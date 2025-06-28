"""
Ground Control Point (GCP) service for managing GCP selection and storage.
"""
import os
import json
from typing import List, Dict, Any, Optional
from imageprocessing.readDB import readDB

from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from services.site_manager import SiteManager


class GCPService:
    """Manages Ground Control Points for image rectification."""
    
    def __init__(self, site_manager: 'SiteManager', db_path: str) -> None:
        self.site_manager = site_manager
        self.db_path = db_path
    
    def get_gcps_from_database(self) -> List[Dict[str, Any]]:
        """Read GCPs from Excel database for current site."""
        if not os.path.exists(self.db_path):
            raise FileNotFoundError(f"Database not found at {self.db_path}")
        
        db = readDB(self.db_path, self.site_manager.current_site)
        return db.gcp
    
    def save_gcp_pixels(self, gcps: List[Dict[str, Any]]) -> str:
        """
        Save selected GCP pixel coordinates.
        
        Args:
            gcps: List of GCP dictionaries with name, x, y, z, u, v fields
        
        Returns:
            Path to saved file
        """
        # Ensure target directory exists
        os.makedirs(self.site_manager.target_img_dir, exist_ok=True)
        save_path = os.path.join(self.site_manager.target_img_dir, 'gcp_pixels.json')
        
        with open(save_path, 'w') as f:
            json.dump(gcps, f, indent=4)
        
        return save_path
    
    def load_gcp_pixels(self) -> Optional[List[Dict[str, Any]]]:
        """Load saved GCP pixel coordinates."""
        gcp_path = os.path.join(self.site_manager.target_img_dir, 'gcp_pixels.json')
        if not os.path.exists(gcp_path):
            return None
        
        with open(gcp_path, 'r') as f:
            return json.load(f)
    
    def reset_gcp_pixels(self) -> bool:
        """Clear saved GCP pixel selections."""
        try:
            gcp_file = os.path.join(self.site_manager.target_img_dir, 'gcp_pixels.json')
            if os.path.exists(gcp_file):
                os.remove(gcp_file)
                return True
            return False
        except Exception:
            raise
    
    def validate_gcps(self, gcps: List[Dict[str, Any]]) -> bool:
        """
        Validate that GCP data is complete and valid.
        
        Args:
            gcps: List of GCP dictionaries
        
        Returns:
            True if valid, raises ValueError if not
        """
        if not gcps:
            raise ValueError("No GCP data provided")
        
        required_fields = ['name', 'x', 'y', 'z', 'u', 'v']
        for i, gcp in enumerate(gcps):
            for field in required_fields:
                if field not in gcp:
                    raise ValueError(f"GCP {i} missing required field: {field}")
                
                # Check that u, v are not skipped values (-1)
                if field in ['u', 'v'] and gcp[field] == -1:
                    raise ValueError(f"GCP '{gcp.get('name', i)}' has invalid pixel coordinate")
        
        return True