"""
Flask application using service layer architecture.
"""
import os
import sys
import json
import traceback
from flask import Flask, jsonify, request, send_from_directory, send_file
from flask_cors import CORS

# Add parent directory to path for imageprocessing imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import services
from services.site_manager import SiteManager
from services.image_service import ImageService
from services.gcp_service import GCPService
from services.processing_service import ProcessingService
from services.shoreline_service import ShorelineService
from imageprocessing.images import download_images
from utils.logging_config import setup_logging, get_logger
from constants import (
    MSG_SITE_ADDED, MSG_SITE_SET, MSG_IMAGES_DOWNLOADED,
    MSG_CONTROL_IMAGE_SET, MSG_GCP_PIXELS_SAVED, MSG_MASK_SAVED,
    MSG_PROCESSING_COMPLETE, MSG_SHORELINE_MAPPING_COMPLETE,
    MSG_OVERLAYS_GENERATED, DATABASE_NAME, CONTROL_IMAGE_NAME
)

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Setup logging
setup_logging()
logger = get_logger(__name__)
logger.info("Starting CoastSnap backend server")

# Initialize services
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BACKEND_DIR, 'CoastSnapDB.xlsx')

site_manager = SiteManager(BACKEND_DIR)
image_service = ImageService(site_manager)
gcp_service = GCPService(site_manager, DB_PATH)
processing_service = ProcessingService(site_manager, DB_PATH)
shoreline_service = ShorelineService(site_manager, DB_PATH)


# -----------------------------------------------------------------------------
# Error handlers
# -----------------------------------------------------------------------------

@app.errorhandler(FileNotFoundError)
def handle_file_not_found(e):
    return jsonify({"error": str(e)}), 404


@app.errorhandler(ValueError)
def handle_value_error(e):
    return jsonify({"error": str(e)}), 400


@app.errorhandler(Exception)
def handle_general_error(e):
    traceback.print_exc()
    return jsonify({"error": f"An error occurred: {str(e)}"}), 500


# -----------------------------------------------------------------------------
# Frontend serving
# -----------------------------------------------------------------------------

# Path to the built frontend
FRONTEND_DIR = os.path.join(os.path.dirname(BACKEND_DIR), 'frontend', 'coastsnap-ui', 'dist')

@app.route('/')
@app.route('/<path:path>')
def serve_frontend(path=''):
    """Serve the frontend application."""
    if path and os.path.exists(os.path.join(FRONTEND_DIR, path)):
        return send_from_directory(FRONTEND_DIR, path)
    else:
        # For all routes, return index.html (React Router will handle client-side routing)
        return send_file(os.path.join(FRONTEND_DIR, 'index.html'))


# -----------------------------------------------------------------------------
# Site management endpoints
# -----------------------------------------------------------------------------

@app.route("/api/sites", methods=["GET"])
def list_sites():
    """Return the registry of known sites."""
    return jsonify(site_manager.list_sites())


@app.route("/api/add_site", methods=["POST"])
def add_site():
    """Add a new CoastSnap site to the registry."""
    data = request.get_json()
    site_name = data.get("site_name")
    root_id = data.get("root_id")

    if not site_name or root_id is None:
        return jsonify({"error": "site_name and root_id are required"}), 400

    site_manager.add_site(site_name, int(root_id))
    site_manager.set_site(site_name)
    logger.info(f"Added new site: {site_name} with root_id: {root_id}")

    return jsonify({"message": MSG_SITE_ADDED.format(site_name=site_name)}), 200


@app.route("/api/set_site/<string:site_name>", methods=["POST"])
def set_site(site_name):
    """Switch the backend's active site."""
    if not site_manager.site_exists(site_name):
        return jsonify({"error": f"Unknown site '{site_name}'"}), 404

    site_manager.set_site(site_name)
    return jsonify({"message": MSG_SITE_SET.format(site_name=site_name)}), 200


@app.route('/api/sites/<string:site_name>', methods=['DELETE'])
def delete_site(site_name):
    """Delete a site and all its data."""
    try:
        if not site_manager.site_exists(site_name):
            return jsonify({"error": f"Site '{site_name}' not found"}), 404
        
        # Delete the site
        site_manager.delete_site(site_name)
        
        return jsonify({"message": f"Successfully deleted site '{site_name}' and all associated data"}), 200
    except Exception as e:
        logger.error(f"Error deleting site: {e}")
        return jsonify({"error": f"Failed to delete site: {str(e)}"}), 500


@app.route('/api/sites/<string:site_name>/complete_setup', methods=['POST'])
def complete_setup(site_name):
    """Mark a site's setup as complete."""
    try:
        if not site_manager.site_exists(site_name):
            return jsonify({"error": f"Site '{site_name}' not found"}), 404
        
        site_manager.mark_setup_complete(site_name)
        
        return jsonify({"message": f"Setup completed for site '{site_name}'"}), 200
    except Exception as e:
        logger.error(f"Error completing setup: {e}")
        return jsonify({"error": f"Failed to complete setup: {str(e)}"}), 500


# -----------------------------------------------------------------------------
# Image management endpoints
# -----------------------------------------------------------------------------

@app.route('/api/download_new_snaps', methods=['POST'])
def handle_download_new_snaps():
    """Download new snaps for a site."""
    try:
        req = request.get_json(silent=True) or {}
        site_name = req.get("site_name", site_manager.current_site)
        num_images = int(req.get("num_images", 5))
        topic_id = 37  # Fixed CoastSnap topic

        if site_manager.site_exists(site_name):
            root_id = site_manager.get_site_root_id(site_name)
        else:
            root_id = req.get("root_id")
            if root_id is None:
                return jsonify({"error": "Unknown site – please supply root_id"}), 400

        # Ensure backend paths point at the requested site
        site_manager.set_site(site_name)
        site_manager.ensure_site_directories()

        logger.info(f"Initiating download for site: {site_name} (topic_id={topic_id}, root_id={root_id})")

        downloaded_files = download_images(
            site_name=site_name,
            topic_id=topic_id,
            root_id=root_id,
            no_images=num_images,
        )

        return jsonify({
            "message": MSG_IMAGES_DOWNLOADED.format(count=len(downloaded_files)),
            "new_files": downloaded_files
        }), 200

    except Exception as e:
        logger.error(f"Error during image download: {e}")
        return jsonify({"error": f"Failed to download images: {str(e)}"}), 500


@app.route('/api/raw_images', methods=['GET'])
def get_raw_images():
    """Get list of raw images for the site."""
    images = image_service.list_raw_images()
    return jsonify(images)


@app.route('/api/images/raw/<path:filename>')
def get_raw_image(filename):
    """Serve a single raw image."""
    return send_from_directory(site_manager.raw_img_dir, filename)


@app.route('/api/select_control_image', methods=['POST'])
def select_control_image():
    """Select a control image from raw images."""
    data = request.get_json()
    filename = data.get('filename')

    if not filename:
        return jsonify({"error": "Filename not provided."}), 400

    path = image_service.select_control_image(filename)
    return jsonify({
        "message": MSG_CONTROL_IMAGE_SET.format(image_name=filename),
        "control_image_path": path
    }), 200


@app.route('/api/upload_control_image', methods=['POST'])
def upload_control_image():
    """Upload a custom control image."""
    if 'control_image' not in request.files:
        return jsonify({"error": "No control image file provided."}), 400

    file = request.files['control_image']
    if file.filename == '':
        return jsonify({"error": "No file selected."}), 400

    path = image_service.save_control_image_from_upload(file)
    return jsonify({
        "message": f"Custom control image '{file.filename}' uploaded successfully",
        "path": path
    }), 200


@app.route('/api/images/control')
def get_control_image():
    """Serve the selected control image."""
    return send_from_directory(site_manager.target_img_dir, CONTROL_IMAGE_NAME)


# -----------------------------------------------------------------------------
# GCP endpoints
# -----------------------------------------------------------------------------

@app.route('/api/gcps', methods=['GET'])
def get_gcps():
    """Get all GCPs from the database for current site."""
    gcp_data = gcp_service.get_gcps_from_database()
    return jsonify(gcp_data)


@app.route('/api/save_gcp_pixels', methods=['POST'])
def save_gcp_pixels():
    """Save selected GCP pixel coordinates."""
    data = request.get_json()
    if not data or 'gcps' not in data:
        return jsonify({"error": "Invalid data format."}), 400

    path = gcp_service.save_gcp_pixels(data['gcps'])
    return jsonify({"message": MSG_GCP_PIXELS_SAVED}), 200


@app.route('/api/reset_gcp_pixels', methods=['POST'])
def reset_gcp_pixels():
    """Clear GCP pixel selections."""
    try:
        success = gcp_service.reset_gcp_pixels()
        if success:
            logger.info("GCP pixel selections cleared successfully")
            return jsonify({"message": "GCP pixel selections cleared."}), 200
        else:
            logger.info("No GCP selections to clear")
            return jsonify({"message": "No GCP selections to clear."}), 200
    except Exception as e:
        logger.error(f"Error resetting GCP pixels: {str(e)}")
        return jsonify({"error": str(e)}), 500


# -----------------------------------------------------------------------------
# Mask creation endpoints
# -----------------------------------------------------------------------------

@app.route('/api/save_mask', methods=['POST'])
def save_mask():
    """Save control image mask."""
    data = request.get_json()
    polygons = data.get('polygons')

    if not polygons:
        return jsonify({"error": "No polygon data received."}), 400

    result = image_service.create_mask(polygons, mask_type='control')
    return jsonify({"message": MSG_MASK_SAVED}), 200


@app.route('/api/save_rectified_mask/<int:image_index>', methods=['POST'])
def save_rectified_mask(image_index):
    """Save mask for rectified image."""
    data = request.get_json()
    polygons = data.get('polygons')

    if not polygons:
        return jsonify({"error": "No polygon data received."}), 400

    result = image_service.create_rectified_mask(polygons, image_index)
    return jsonify({"message": "Rectified mask saved (applies to all rectified images)."}), 200


# -----------------------------------------------------------------------------
# Processing endpoints
# -----------------------------------------------------------------------------

@app.route('/api/check_setup', methods=['GET'])
def check_setup():
    """Check if all setup files exist."""
    setup_status = processing_service.check_setup_status()
    return jsonify(setup_status), 200


@app.route('/api/run_processing', methods=['POST'])
def run_processing():
    """Run the full registration and rectification pipeline."""
    request_data = request.get_json(silent=True) or {}
    skip_mapping = bool(request_data.get('skip_shoreline_mapping', False))

    result = processing_service.run_registration_and_rectification(skip_mapping)

    if skip_mapping:
        return jsonify({
            "message": "Registration and rectification completed successfully. Shoreline mapping skipped."
        }), 200
    else:
        return jsonify({
            "message": "Full processing completed successfully.",
            "shoreline_results": result.get("shoreline_results", []),
            "num_images": result.get("num_images", 0)
        }), 200


@app.route('/api/run_shoreline_mapping', methods=['POST'])
def run_shoreline_mapping():
    """Run shoreline detection on rectified images."""
    shoreline_results = processing_service.run_shoreline_mapping()
    return jsonify({
        "message": MSG_SHORELINE_MAPPING_COMPLETE.format(count=len(shoreline_results)),
        "shoreline_results": shoreline_results,
        "num_images": len(shoreline_results)
    }), 200


# -----------------------------------------------------------------------------
# Shoreline editing endpoints
# -----------------------------------------------------------------------------

@app.route('/api/shoreline_data/<int:image_index>')
def get_shoreline_data(image_index):
    """Get shoreline data for a specific image."""
    data = shoreline_service.get_shoreline_data(image_index)
    return jsonify(data)


@app.route('/api/save_shoreline', methods=['POST'])
def save_edited_shoreline():
    """Save manually edited shoreline data."""
    data = request.get_json()
    image_index = data.get('image_index')
    edited_points = data.get('shoreline_points')

    if image_index is None or not edited_points:
        return jsonify({"error": "Missing image_index or shoreline_points."}), 400

    shoreline_service.save_edited_shoreline(image_index, edited_points)
    return jsonify({"message": f"Edited shoreline for image {image_index} saved successfully."}), 200


@app.route('/api/reset_shoreline/<int:image_index>', methods=['POST'])
def reset_shoreline(image_index):
    """Reset shoreline data to original detection."""
    shoreline_service.reset_shoreline(image_index)
    return jsonify({"message": f"Shoreline for image {image_index} reset to original detection."}), 200


@app.route('/api/approve_shoreline/<int:image_index>', methods=['POST'])
def approve_shoreline(image_index):
    """Mark a shoreline as approved."""
    try:
        shoreline_service.approve_shoreline(image_index)
        return jsonify({"message": f"Shoreline for image {image_index} approved."}), 200
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": f"Failed to approve shoreline: {str(e)}"}), 500



@app.route('/api/shoreline_statuses')
def get_all_shoreline_statuses():
    """Get approval status for all shorelines in one batch call."""
    try:
        # Get total number of images from image service
        images = image_service.list_rectified_images()
        total_images = len(images)
        
        # Collect approval status for all images
        statuses = {}
        for i in range(total_images):
            try:
                data = shoreline_service.get_shoreline_data(i)
                statuses[i] = data.get('approved', False)
            except Exception as e:
                # If shoreline data doesn't exist, default to False
                statuses[i] = False
        
        return jsonify({
            "statuses": statuses,
            "total": total_images
        }), 200
    except Exception as e:
        return jsonify({"error": f"Failed to get shoreline statuses: {str(e)}"}), 500


# -----------------------------------------------------------------------------
# Image serving endpoints
# -----------------------------------------------------------------------------

@app.route('/api/rectified_images', methods=['GET'])
def list_rectified_images():
    """Return list of rectified image filenames."""
    files = image_service.list_rectified_images()
    return jsonify(files), 200


@app.route('/api/images/rectified/<path:filename>')
def get_rectified_image(filename):
    """Serve rectified images."""
    return send_from_directory(site_manager.rectified_dir, filename)


@app.route('/api/images/rectified/<int:image_index>')
def get_rectified_image_by_index(image_index):
    """Serve rectified images by index."""
    files = image_service.list_rectified_images()
    if image_index < 0 or image_index >= len(files):
        return jsonify({"error": f"Invalid image index {image_index}"}), 404
    return send_from_directory(site_manager.rectified_dir, files[image_index])


@app.route('/api/images/rectified_with_shoreline/<int:image_index>')
def get_rectified_with_shoreline_by_index(image_index):
    """Serve rectified images with shoreline overlays."""
    shoreline_image_path = os.path.join(
        site_manager.shoreline_dir,
        f'rectified_with_shoreline_{image_index}.png'
    )
    
    if os.path.exists(shoreline_image_path):
        return send_from_directory(
            site_manager.shoreline_dir,
            f'rectified_with_shoreline_{image_index}.png'
        )
    else:
        return jsonify({"error": f"Shoreline overlay for index {image_index} not found."}), 404


@app.route('/api/images/registered/<int:image_index>')
def get_registered_image_by_index(image_index):
    """Serve registered images by index."""
    files = image_service.list_registered_images()
    if image_index < 0 or image_index >= len(files):
        return jsonify({"error": f"Invalid image index {image_index}"}), 404
    return send_from_directory(site_manager.registered_dir, files[image_index])


@app.route('/api/images/registered_with_shoreline/<int:image_index>')
def get_registered_image_with_shoreline(image_index):
    """Generate and serve registered image with shoreline overlay."""
    import tempfile
    try:
        # Generate overlay
        overlay_bytes = shoreline_service.generate_registered_overlay(image_index)
        
        # Save to temp file and serve
        temp_dir = tempfile.gettempdir()
        temp_filename = f"registered_shoreline_{image_index}_{hash(overlay_bytes)}.jpg"
        temp_path = os.path.join(temp_dir, temp_filename)
        
        with open(temp_path, 'wb') as f:
            f.write(overlay_bytes)
        
        return send_from_directory(temp_dir, temp_filename)
    except Exception as e:
        logger.error(f"Error generating overlay for image {image_index}: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/download_registered_overlays', methods=['GET'])
def create_registered_overlays():
    """Generate overlay images for all registered images."""
    result = shoreline_service.generate_all_overlays()
    return jsonify({
        "message": f"Generated {result['generated_count']} overlay images",
        "folder": result['folder']
    }), 200


# -----------------------------------------------------------------------------
# Helper functions for metrics
# -----------------------------------------------------------------------------

def calculate_site_metrics(site_manager):
    """
    Calculate metrics for the current site set in site_manager.
    
    Returns a dictionary with:
    - raw_count: Number of raw images
    - rectified_count: Number of rectified images
    - registered_count: Number of registered images
    - shoreline_count: Number of shoreline .mat files
    - unapproved_count: Number of unapproved shorelines
    - last_processed: Timestamp of most recently processed image
    """
    # Count images in different directories
    raw_count = len([f for f in os.listdir(site_manager.raw_img_dir) 
                     if f.lower().endswith(('.jpg', '.jpeg', '.png'))]) if os.path.exists(site_manager.raw_img_dir) else 0
    
    rectified_count = len([f for f in os.listdir(site_manager.rectified_dir) 
                          if f.lower().endswith(('.jpg', '.jpeg', '.png'))]) if os.path.exists(site_manager.rectified_dir) else 0
    
    registered_count = len([f for f in os.listdir(site_manager.registered_dir) 
                           if f.lower().endswith(('.jpg', '.jpeg', '.png'))]) if os.path.exists(site_manager.registered_dir) else 0
    
    shoreline_count = len([f for f in os.listdir(site_manager.shoreline_dir) 
                          if f.endswith('.mat')]) if os.path.exists(site_manager.shoreline_dir) else 0
    
    # Count unapproved shorelines
    unapproved_count = 0
    if os.path.exists(site_manager.shoreline_dir):
        json_files = [f for f in os.listdir(site_manager.shoreline_dir) 
                     if f.startswith('shoreline_') and f.endswith('.json')]
        for json_file in json_files:
            try:
                with open(os.path.join(site_manager.shoreline_dir, json_file), 'r') as f:
                    data = json.load(f)
                    if not data.get('approved', False):
                        unapproved_count += 1
            except:
                # If we can't read the file, assume it needs approval
                unapproved_count += 1
    
    # Get last processing time from newest file
    last_processed = None
    if os.path.exists(site_manager.rectified_dir):
        files = [f for f in os.listdir(site_manager.rectified_dir) 
                if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        if files:
            newest_file = max(files, key=lambda f: os.path.getmtime(os.path.join(site_manager.rectified_dir, f)))
            last_processed = os.path.getmtime(os.path.join(site_manager.rectified_dir, newest_file))
    
    return {
        'raw_count': raw_count,
        'rectified_count': rectified_count,
        'registered_count': registered_count,
        'shoreline_count': shoreline_count,
        'unapproved_count': unapproved_count,
        'last_processed': last_processed
    }


# -----------------------------------------------------------------------------
# Dashboard and metrics endpoints
# -----------------------------------------------------------------------------

@app.route('/api/sites/<string:site_name>/metrics', methods=['GET'])
def get_site_metrics(site_name):
    """Get metrics for a specific site."""
    try:
        if not site_manager.site_exists(site_name):
            return jsonify({"error": f"Site '{site_name}' not found"}), 404
        
        # Temporarily set site to get correct paths
        previous_site = site_manager.current_site
        site_manager.set_site(site_name)
        
        # Get metrics using helper function
        metrics = calculate_site_metrics(site_manager)
        
        # Restore previous site
        site_manager.set_site(previous_site)
        
        return jsonify({
            "site_name": site_name,
            "raw_image_count": metrics['raw_count'],
            "rectified_count": metrics['rectified_count'],
            "registered_count": metrics['registered_count'],
            "shoreline_count": metrics['shoreline_count'],
            "pending_count": metrics['unapproved_count'],
            "last_processed": metrics['last_processed'],
            "setup_complete": site_manager.sites.get(site_name, {}).get('setup_complete', True)
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting metrics for site {site_name}: {e}")
        return jsonify({"error": f"Failed to get metrics: {str(e)}"}), 500


@app.route('/api/metrics/all', methods=['GET'])
def get_all_site_metrics():
    """Get metrics for all sites."""
    try:
        metrics = []
        current_site = site_manager.current_site
        
        # If no sites exist, return empty metrics
        if not site_manager.sites:
            return jsonify(metrics), 200
        
        for site_name in site_manager.sites.keys():
            try:
                # Get metrics for each site
                site_manager.set_site(site_name)
                
                # Get metrics using helper function
                site_metrics = calculate_site_metrics(site_manager)
                
                metrics.append({
                    "site_name": site_name,
                    "image_count": site_metrics['raw_count'],
                    "pending_count": site_metrics['unapproved_count'],
                    "last_processed": site_metrics['last_processed'],
                    "shoreline_count": site_metrics['shoreline_count'],
                    "setup_complete": site_manager.sites.get(site_name, {}).get('setup_complete', True)
                })
            except Exception as e:
                logger.error(f"Error getting metrics for {site_name}: {e}")
                continue
        
        # Only restore site if it still exists
        if current_site and site_manager.site_exists(current_site):
            site_manager.set_site(current_site)
        
        return jsonify(metrics), 200
        
    except Exception as e:
        logger.error(f"Error getting all site metrics: {e}")
        return jsonify({"error": f"Failed to get metrics: {str(e)}"}), 500


@app.route('/api/activity/recent', methods=['GET'])
def get_recent_activity():
    """Get recent processing activity across all sites."""
    try:
        activities = []
        current_site = site_manager.current_site
        
        # Check log files for recent activity
        log_dir = os.path.join(BACKEND_DIR, 'logs')
        if os.path.exists(log_dir):
            log_files = sorted([f for f in os.listdir(log_dir) if f.startswith('coastsnap_')], reverse=True)[:10]
            
            for log_file in log_files:
                try:
                    log_path = os.path.join(log_dir, log_file)
                    timestamp = os.path.getmtime(log_path)
                    
                    # Parse log to find site and activity type
                    with open(log_path, 'r') as f:
                        content = f.read()
                        site_match = None
                        activity_type = 'processing'
                        
                        if 'site:' in content:
                            site_match = content.split('site:')[1].split()[0]
                        elif 'Added new site:' in content:
                            site_match = content.split('Added new site:')[1].split()[0]
                            activity_type = 'site_added'
                        
                        if site_match:
                            activities.append({
                                "timestamp": timestamp,
                                "site": site_match,
                                "type": activity_type,
                                "message": f"Processing completed" if activity_type == 'processing' else f"Site {site_match} added"
                            })
                except Exception as e:
                    logger.error(f"Error parsing log {log_file}: {e}")
                    continue
        
        # Only restore site if it still exists
        if current_site and site_manager.site_exists(current_site):
            site_manager.set_site(current_site)
        
        # Sort by timestamp and limit to 10 most recent
        activities.sort(key=lambda x: x['timestamp'], reverse=True)
        return jsonify(activities[:10]), 200
        
    except Exception as e:
        logger.error(f"Error getting recent activity: {e}")
        return jsonify({"error": f"Failed to get activity: {str(e)}"}), 500


# -----------------------------------------------------------------------------
# Database and asset upload endpoints
# -----------------------------------------------------------------------------

@app.route('/api/upload_database', methods=['POST'])
def upload_database():
    """Accept an .xlsx workbook as the CoastSnap DB."""
    if 'database' not in request.files:
        return jsonify({"error": "No file part 'database' found."}), 400

    file = request.files['database']
    if file.filename == '':
        return jsonify({"error": "No selected file."}), 400

    if not file.filename.lower().endswith('.xlsx'):
        return jsonify({"error": "Only .xlsx files accepted."}), 400

    file.save(DB_PATH)
    return jsonify({"message": "Workbook uploaded.", "path": DB_PATH}), 200


@app.route('/api/upload_transects', methods=['POST'])
def upload_transects():
    """Upload a transects .mat file for the current site."""
    if 'transects' not in request.files:
        return jsonify({"error": "No file part 'transects'."}), 400

    file = request.files['transects']
    if file.filename == '':
        return jsonify({"error": "No selected file."}), 400

    if not file.filename.lower().endswith('.mat'):
        return jsonify({"error": "Only .mat files accepted."}), 400

    os.makedirs(site_manager.assets_dir, exist_ok=True)
    save_path = os.path.join(site_manager.assets_dir, f'SLtransects_{site_manager.current_site}.mat')
    file.save(save_path)
    
    return jsonify({
        "message": f"Transects file uploaded for {site_manager.current_site}.",
        "path": save_path
    }), 200


if __name__ == "__main__":
    logger.info("Starting Flask server on http://0.0.0.0:8000")
    print("\n  ➜  CoastSnap is running at: http://localhost:8000")
    print("  ➜  Press CTRL+C to stop the server\n")
    app.run(host="0.0.0.0", port=8000, debug=False)