import numpy as np
from lightglue import LightGlue, SuperPoint
from lightglue.utils import load_image, rbd
import torch
import cv2
import os

class Registration():
    """
    A class to handle image registration using keypoint extraction and homography transformation. 

    This class uses the SuperPoint keypoint extractor and LightGlue matcher to perform feature-based image registration.
    The registered images are saved in the 'Registered' directory.
    """
    def __init__(self, control_filename, mask, site_dir):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.extractor = SuperPoint(max_num_keypoints=2048).eval().to(self.device)
        self.matcher = LightGlue(features="superpoint").eval().to(self.device)
        
        self.image0 = load_image(control_filename)
        self.control_cv = cv2.imread(control_filename)
        self.control_feats = self.extractor.extract(self.image0.to(self.device))
        self.mask = mask
        self.site_dir = site_dir
        self.raw_dir = os.path.join(site_dir, 'Raw')
        self.registered_dir = os.path.join(site_dir, 'Registered')

    def point_in_mask(self, mask, coordinate):
        """
        Determines if a given point (coordinate) falls within the masked region (non-zero) of an image.
        """
        x, y = coordinate
        x, y = int(round(x)), int(round(y))
        return mask[y, x] != 0

    def count_matches(self, image_path):
        """
        Returns the number of valid (masked) matches between the control and a raw image.
        """
        image1 = load_image(image_path)
        feats1 = self.extractor.extract(image1.to(self.device))
        matches01 = self.matcher({"image0": self.control_feats, "image1": feats1})
        feats0, feats1, matches01 = [rbd(x) for x in [self.control_feats, feats1, matches01]]
        kpts0, kpts1, matches = feats0["keypoints"], feats1["keypoints"], matches01["matches"]
        m_kpts0, m_kpts1 = kpts0[matches[..., 0]], kpts1[matches[..., 1]]

        m_kpts0_list = list(map(tuple, m_kpts0.tolist()))
        count = 0
        for pt in m_kpts0_list:
            if self.point_in_mask(self.mask, pt):
                count += 1
        return count

    def get_filtered_keypoints(self, image_path):
        """
        Returns filtered keypoints (kps1, kps0) for registration, after masking.
        """
        image1 = load_image(image_path)
        feats1 = self.extractor.extract(image1.to(self.device))
        matches01 = self.matcher({"image0": self.control_feats, "image1": feats1})
        feats0, feats1, matches01 = [rbd(x) for x in [self.control_feats, feats1, matches01]]
        kpts0, kpts1, matches = feats0["keypoints"], feats1["keypoints"], matches01["matches"]
        m_kpts0, m_kpts1 = kpts0[matches[..., 0]], kpts1[matches[..., 1]]

        m_kpts0_list = list(map(tuple, m_kpts0.tolist()))
        m_kpts1_list = list(map(tuple, m_kpts1.tolist()))

        kps0, kps1 = [], []
        for i in range(len(m_kpts0_list)):
            if self.point_in_mask(self.mask, m_kpts0_list[i]):
                kps0.append(m_kpts0_list[i])
                kps1.append(m_kpts1_list[i])

        kps0 = np.array(kps0, dtype=np.float32)
        kps1 = np.array(kps1, dtype=np.float32)
        return kps1, kps0

    def image_registration(self, image_path, kps1, kps0):
        """
        Registers an image to the control image using provided keypoints and homography, then saves the output.
        """
        if kps1 is None or kps0 is None or len(kps1) < 4 or len(kps0) < 4:
            print(f"Skipping {image_path}: not enough matches for homography.")
            return None

        image_cv = cv2.imread(image_path)
        H, _ = cv2.findHomography(kps1, kps0, cv2.RANSAC)
        if H is None:
            print(f"Skipping {image_path}: homography computation failed.")
            return None

        h_control, w_control = self.control_cv.shape[:2]
        img_new_registered = cv2.warpPerspective(image_cv, H, (w_control, h_control))
        os.makedirs(self.registered_dir, exist_ok=True)
        
        # Extract base name from raw image (remove the 000037- prefix and keep date-uniqueid)
        base_name = os.path.basename(image_path)
        # Remove the numeric prefix if it exists (e.g., "000037-")
        if '-' in base_name and base_name.split('-')[0].isdigit():
            name_parts = base_name.split('-', 1)
            clean_name = name_parts[1]  # Get everything after first hyphen
        else:
            clean_name = base_name
        
        # Remove extension and add registered prefix
        name_without_ext = os.path.splitext(clean_name)[0]
        output_path = os.path.join(self.registered_dir, f"registered_{name_without_ext}.jpeg")
        cv2.imwrite(output_path, img_new_registered)
        return img_new_registered

    def generate_registrations(self):
        """
        Two-pass: First, count matches for all images. Then, register only those above threshold.
        """
        if not os.path.isdir(self.raw_dir):
            print(f"Error: Raw directory not found at {self.raw_dir}")
            return
            
        file_list = sorted([f for f in os.listdir(self.raw_dir) if f.lower().endswith('.jpg')])

        # First pass: count matches
        match_counts = []
        print("First pass: counting matches for all images...")
        for file_name in file_list:
            image_path = os.path.join(self.raw_dir, file_name)
            num_matches = self.count_matches(image_path)
            match_counts.append((image_path, num_matches))

        # Compute average (excluding <4)
        valid_counts = [num for _, num in match_counts if num >= 4]
        if not valid_counts:
            print("No valid images with at least 4 matches found.")
            return

        avg_matches = sum(valid_counts) / len(valid_counts)
        threshold = avg_matches * 0.5
        print(f"Average matches: {avg_matches:.2f}, Threshold: {threshold:.2f}")

        # Second pass: register only images above threshold
        os.makedirs(self.registered_dir, exist_ok=True)
        print("Second pass: registering images above threshold...")
        for image_path, num_matches in match_counts:
            if num_matches < 4:
                print(f"Skipping {image_path}: only {num_matches} matches (less than 4)")
                continue
            if num_matches < threshold:
                print(f"Skipping {image_path}: only {num_matches} matches (below threshold {threshold:.2f})")
                continue
            kps1, kps0 = self.get_filtered_keypoints(image_path)
            if kps1 is None or kps0 is None or len(kps1) < 4 or len(kps0) < 4:
                print(f"Skipping {image_path}: not enough matches for homography after recomputation.")
                continue
            self.image_registration(image_path, kps1, kps0)
