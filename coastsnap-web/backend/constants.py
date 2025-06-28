"""
Constants and configuration values for CoastSnap backend
"""
import os

# Base directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Directory names
RAW_DIR = 'Raw'
REGISTERED_DIR = 'Registered'
RECTIFIED_DIR = 'Rectified'
SHORELINES_DIR = 'Shorelines'
OVERLAYS_DIR = 'Overlays'

# Image processing constants
MAX_IMAGE_WIDTH = 800
MAX_IMAGE_HEIGHT = 600

# Registration parameters
REGISTRATION_N = 50  # Number of points to sample in x direction
REGISTRATION_M = 50  # Number of points to sample in y direction
REGISTRATION_MAX_FEATURES = 2048
REGISTRATION_THRESHOLD = 0.9

# File names
CONTROL_IMAGE_NAME = 'control.jpg'
DATABASE_NAME = 'database.xlsx'


# API response messages
MSG_SITE_SET = "Site set to {site_name}"
MSG_SITE_ADDED = "Site {site_name} added successfully"
MSG_IMAGES_DOWNLOADED = "{count} images downloaded successfully"
MSG_CONTROL_IMAGE_SET = "Control image set to {image_name}"
MSG_GCP_PIXELS_SAVED = "GCP pixel coordinates saved"
MSG_MASK_SAVED = "Mask saved successfully"
MSG_PROCESSING_COMPLETE = "Processing complete. {registered} registered, {failed} failed."
MSG_SHORELINE_MAPPING_COMPLETE = "Shoreline mapping complete for {count} images"
MSG_OVERLAYS_GENERATED = "Overlay images generated"

# Coordinate conversion bounds (from types/index.ts)
WORLD_BOUNDS = {
    'xMin': -400,
    'xMax': 100,
    'yMin': 0,
    'yMax': 600
}

# Colors for visualization (BGR format for OpenCV)
COLOR_LIME = (0, 255, 0)
COLOR_YELLOW = (0, 255, 255)
COLOR_GREEN = (0, 255, 0)

# Shoreline detection parameters
SHORELINE_SAMPLE_POINTS = 50  # Target number of points for shoreline