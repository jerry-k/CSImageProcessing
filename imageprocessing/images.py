import requests
import os
import tkinter as tk
from PIL import Image, ImageTk
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.widgets import PolygonSelector
import cv2
import imageio

def download_images(topic_id, root_id, no_images):
    """
    Downloads a specified number of images from the SpotterON platform based on topic and root identifiers.

    Args:
        topic_id (int or str): The identifier for the topic category from which to download images.
        root_id (int or str): The identifier for the root category within the topic from which to download images.
        no_images (int): The number of images to download. If set to -1, downloads all available images.

    Returns:
        None: This function does not return any value but downloads images to a specified directory.

    Raises:
        Exception: Raises an exception if there is any HTTP or connection error during the API calls.

    Notes:
        The images are saved in the 'raw' directory within the current working directory. 
        The function creates this directory if it does not already exist. Each image is named after its original 
        filename from the server, modified to ensure a valid filename, and saved as a JPG file.

    Examples:
        download_images(37, 242186, 10)  # Downloads up to 10 images from topic 123 and root 456.
        download_images(37, 242186, -1)  # Downloads all available images from topic 123 and root 456.
    """
    endpoint = 'https://www.spotteron.com/api/v2.1/spots'
    page = 1
    params = f'filter[topic_id]={topic_id}&filter[root_id]={root_id}&limit=10&page={page}&order[]=id+desc'
    url = f'{endpoint}?{params}'
    response = requests.get(url)

    if response.status_code == 200:
        data = response.json()
        page_count = data['meta']['page_count']
        total_images = data['meta']['total']
        img_count = 0
        folder_path = 'raw'
        os.makedirs(folder_path, exist_ok=True)
        
        for page in range(1, page_count+1):
            params = f'filter[topic_id]={topic_id}&filter[root_id]={root_id}&limit=10&page={page}&order[]=id+desc'
            url = f'{endpoint}?{params}'
            response = requests.get(url)

            if response.status_code == 200:
                data = response.json()
                spots = data.get("data", [])

                for spot in spots:
                    img_count += 1

                    if img_count > no_images and no_images != -1:
                        return

                    img = spot.get('attributes', {}).get('image')
                    if img:
                        img_url = f"https://files.spotteron.com/images/spots/{img}.jpg"
                        img_data = requests.get(img_url).content
                        split_img = img.split("/")
                        img = "-".join(split_img)
                        img_filename = os.path.join(folder_path, f"{img}.jpg")

                        with open(img_filename, 'wb') as img_file:
                            img_file.write(img_data)

            else:
                print(f"Error: {response.status_code} - {response.text}")
                break

    else:
        print(f"Error: {response.status_code} - {response.text}")

def select_control_image(directory):
    """
    Opens a GUI window for the user to manually select a control image from a specified directory.

    This function uses Tkinter to display images found in the directory. The user can navigate through the images and 
    select one as the control image. The selected image's filename is returned.

    Args:
        directory (str): Path to the directory containing JPG images.

    Returns:
        str or None: The filename of the selected image. Returns None if no images are found or if no image is selected.

    Example:
        selected_image = select_control_image('raw')
    """
    root = tk.Tk()
    root.title("Select Control Image")
    
    images = [img for img in os.listdir(directory) if img.endswith('.jpg')]
    if not images:
        print("No images found in the directory.")
        return None
    images.reverse()  # Reverse the list to start with the last image
    
    # Current image index
    current_image_index = [0]

    # Load the first image
    def load_image(index):
        img_path = os.path.join(directory, images[index])
        img = Image.open(img_path)
        img.thumbnail((800, 800))
        photo = ImageTk.PhotoImage(img)
        return photo

    photo = load_image(current_image_index[0])

    image_label = tk.Label(root, image=photo)
    image_label.image = photo
    image_label.pack(side=tk.TOP)

    # Update image displayed
    def update_image(delta):
        current_image_index[0] += delta
        current_image_index[0] = max(0, min(current_image_index[0], len(images) - 1))  # Prevent out-of-bounds
        new_photo = load_image(current_image_index[0])
        image_label.configure(image=new_photo)
        image_label.image = new_photo

    # Navigation buttons
    btn_prev = tk.Button(root, text="<< Previous", command=lambda: update_image(-1))
    btn_prev.pack(side=tk.LEFT)

    btn_next = tk.Button(root, text="Next >>", command=lambda: update_image(1))
    btn_next.pack(side=tk.LEFT)

    # Selection button
    def select_image():
        root.selected_image = images[current_image_index[0]]
        root.destroy()

    btn_select = tk.Button(root, text="Select This Image", command=select_image)
    btn_select.pack(side=tk.LEFT)

    root.selected_image = None
    root.mainloop()
    return root.selected_image

def generate_mask(image_path):
    """
    Interactively creates masks for specified regions within an image using polygon selectors.

    This function opens an image and allows the user to draw polygons that define regions of interest.
    The function continues to record polygons if the user inputs "yes" after drawing a polygon.
    These polygons are used to generate a mask where the selected regions are marked. The mask is returned as a binary image where
    the masked regions are marked with 255 (white) and the rest are 0 (black).

    Args:
        image_path (str): The file path to the image on which polygons will be drawn.

    Returns:
        ndarray or None: A binary mask of the same dimensions as the input image if polygons are drawn; otherwise, None.
        The function also saves the polygon vertices to 'polygon_coordinates.npy' if any polygons are drawn.

    Raises:
        FileNotFoundError: If the specified image_path does not point to a valid file.

    Example:
        mask = generate_mask('raw/image.jpg')
    """
    polygons = []
    image = imageio.imread(image_path)

    # Function to create a window, draw a polygon and return its vertices
    def create_window_and_draw_polygon():
        fig, ax = plt.subplots(figsize=(15, 12))
        ax.imshow(image)
        selector = PolygonSelector(ax, on_polygon_complete)
        plt.show()
        return selector.verts

    def on_polygon_complete(verts):
        plt.close()

    # Loop to draw multiple polygons
    while True:
        print("Draw a polygon and finalize it by completing the shape.")
        verts = create_window_and_draw_polygon()
        if verts:
            polygons.append(np.array(verts))
            print("Polygon saved. Number of vertices:", len(verts))
        else:
            print("No valid polygon drawn.")

        # Asks the user if they would like to mask another region
        cont = input("Draw another polygon? (yes/no): ")
        if cont.lower() != 'yes':
            break

    # Save polygons to a file
    if polygons:
        polygon_array = np.array(polygons, dtype=object)
        np.save('polygon_coordinates.npy', polygon_array)
        print(f'{len(polygons)} polygon coordinates saved to "polygon_coordinates.npy"')
        mask = np.zeros_like(image[:,:,0], dtype=np.uint8)
        for polygon in polygon_array:
            cv2.fillPoly(mask, [polygon.astype(np.int32)], 1)
        return mask
    else:
        print("No polygons were drawn.")
        return None