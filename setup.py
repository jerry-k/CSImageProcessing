from setuptools import setup, find_packages
# List of requirements
requirements = []  # This could be retrieved from requirements.txt
# Package (minimal) configuration
setup(
    name="CSImageProcessing",
    version="1.0.0",
    description="Image registration and rectification on Coastsnap images",
    packages=find_packages(),
    install_requires=requirements
)