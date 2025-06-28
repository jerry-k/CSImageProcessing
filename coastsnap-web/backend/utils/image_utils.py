"""
Image processing utilities for CoastSnap backend
"""
import numpy as np
from PIL import Image, ImageDraw
from typing import List, Tuple, Optional


def create_mask_from_polygons(polygons: List[List[List[float]]], 
                            image_size: Tuple[int, int]) -> np.ndarray:
    """
    Create a binary mask from polygon data.
    
    Args:
        polygons: List of polygons, each polygon is a list of [x, y] points
        image_size: Tuple of (width, height) for the mask
        
    Returns:
        Binary mask as numpy array
    """
    width, height = image_size
    mask_img = Image.new('L', (width, height), 0)
    draw = ImageDraw.Draw(mask_img)
    
    for polygon_points in polygons:
        if len(polygon_points) >= 2:
            # Flatten points from [[x1,y1], [x2,y2]] to [x1,y1,x2,y2]
            flat_points = [coord for point in polygon_points for coord in point]
            draw.polygon(flat_points, outline=255, fill=255)
    
    return np.array(mask_img)


def create_masked_preview(image_path: str, mask: np.ndarray, 
                         output_path: str) -> None:
    """
    Create a preview image with mask applied.
    
    Args:
        image_path: Path to source image
        mask: Binary mask array
        output_path: Path to save preview image
    """
    with Image.open(image_path) as img:
        img_rgba = img.convert("RGBA")
        mask_img = Image.fromarray(mask.astype(np.uint8))
        
        # Create transparent image with mask
        result = Image.new("RGBA", img.size, (0, 0, 0, 0))
        result.paste(img_rgba, mask=mask_img)
        result.save(output_path)


def draw_line_on_image(image: np.ndarray, points: List[Tuple[int, int]], 
                      color: Tuple[int, int, int], thickness: int = 2) -> np.ndarray:
    """
    Draw a line on an image connecting the given points.
    
    Args:
        image: Input image
        points: List of (x, y) coordinates
        color: BGR color tuple
        thickness: Line thickness
        
    Returns:
        Image with line drawn
    """
    import cv2
    result = image.copy()
    
    for i in range(len(points) - 1):
        cv2.line(result, points[i], points[i + 1], color, thickness)
    
    return result


def validate_image_dimensions(image_path: str) -> Tuple[int, int]:
    """
    Get and validate image dimensions.
    
    Args:
        image_path: Path to image file
        
    Returns:
        Tuple of (width, height)
        
    Raises:
        ValueError: If image cannot be loaded
    """
    try:
        with Image.open(image_path) as img:
            return img.size
    except Exception as e:
        raise ValueError(f"Cannot load image {image_path}: {str(e)}")


def convert_points_format(points: List[dict]) -> List[List[float]]:
    """
    Convert points from dict format {x, y} to list format [x, y].
    
    Args:
        points: List of point dictionaries with 'x' and 'y' keys
        
    Returns:
        List of [x, y] coordinate pairs
    """
    converted = []
    for point in points:
        if isinstance(point, dict) and 'x' in point and 'y' in point:
            converted.append([point['x'], point['y']])
        elif isinstance(point, (list, tuple)) and len(point) >= 2:
            converted.append([point[0], point[1]])
    return converted