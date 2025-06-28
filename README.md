# CoastSnap Image Processing System

CoastSnap is a web-based citizen science coastal monitoring system that processes crowd-sourced photographs to track shoreline changes over time. It transforms smartphone coastal photographs taken from fixed camera cradles into georectified plan-view images, enabling automated shoreline extraction.

## Table of Contents
- [Installation](#installation)
- [Usage](#usage)
- [Features](#features)
- [System Architecture](#system-architecture)
- [Processing Pipeline](#processing-pipeline)

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/jerry-k/CSImageProcessing.git
   cd CSImageProcessing
   ```

2. **Create Python virtual environment**
   ```bash
   python -m venv venv
   
   # On Windows
   venv\Scripts\activate
   
   # On macOS/Linux
   # source venv/bin/activate
   ```

3. **Install Python dependencies**
   ```bash
   # From the coastsnap-web/backend directory
   pip install -r requirements.txt
   ```

That's it! The frontend is pre-built and included - no Node.js or npm required.

## Usage

### Starting the Application

```bash
cd coastsnap-web/backend
python app.py
```

The application will be available at `http://localhost:8000`

### Setting Up a New Site

1. **Add Site**: Navigate to Site Setup and enter site name and Spotteron root ID
2. **Download Images**: Fetch available images from Spotteron
3. **Select Control Image**: Choose a high-quality reference image
4. **Mark GCPs**: Click on known points and enter world coordinates
5. **Create Mask**: Draw the region of interest for processing
6. **Upload Transects**: Provide shore-perpendicular transect definitions (.mat file)

## Features

### Core Functionality
- **Multi-site Management**: Support for multiple coastal monitoring sites
- **Automated Image Processing**: Three-stage pipeline for registration, rectification, and shoreline extraction
- **Quality Control**: Automated filtering and manual approval workflows
- **Interactive Web Interface**: Modern React-based UI for setup, processing, and analysis
- **Citizen Science Integration**: Direct integration with Spotteron platform API

## System Architecture

```
CSImageProcessing/
├── coastsnap-web/
│   ├── backend/          # Flask API server
│   │   ├── imageprocessing/  # Core processing algorithms
│   │   ├── services/         # Business logic layer
│   │   ├── utils/           # Helper utilities
│   │   └── app.py          # Main Flask application
│   └── frontend/         # React TypeScript UI
│       └── coastsnap-ui/
│           ├── src/
│           │   ├── components/  # React components
│           │   ├── services/    # API client
│           │   └── stores/      # State management
│           └── package.json
└── README.md
```

### Processing Workflow

1. **Run Processing**: Conduct image registration and georectification on the images
2. **Detect Shorelines**: Run the shoreline detection algorithm over the rectified images
3. **Review Results**: Check shoreline detections in the shoreline detector
3. **Approve/Edit**: Manually refine and approve shorelines

## Processing Pipeline

### Stage 1: Registration
- Feature detection using SuperPoint
- Feature matching with LightGlue
- Homography estimation with RANSAC
- Quality filtering based on match count

### Stage 2: Rectification
- Camera model application (position, orientation, FOV)
- GCP-based transformation
- Bilinear interpolation for output generation
- Mask application for valid regions

### Stage 3: Shoreline Mapping
- Color channel analysis (Red-Blue difference)
- Adaptive thresholding with Gaussian KDE
- Transect intersection calculation
- Optional wet/dry sand boundary detection

## Acknowledgments

- https://github.com/Coastal-Imaging-Research-Network/CoastSnap-Toolbox - The original image processing pipeline in MATLAB
- https://github.com/mathvansoest/CoastSnapPy - The first python interpretation of CoastSnap