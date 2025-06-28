"""
Site management service for handling CoastSnap site operations.
"""
import os
import json
from typing import Dict, List, Optional, Any
from datetime import datetime
from utils.logging_config import get_logger


class SiteManager:
    """Manages CoastSnap site configuration and switching."""
    
    def __init__(self, backend_dir: str, sites_file: str = 'sites.json'):
        self.backend_dir = backend_dir
        self.sites_file = os.path.join(backend_dir, sites_file)
        self.logger = get_logger(__name__)
        self.sites = self._load_sites()
        self._current_site = 'manly'  # Default site
        self._update_paths()
    
    def _load_sites(self) -> Dict[str, Dict[str, Any]]:
        """Load site registry from disk."""
        if os.path.exists(self.sites_file):
            try:
                with open(self.sites_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                self.logger.warning(f"Failed to read sites.json – {e}. Re-creating file.")
        
        # Default sites
        default_sites = {
            "manly": {"root_id": 242186}
        }
        # Save default sites to file
        try:
            with open(self.sites_file, 'w') as f:
                json.dump(default_sites, f, indent=4)
        except Exception as e:
            self.logger.error(f"Could not create default sites.json – {e}")
        return default_sites
    
    def _save_sites(self) -> None:
        """Persist site registry to disk."""
        try:
            with open(self.sites_file, 'w') as f:
                json.dump(self.sites, f, indent=4)
        except Exception as e:
            self.logger.error(f"Could not write sites.json – {e}")
            raise RuntimeError(f"Failed to save site configuration: {e}")
    
    def _update_paths(self) -> None:
        """Update all site-specific paths."""
        self.site_dir = os.path.join(self.backend_dir, self._current_site)
        self.raw_img_dir = os.path.join(self.site_dir, "Raw")
        self.target_img_dir = os.path.join(self.site_dir, "Target Image")
        self.rectified_mask_dir = os.path.join(self.site_dir, "Rectified", "Masks")
        self.rectified_dir = os.path.join(self.site_dir, "Rectified")
        self.registered_dir = os.path.join(self.site_dir, "Registered")
        self.shoreline_dir = os.path.join(self.site_dir, "Shorelines")
        self.assets_dir = os.path.join(self.site_dir, "Assets")
        self.overlays_dir = os.path.join(self.site_dir, "Overlays")
    
    @property
    def current_site(self) -> str:
        """Get current site name."""
        return self._current_site
    
    @property
    def current_site_config(self) -> Dict[str, Any]:
        """Get current site configuration."""
        return self.sites.get(self._current_site, {})
    
    def list_sites(self) -> List[Dict[str, Any]]:
        """Return list of all sites with their configurations."""
        return [{"site_name": k, **v} for k, v in self.sites.items()]
    
    def add_site(self, site_name: str, root_id: int) -> bool:
        """Add a new site to the registry."""
        self.sites[site_name] = {
            "root_id": root_id,
            "setup_complete": False,
            "setup_step": "download-images",
            "created_at": datetime.now().isoformat()
        }
        try:
            self._save_sites()
            self.logger.info(f"Added site '{site_name}' with root_id {root_id}")
            return True
        except Exception as e:
            # Remove the site from memory if save failed
            del self.sites[site_name]
            raise
    
    def set_site(self, site_name: str) -> None:
        """Switch to a different site."""
        if site_name not in self.sites:
            raise ValueError(f"Unknown site '{site_name}'")
        
        self._current_site = site_name
        self._update_paths()
    
    def site_exists(self, site_name: str) -> bool:
        """Check if a site exists in the registry."""
        return site_name in self.sites
    
    def get_site_root_id(self, site_name: str) -> Optional[int]:
        """Get root_id for a specific site."""
        site = self.sites.get(site_name)
        return site.get('root_id') if site else None
    
    def mark_setup_complete(self, site_name: str) -> None:
        """Mark a site's setup as complete."""
        if site_name not in self.sites:
            raise ValueError(f"Unknown site '{site_name}'")
        
        self.sites[site_name]['setup_complete'] = True
        self.sites[site_name]['completed_at'] = datetime.now().isoformat()
        self._save_sites()
        self.logger.info(f"Marked site '{site_name}' setup as complete")
    
    def update_setup_step(self, site_name: str, step: str) -> None:
        """Update the current setup step for a site."""
        if site_name not in self.sites:
            raise ValueError(f"Unknown site '{site_name}'")
        
        self.sites[site_name]['setup_step'] = step
        self._save_sites()
    
    def ensure_site_directories(self) -> bool:
        """Create all necessary directories for the current site."""
        dirs = [
            self.raw_img_dir,
            self.target_img_dir,
            self.rectified_mask_dir,
            self.rectified_dir,
            self.registered_dir,
            self.shoreline_dir,
            self.assets_dir,
            self.overlays_dir
        ]
        try:
            for directory in dirs:
                os.makedirs(directory, exist_ok=True)
            self.logger.info(f"Ensured all directories exist for site '{self.current_site}'")
            return True
        except Exception as e:
            self.logger.error(f"Failed to create directories: {e}")
            raise RuntimeError(f"Failed to create site directories: {e}")
    
    def delete_site(self, site_name: str) -> None:
        """Delete a site and all its associated data."""
        import shutil
        
        if site_name not in self.sites:
            raise ValueError(f"Unknown site '{site_name}'")
        
        # Delete site directory if it exists
        site_dir = os.path.join(self.backend_dir, site_name)
        if os.path.exists(site_dir):
            shutil.rmtree(site_dir)
            self.logger.info(f"Deleted directory for site '{site_name}'")
        
        # Remove from sites registry
        del self.sites[site_name]
        
        # Save updated sites list
        self._save_sites()
        
        # If we just deleted the current site, switch to another site or None
        if self._current_site == site_name:
            if self.sites:
                # Switch to the first available site
                self._current_site = next(iter(self.sites))
                self._update_paths()
            else:
                self._current_site = None
        
        self.logger.info(f"Successfully deleted site '{site_name}'")