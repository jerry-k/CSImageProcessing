from setuptools import setup, find_packages

def load_requirements(filename='requirements.txt'):
    with open(filename, 'r') as file:
        return file.read().splitlines()

# Load requirements from the file
requirements = load_requirements()

setup(
    name="coastsnap-web",
    version="2.0.0",
    description="Web-based coastal monitoring image processing system using CoastSnap methodology",
    long_description="""
    CoastSnap Web is a full-stack application for processing coastal monitoring images.
    It provides automated image registration, rectification, and shoreline detection
    with a web interface for managing multiple monitoring sites.
    
    Features:
    - Multi-site management with isolated data storage
    - Image registration using SuperPoint + LightGlue
    - Camera geometry-based rectification to plan view
    - Automated shoreline detection with manual editing
    """,
    author="Jerry K",
    url="https://github.com/jerry-k/CSImageProcessing",
    packages=find_packages(),
    install_requires=requirements,
    python_requires=">=3.8",
    keywords="coastal monitoring, coastsnap, shoreline detection"
)