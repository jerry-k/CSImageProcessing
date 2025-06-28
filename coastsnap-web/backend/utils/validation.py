"""
Input validation utilities for CoastSnap backend
"""
import os
import re
from typing import List, Tuple


def validate_polygon(polygon: List[List[float]]) -> bool:
    """
    Validate polygon has correct format and reasonable coordinates.
    
    Args:
        polygon: List of [x, y] coordinate pairs
        
    Returns:
        True if valid
        
    Raises:
        ValueError: If polygon is invalid
    """
    if not isinstance(polygon, list):
        raise ValueError("Polygon must be a list")
    
    if len(polygon) < 3:
        raise ValueError("Polygon must have at least 3 points")
    
    for i, point in enumerate(polygon):
        if not isinstance(point, list) or len(point) != 2:
            raise ValueError(f"Point {i} must be a list of [x, y]")
        
        x, y = point
        if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
            raise ValueError(f"Point {i} coordinates must be numbers")
        
        # Check for reasonable coordinate values
        if not (-10000 <= x <= 10000) or not (-10000 <= y <= 10000):
            raise ValueError(f"Point {i} coordinates out of reasonable range")
    
    return True


def validate_gcp_data(gcps: List[dict]) -> bool:
    """
    Validate GCP data structure.
    
    Args:
        gcps: List of GCP dictionaries
        
    Returns:
        True if valid
        
    Raises:
        ValueError: If data is invalid
    """
    if not isinstance(gcps, list):
        raise ValueError("GCPs must be a list")
    
    if len(gcps) == 0:
        raise ValueError("At least one GCP is required")
    
    required_fields = {'name', 'x', 'y', 'z', 'u', 'v'}
    
    for i, gcp in enumerate(gcps):
        if not isinstance(gcp, dict):
            raise ValueError(f"GCP {i} must be a dictionary")
        
        missing_fields = required_fields - set(gcp.keys())
        if missing_fields:
            raise ValueError(f"GCP {i} missing fields: {missing_fields}")
        
        # Validate numeric fields
        for field in ['x', 'y', 'z', 'u', 'v']:
            if not isinstance(gcp[field], (int, float)):
                raise ValueError(f"GCP {i} field '{field}' must be numeric")
    
    return True


def validate_image_index(index: int, max_index: int) -> bool:
    """
    Validate image index is within bounds.
    
    Args:
        index: The index to validate
        max_index: Maximum valid index
        
    Returns:
        True if valid
        
    Raises:
        ValueError: If index is invalid
    """
    if not isinstance(index, int):
        raise ValueError("Image index must be an integer")
    
    if index < 0:
        raise ValueError("Image index must be non-negative")
    
    if index > max_index:
        raise ValueError(f"Image index {index} exceeds maximum {max_index}")
    
    return True


def validate_file_extension(filename: str, allowed_extensions: Tuple[str, ...]) -> bool:
    """
    Validate file has allowed extension.
    
    Args:
        filename: Name of file to check
        allowed_extensions: Tuple of allowed extensions (e.g., ('.jpg', '.png'))
        
    Returns:
        True if valid
        
    Raises:
        ValueError: If extension is not allowed
    """
    ext = os.path.splitext(filename)[1].lower()
    
    if ext not in allowed_extensions:
        raise ValueError(
            f"File extension '{ext}' not allowed. "
            f"Allowed extensions: {', '.join(allowed_extensions)}"
        )
    
    return True


def validate_site_name(site_name: str) -> bool:
    """
    Validate site name follows naming conventions.
    
    Args:
        site_name: Name to validate
        
    Returns:
        True if valid
        
    Raises:
        ValueError: If name is invalid
    """
    if not site_name:
        raise ValueError("Site name cannot be empty")
    
    if len(site_name) > 50:
        raise ValueError("Site name too long (max 50 characters)")
    
    # Allow only alphanumeric, underscore, and hyphen
    if not re.match(r'^[a-zA-Z0-9_-]+$', site_name):
        raise ValueError(
            "Site name can only contain letters, numbers, underscore, and hyphen"
        )
    
    return True


def validate_download_count(num_images: int) -> bool:
    """
    Validate number of images to download is reasonable.
    
    Args:
        num_images: Number of images requested
        
    Returns:
        True if valid
        
    Raises:
        ValueError: If count is invalid
    """
    if not isinstance(num_images, int):
        raise ValueError("Number of images must be an integer")
    
    if num_images < 1:
        raise ValueError("Must download at least 1 image")
    
    if num_images > 100:
        raise ValueError("Cannot download more than 100 images at once")
    
    return True