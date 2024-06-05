import numpy as np
from LightGlue.lightglue import LightGlue, SuperPoint, DISK
from LightGlue.lightglue.utils import load_image, rbd
from LightGlue.lightglue import viz2d
import torch
import cv2
import os

class Registration():
    def __init__(self,control_filename, mask):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.extractor = SuperPoint(max_num_keypoints=2048).eval().to(self.device)
        self.matcher = LightGlue(features="superpoint").eval().to(self.device)
        
        self.image0 = load_image(control_filename)
        self.control_cv = cv2.imread(control_filename)
        self.control_feats = self.extractor.extract(self.image0.to(self.device))
        self.mask = mask
    
    def point_in_mask(mask, coordinate):
        x, y = coordinate
        x, y = int(round(x)), int(round(y))
        return mask[y, x] != 0

    def image_registration(self, image_path, feats0, index):
        image1 = load_image(image_path)
        image_cv = cv2.imread(image_path)
        feats1 = self.extractor.extract(image1.to(self.device))

        matches01 = self.matcher({"image0": feats0, "image1": feats1})
        feats0, feats1, matches01 = [
            rbd(x) for x in [feats0, feats1, matches01]
        ]
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

        H, _ = cv2.findHomography(kps1, kps0, cv2.RANSAC)
        h_control, w_control = self.control_cv.shape[:2]
        img_new_registered = cv2.warpPerspective(image_cv, H, (w_control, h_control))
        
        # Save registered images
        cv2.imwrite(f"registrations/registration{index}.jpeg", img_new_registered)
        
        return img_new_registered

    def generate_registrations(self):
        folder_path = 'registrations'
        os.makedirs(folder_path, exist_ok=True)

        folder_path = 'downloaded_images'
        file_list = os.listdir(folder_path)

        i = 0

        for file_name in file_list:
            i += 1
            if file_name.lower().endswith('.jpg'):
                image_path = os.path.join(folder_path, file_name)
                self.image_registration(image_path, self.control_feats, i)
                # registered_image = self.image_registration(image_path, self.control_feats, i)
