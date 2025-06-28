import requests
import os

def download_images(site_name, topic_id, root_id, no_images):
    """Download CoastSnap images for the specified site and topic."""
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    site_dir = os.path.join(backend_dir, site_name)

    # Define and create all necessary subdirectories
    raw_dir = os.path.join(site_dir, 'Raw')
    registered_dir = os.path.join(site_dir, 'Registered')
    rectified_dir = os.path.join(site_dir, 'Rectified')
    target_image_dir = os.path.join(site_dir, 'Target Image')

    os.makedirs(raw_dir, exist_ok=True)
    os.makedirs(registered_dir, exist_ok=True)
    os.makedirs(rectified_dir, exist_ok=True)
    os.makedirs(target_image_dir, exist_ok=True)

    endpoint = 'https://www.spotteron.com/api/v2.1/spots'
    page = 1
    params = f'filter[topic_id]={topic_id}&filter[root_id]={root_id}&limit=10&page={page}&order[]=id+desc'
    url = f'{endpoint}?{params}'
    
    try:
        response = requests.get(url, timeout=10)  # Add timeout
        downloaded_files = []

        if response.status_code == 200:
            data = response.json()
            page_count = data['meta']['page_count']
            total_images = data['meta']['total']
            img_count = 0
            
            print(f"Found {total_images} total images across {page_count} pages")
            
            for page in range(1, page_count + 1):
                params = f'filter[topic_id]={topic_id}&filter[root_id]={root_id}&limit=10&page={page}&order[]=id+desc'
                url = f'{endpoint}?{params}'
                response = requests.get(url, timeout=10)

                if response.status_code == 200:
                    data = response.json()
                    spots = data.get("data", [])

                    for spot in spots:
                        img_count += 1

                        if img_count > no_images and no_images != -1:
                            return downloaded_files

                        img = spot.get('attributes', {}).get('image')
                        if img:
                            img_url = f"https://files.spotteron.com/images/spots/{img}.jpg"
                            print(f"Downloading image {img_count}: {img_url}")
                            
                            try:
                                img_response = requests.get(img_url, timeout=30)
                                if img_response.status_code == 200:
                                    split_img = img.split("/")
                                    img_filename_base = "-".join(split_img)
                                    img_filename = os.path.join(raw_dir, f"{img_filename_base}.jpg")
                                    
                                    with open(img_filename, 'wb') as img_file:
                                        img_file.write(img_response.content)
                                    
                                    downloaded_files.append(img_filename)
                                    print(f"Successfully downloaded: {img_filename_base}.jpg")
                                else:
                                    print(f"Failed to download image: {img_response.status_code}")
                            except Exception as img_error:
                                print(f"Error downloading individual image: {img_error}")

                else:
                    print(f"Error fetching page {page}: {response.status_code} - {response.text}")
                    break

        else:
            print(f"Error fetching initial page: {response.status_code} - {response.text}")
            
        return downloaded_files
        
    except requests.exceptions.RequestException as e:
        print(f"Network error during image download: {e}")
        raise
    except Exception as e:
        print(f"Unexpected error during image download: {e}")
        raise
