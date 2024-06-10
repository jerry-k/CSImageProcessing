from setuptools import setup, find_packages

def load_requirements(filename='requirements.txt'):
    with open(filename, 'r') as file:
        return file.read().splitlines()

# Load requirements from the file
requirements = load_requirements()

setup(
    name="CSImageProcessing",
    version="1.0.0",
    description="Image registration and rectification on Coastsnap images",
    packages=find_packages(),
    install_requires=requirements
)