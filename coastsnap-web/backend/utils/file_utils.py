"""
File system utilities for CoastSnap backend
"""
import os
from pathlib import Path
from typing import List, Optional
import cv2
import numpy as np
from PIL import Image
from constants import MAX_IMAGE_WIDTH, MAX_IMAGE_HEIGHT


def ensure_directory_exists(directory: str) -> None:
    """Create directory if it doesn't exist."""
    os.makedirs(directory, exist_ok=True)


def ensure_parent_directory_exists(filepath: str) -> None:
    """Create parent directory of a file if it doesn't exist."""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)


def list_image_files(directory: str, extensions: tuple = ('.jpg', '.jpeg', '.png')) -> List[str]:
    """
    List all image files in a directory.
    
    Args:
        directory: Directory to search
        extensions: Tuple of valid image extensions
        
    Returns:
        Sorted list of image filenames
    """
    if not os.path.isdir(directory):
        raise FileNotFoundError(f"Directory not found: {directory}")
    
    files = []
    for file in os.listdir(directory):
        if file.lower().endswith(extensions):
            files.append(file)
    
    # Sort with natural/numerical sorting for files like rectified_1.png, rectified_10.png
    import re
    def natural_sort_key(filename):
        # Split filename into text and number parts
        parts = re.split(r'(\d+)', filename)
        # Convert number parts to integers for proper sorting
        return [int(part) if part.isdigit() else part.lower() for part in parts]
    
    return sorted(files, key=natural_sort_key)


def resize_image_if_needed(image: np.ndarray, max_width: int = MAX_IMAGE_WIDTH, 
                          max_height: int = MAX_IMAGE_HEIGHT) -> np.ndarray:
    """
    Resize image if it exceeds maximum dimensions.
    
    Args:
        image: Input image as numpy array
        max_width: Maximum allowed width
        max_height: Maximum allowed height
        
    Returns:
        Resized image or original if within limits
    """
    height, width = image.shape[:2]
    
    if width > max_width or height > max_height:
        # Calculate aspect ratio preserving scale
        scale = min(max_width / width, max_height / height)
        new_width = int(width * scale)
        new_height = int(height * scale)
        return cv2.resize(image, (new_width, new_height))
    
    return image


def save_json_file(data: dict, filepath: str) -> None:
    """Save data to JSON file with proper formatting."""
    import json
    ensure_parent_directory_exists(filepath)
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=4)


def load_json_file(filepath: str) -> dict:
    """Load data from JSON file."""
    import json
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"JSON file not found: {filepath}")
    
    with open(filepath, 'r') as f:
        return json.load(f)


def safe_file_path(*parts: str) -> str:
    """
    Safely join path components using os.path.join.
    
    Args:
        *parts: Path components to join
        
    Returns:
        Joined path string
    """
    return os.path.join(*parts)


def get_file_extension(filename: str) -> str:
    """Get file extension in lowercase."""
    return os.path.splitext(filename)[1].lower()


def is_image_file(filename: str) -> bool:
    """Check if file is an image based on extension."""
    return get_file_extension(filename) in {'.jpg', '.jpeg', '.png', '.bmp', '.tiff'}